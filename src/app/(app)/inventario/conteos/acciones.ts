'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { moverStock } from '@/lib/inventario';
import { intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

/**
 * Abre un conteo físico.
 *
 * Congela el stock teórico de cada producto en ese instante. Si se comparara
 * contra el stock vivo al cerrar, el consumo de las atenciones ocurrido
 * durante el recuento aparecería como diferencia de inventario, y el conteo
 * culparía a la bodega de algo que hizo el sistema.
 */
export async function abrirConteo(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('inventario', 'crear');

    const categoriaId = textoOpcional(fd, 'categoriaId');
    const ubicacion = textoOpcional(fd, 'ubicacion');

    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        ...(categoriaId ? { categoriaId } : {}),
        ...(ubicacion ? { ubicacion: { contains: ubicacion, mode: 'insensitive' } } : {}),
      },
      select: { id: true, stockActual: true },
      orderBy: { nombre: 'asc' },
    });

    if (productos.length === 0) {
      throw new Error('Ningún producto activo coincide con ese filtro. El conteo quedaría vacío.');
    }

    const conteo = await prisma.$transaction(async (tx) => {
      const creado = await tx.conteoInventario.create({
        data: {
          nombre: requerido(fd, 'nombre', 'Nombre del conteo'),
          categoriaId,
          ubicacion,
          observaciones: textoOpcional(fd, 'observaciones'),
          abiertoPorId: sesion.usuarioId,
        },
      });

      await tx.conteoInventarioItem.createMany({
        data: productos.map((p) => ({
          conteoId: creado.id,
          productoId: p.id,
          stockTeorico: p.stockActual,
        })),
      });

      return creado;
    });

    nuevoId = conteo.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'abrir_conteo',
      modulo: 'inventario',
      entidad: 'ConteoInventario',
      entidadId: conteo.id,
      detalle: { productos: productos.length, categoriaId, ubicacion },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/inventario/conteos');
  redirect(`/inventario/conteos/${nuevoId}`);
}

const esquemaLinea = z.object({
  itemId: z.string().min(1),
  contado: z.number().min(0).nullable(),
  observaciones: z.string().nullable(),
});

/**
 * Guarda las cantidades contadas.
 *
 * Llegan juntas como JSON: un conteo de bodega son cientos de posiciones, y
 * guardarlas de a una dejaría el recuento a medias ante cualquier corte.
 */
export async function guardarConteo(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('inventario', 'editar');
    const conteoId = requerido(fd, 'conteoId', 'Conteo');

    const conteo = await prisma.conteoInventario.findUnique({ where: { id: conteoId } });
    if (!conteo) throw new Error('El conteo no existe.');
    if (conteo.estado !== 'ABIERTO') throw new Error('Este conteo ya está cerrado: no admite cambios.');

    let parseado: unknown;
    try {
      parseado = JSON.parse(texto(fd, 'lineas'));
    } catch {
      throw new Error('No se pudieron leer las cantidades.');
    }

    const validado = z.array(esquemaLinea).safeParse(parseado);
    if (!validado.success) {
      throw new Error(validado.error.issues[0]?.message ?? 'Hay cantidades fuera de rango.');
    }

    const ahora = new Date();
    await prisma.$transaction(
      validado.data.map((linea) =>
        prisma.conteoInventarioItem.updateMany({
          where: { id: linea.itemId, conteoId },
          data: {
            stockContado: linea.contado,
            observaciones: linea.observaciones,
            contadoAt: linea.contado === null ? null : ahora,
          },
        }),
      ),
    );

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'guardar_conteo',
      modulo: 'inventario',
      entidad: 'ConteoInventario',
      entidadId: conteoId,
      detalle: { lineas: validado.data.length },
    });

    revalidatePath(`/inventario/conteos/${conteoId}`);
    return { ok: true as const, mensaje: 'Conteo guardado.' };
  });
}

/**
 * Cierra el conteo y aplica los ajustes.
 *
 * Exige el permiso «aprobar» y no «editar»: contar y aprobar el ajuste
 * resultante no deberían ser la misma persona, porque el ajuste borra una
 * diferencia que quizá había que explicar.
 *
 * Los ajustes se calculan contra el stock **del momento del cierre**, no
 * contra el teórico congelado: entre contar y aprobar puede haberse consumido
 * material, y el objetivo es dejar el sistema igual a la realidad contada.
 */
export async function cerrarConteo(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('inventario', 'aprobar');
  const conteoId = String(fd.get('id'));

  const conteo = await prisma.conteoInventario.findUnique({
    where: { id: conteoId },
    include: { items: { include: { producto: { select: { nombre: true, stockActual: true } } } } },
  });
  if (!conteo) throw new Error('El conteo no existe.');
  if (conteo.estado !== 'ABIERTO') throw new Error('Este conteo ya estaba cerrado.');

  const contados = conteo.items.filter((i) => i.stockContado !== null);
  if (contados.length === 0) {
    throw new Error('No se contó ninguna posición. Registra al menos una cantidad antes de cerrar.');
  }

  let ajustados = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of contados) {
      const contado = item.stockContado!;
      const actual = item.producto.stockActual;
      if (contado === actual) continue;

      await moverStock(tx, {
        productoId: item.productoId,
        tipo: 'AJUSTE',
        cantidad: contado,
        motivo: `Conteo físico N.° ${conteo.folio} — ${conteo.nombre}`,
        referenciaTipo: 'conteo_inventario',
        referenciaId: conteo.id,
        usuarioId: sesion.usuarioId,
      });
      ajustados += 1;
    }

    await tx.conteoInventario.update({
      where: { id: conteoId },
      data: { estado: 'CERRADO', cerradoAt: new Date(), cerradoPorId: sesion.usuarioId },
    });
  });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'cerrar_conteo',
    modulo: 'inventario',
    entidad: 'ConteoInventario',
    entidadId: conteoId,
    detalle: { contados: contados.length, ajustados },
  });

  revalidatePath('/inventario');
  revalidatePath(`/inventario/conteos/${conteoId}`);
  redirect(`/inventario/conteos/${conteoId}`);
}

/** Descarta un conteo sin tocar el stock. */
export async function anularConteo(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('inventario', 'aprobar');
  const conteoId = String(fd.get('id'));

  const conteo = await prisma.conteoInventario.findUnique({ where: { id: conteoId } });
  if (!conteo) return;
  if (conteo.estado === 'CERRADO') {
    throw new Error('Un conteo cerrado ya aplicó sus ajustes: no se puede anular. Haz un conteo nuevo.');
  }

  await prisma.conteoInventario.update({
    where: { id: conteoId },
    data: { estado: 'ANULADO', cerradoAt: new Date(), cerradoPorId: sesion.usuarioId },
  });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'anular_conteo',
    modulo: 'inventario',
    entidad: 'ConteoInventario',
    entidadId: conteoId,
  });

  revalidatePath('/inventario/conteos');
  redirect('/inventario/conteos');
}
