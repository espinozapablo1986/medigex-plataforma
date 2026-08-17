'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { periodosEnRango } from '@/lib/liquidacion';
import {
  booleano,
  entero,
  fechaRequerida,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

export async function generarLiquidacion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevaId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('liquidaciones', 'crear');

    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const periodoDesde = fechaRequerida(fd, 'periodoDesde', 'Desde');
    const periodoHasta = fechaRequerida(fd, 'periodoHasta', 'Hasta');
    if (periodoHasta < periodoDesde) throw new Error('La fecha de término debe ser posterior a la de inicio.');

    // Se liquida sobre el día completo del extremo superior.
    const hastaFinDia = new Date(periodoHasta);
    hastaFinDia.setHours(23, 59, 59, 999);

    const incluirArriendo = booleano(fd, 'incluirArriendo');
    const soloPagadas = booleano(fd, 'soloPagadas');

    const profesional = await prisma.profesional.findUnique({
      where: { id: profesionalId },
      include: { arriendos: { include: { box: { select: { codigo: true, nombre: true } } } } },
    });
    if (!profesional) throw new Error('El profesional no existe.');

    // Prestaciones aún no liquidadas dentro del período
    const items = await prisma.ventaItem.findMany({
      where: {
        profesionalId,
        liquidacionId: null,
        venta: {
          fecha: { gte: periodoDesde, lte: hastaFinDia },
          estado: soloPagadas ? 'PAGADA' : { not: 'ANULADA' },
        },
      },
      include: { venta: { select: { folio: true, fecha: true } } },
    });

    if (items.length === 0 && !incluirArriendo) {
      throw new Error(
        'No hay prestaciones pendientes de liquidar para este profesional en el período seleccionado.',
      );
    }

    const totalProducido = items.reduce((acc, i) => acc + i.total, 0);
    const totalComision = items.reduce((acc, i) => acc + i.comisionMonto, 0);

    // Arriendo de box del período
    const lineasArriendo: { descripcion: string; monto: number; referenciaId: string }[] = [];
    if (incluirArriendo) {
      for (const arriendo of profesional.arriendos.filter((a) => a.activo)) {
        const periodos = periodosEnRango(
          arriendo.periodicidad,
          periodoDesde,
          hastaFinDia,
          arriendo.vigenteDesde,
          arriendo.vigenteHasta,
        );
        if (periodos <= 0) continue;
        const monto = Math.round(arriendo.monto * periodos);
        lineasArriendo.push({
          descripcion: `Arriendo box ${arriendo.box.codigo} — ${arriendo.periodicidad.toLowerCase()} × ${periodos}`,
          monto,
          referenciaId: arriendo.id,
        });
      }
    }

    const totalArriendo = lineasArriendo.reduce((acc, l) => acc + l.monto, 0);
    const totalBonos = entero(fd, 'bono');
    const totalOtrosDescuentos = entero(fd, 'descuento');
    const totalAPagar = totalComision + totalBonos - totalArriendo - totalOtrosDescuentos;

    const liquidacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.liquidacion.create({
        data: {
          profesionalId,
          periodoDesde,
          periodoHasta: hastaFinDia,
          totalProducido,
          totalComision,
          totalArriendo,
          totalBonos,
          totalOtrosDescuentos,
          totalAPagar,
          observaciones: textoOpcional(fd, 'observaciones'),
          creadoPorId: sesion.usuarioId,
          items: {
            createMany: {
              data: [
                ...items.map((i) => ({
                  tipo: 'COMISION' as const,
                  descripcion: `${i.descripcion} — venta Nº ${i.venta.folio} (${i.venta.fecha.toLocaleDateString('es-CL')})`,
                  monto: i.comisionMonto,
                  referenciaId: i.id,
                })),
                ...lineasArriendo.map((l) => ({
                  tipo: 'ARRIENDO_BOX' as const,
                  descripcion: l.descripcion,
                  monto: -l.monto,
                  referenciaId: l.referenciaId,
                })),
                ...(totalBonos > 0
                  ? [
                      {
                        tipo: 'BONO' as const,
                        descripcion: texto(fd, 'bonoDescripcion') || 'Bono',
                        monto: totalBonos,
                      },
                    ]
                  : []),
                ...(totalOtrosDescuentos > 0
                  ? [
                      {
                        tipo: 'DESCUENTO' as const,
                        descripcion: texto(fd, 'descuentoDescripcion') || 'Descuento',
                        monto: -totalOtrosDescuentos,
                      },
                    ]
                  : []),
              ],
            },
          },
        },
      });

      // Marcamos las prestaciones como liquidadas para que no se repitan.
      if (items.length > 0) {
        await tx.ventaItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { liquidacionId: creada.id },
        });
      }

      return creada;
    });

    nuevaId = liquidacion.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'liquidaciones',
      entidad: 'Liquidacion',
      entidadId: liquidacion.id,
      detalle: { profesionalId, totalAPagar, prestaciones: items.length },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/liquidaciones');
  redirect(`/liquidaciones/${nuevaId}`);
}

export async function agregarAjuste(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('liquidaciones', 'editar');
    const liquidacionId = requerido(fd, 'liquidacionId', 'Liquidación');
    const tipo = texto(fd, 'tipo') || 'AJUSTE';
    const monto = entero(fd, 'monto');
    if (monto === 0) throw new Error('El monto del ajuste no puede ser cero.');

    const liquidacion = await prisma.liquidacion.findUnique({ where: { id: liquidacionId } });
    if (!liquidacion) throw new Error('La liquidación no existe.');
    if (liquidacion.estado !== 'BORRADOR') {
      throw new Error('Sólo se pueden agregar ajustes mientras la liquidación está en borrador.');
    }

    // Los descuentos restan; bonos y ajustes suman según el signo indicado.
    const signo = tipo === 'DESCUENTO' ? -1 : 1;
    const montoFinal = Math.abs(monto) * signo;

    await prisma.$transaction(async (tx) => {
      await tx.liquidacionItem.create({
        data: {
          liquidacionId,
          tipo: tipo as never,
          descripcion: requerido(fd, 'descripcion', 'Descripción'),
          monto: montoFinal,
        },
      });

      await tx.liquidacion.update({
        where: { id: liquidacionId },
        data: {
          totalBonos: montoFinal > 0 ? { increment: montoFinal } : undefined,
          totalOtrosDescuentos: montoFinal < 0 ? { increment: Math.abs(montoFinal) } : undefined,
          totalAPagar: { increment: montoFinal },
        },
      });
    });

    revalidatePath(`/liquidaciones/${liquidacionId}`);
    return { ok: true as const, mensaje: 'Ajuste agregado.' };
  });
}

export async function cambiarEstadoLiquidacion(fd: FormData): Promise<void> {
  const estado = String(fd.get('estado'));
  const sesion = await exigirPermiso('liquidaciones', estado === 'APROBADA' ? 'aprobar' : 'editar');
  const id = String(fd.get('id'));

  const datos: Record<string, unknown> = { estado };
  if (estado === 'APROBADA') datos.aprobadaAt = new Date();
  if (estado === 'PAGADA') {
    datos.fechaPago = new Date();
    const formaPagoId = String(fd.get('formaPagoId') ?? '');
    if (formaPagoId) datos.formaPagoId = formaPagoId;
  }

  await prisma.liquidacion.update({ where: { id }, data: datos });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: `estado_${estado.toLowerCase()}`,
    modulo: 'liquidaciones',
    entidad: 'Liquidacion',
    entidadId: id,
  });

  revalidatePath(`/liquidaciones/${id}`);
  revalidatePath('/liquidaciones');
}

export async function eliminarLiquidacion(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('liquidaciones', 'eliminar');
  const id = String(fd.get('id'));

  const liquidacion = await prisma.liquidacion.findUnique({ where: { id } });
  if (!liquidacion) return;
  if (liquidacion.estado === 'PAGADA') throw new Error('No se puede eliminar una liquidación ya pagada.');

  await prisma.$transaction(async (tx) => {
    // Liberamos las prestaciones para que puedan volver a liquidarse.
    await tx.ventaItem.updateMany({ where: { liquidacionId: id }, data: { liquidacionId: null } });
    await tx.liquidacion.delete({ where: { id } });
  });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'liquidaciones',
    entidad: 'Liquidacion',
    entidadId: id,
  });
  redirect('/liquidaciones');
}
