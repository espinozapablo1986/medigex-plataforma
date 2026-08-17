'use server';

import { revalidatePath } from 'next/cache';
import type { TipoBox } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import {
  booleano,
  decimal,
  entero,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const TIPOS_BOX: TipoBox[] = [
  'BOX_DENTAL',
  'BOX_MEDICO',
  'SALA_RAYOS_X',
  'SALA_PROCEDIMIENTOS',
  'SALA_CIRUGIA',
  'OTRO',
];

function datosServicio(fd: FormData) {
  const tipoBox = texto(fd, 'tipoBoxRequerido');
  const comision = texto(fd, 'comisionPorcentaje');

  return {
    codigo: requerido(fd, 'codigo', 'Código').toUpperCase(),
    nombre: requerido(fd, 'nombre', 'Nombre'),
    descripcion: textoOpcional(fd, 'descripcion'),
    categoriaId: textoOpcional(fd, 'categoriaId'),
    precio: entero(fd, 'precio'),
    costoEstimado: entero(fd, 'costoEstimado'),
    duracionMinutos: Math.max(5, entero(fd, 'duracionMinutos', 30)),
    requiereBox: booleano(fd, 'requiereBox'),
    tipoBoxRequerido: TIPOS_BOX.includes(tipoBox as TipoBox) ? (tipoBox as TipoBox) : null,
    usaRayosX: booleano(fd, 'usaRayosX'),
    afectoIva: booleano(fd, 'afectoIva'),
    comisionPorcentaje: comision === '' ? null : decimal(fd, 'comisionPorcentaje'),
    requiereConsentimiento: booleano(fd, 'requiereConsentimiento'),
  };
}

export async function crearServicio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('servicios', 'crear');
    const datos = datosServicio(fd);

    if (await prisma.servicio.findUnique({ where: { codigo: datos.codigo } })) {
      throw new Error(`Ya existe un servicio con el código ${datos.codigo}.`);
    }

    const servicio = await prisma.servicio.create({ data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'servicios',
      entidad: 'Servicio',
      entidadId: servicio.id,
    });

    revalidatePath('/servicios');
    return { ok: true as const, mensaje: `Servicio ${datos.nombre} creado.` };
  });
}

export async function editarServicio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('servicios', 'editar');
    const id = requerido(fd, 'id', 'Servicio');
    const datos = datosServicio(fd);

    const existente = await prisma.servicio.findUnique({ where: { codigo: datos.codigo } });
    if (existente && existente.id !== id) throw new Error(`El código ${datos.codigo} ya está en uso.`);

    await prisma.servicio.update({ where: { id }, data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'servicios',
      entidad: 'Servicio',
      entidadId: id,
    });

    revalidatePath('/servicios');
    revalidatePath(`/servicios/${id}`);
    return { ok: true as const, mensaje: 'Servicio actualizado.' };
  });
}

export async function alternarActivoServicio(fd: FormData): Promise<void> {
  await exigirPermiso('servicios', 'editar');
  const id = String(fd.get('id'));
  const servicio = await prisma.servicio.findUnique({ where: { id } });
  if (!servicio) return;
  await prisma.servicio.update({ where: { id }, data: { activo: !servicio.activo } });
  revalidatePath('/servicios');
}

export async function eliminarServicio(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('servicios', 'eliminar');
  const id = String(fd.get('id'));

  const [enVentas, enCitas] = await Promise.all([
    prisma.ventaItem.count({ where: { servicioId: id } }),
    prisma.cita.count({ where: { servicioId: id } }),
  ]);
  if (enVentas > 0 || enCitas > 0) {
    throw new Error('El servicio tiene movimientos asociados. Desactívalo en vez de eliminarlo.');
  }

  await prisma.servicio.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'servicios',
    entidad: 'Servicio',
    entidadId: id,
  });
  revalidatePath('/servicios');
}

// ─────────────────────────────────────────────────────────────
//  Categorías
// ─────────────────────────────────────────────────────────────

export async function crearCategoriaServicio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('servicios', 'crear');
    const nombre = requerido(fd, 'nombre', 'Nombre');
    if (await prisma.categoriaServicio.findUnique({ where: { nombre } })) {
      throw new Error('Ya existe una categoría con ese nombre.');
    }
    await prisma.categoriaServicio.create({
      data: { nombre, descripcion: textoOpcional(fd, 'descripcion'), color: texto(fd, 'color') || '#64748b' },
    });
    revalidatePath('/servicios');
    return { ok: true as const, mensaje: 'Categoría creada.' };
  });
}

export async function eliminarCategoriaServicio(fd: FormData): Promise<void> {
  await exigirPermiso('servicios', 'eliminar');
  const id = String(fd.get('id'));
  await prisma.servicio.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
  await prisma.categoriaServicio.delete({ where: { id } });
  revalidatePath('/servicios');
}

// ─────────────────────────────────────────────────────────────
//  Insumos que consume un servicio
// ─────────────────────────────────────────────────────────────

export async function agregarInsumo(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('servicios', 'editar');
    const servicioId = requerido(fd, 'servicioId', 'Servicio');
    const productoId = requerido(fd, 'productoId', 'Producto');
    const cantidad = decimal(fd, 'cantidad', 1);
    if (cantidad <= 0) throw new Error('La cantidad debe ser mayor que cero.');

    await prisma.insumoServicio.upsert({
      where: { servicioId_productoId: { servicioId, productoId } },
      create: { servicioId, productoId, cantidad },
      update: { cantidad },
    });

    revalidatePath(`/servicios/${servicioId}`);
    return { ok: true as const, mensaje: 'Insumo asociado al servicio.' };
  });
}

export async function quitarInsumo(fd: FormData): Promise<void> {
  await exigirPermiso('servicios', 'editar');
  const id = String(fd.get('id'));
  const insumo = await prisma.insumoServicio.findUnique({ where: { id } });
  if (!insumo) return;
  await prisma.insumoServicio.delete({ where: { id } });
  revalidatePath(`/servicios/${insumo.servicioId}`);
}

// ─────────────────────────────────────────────────────────────
//  Comisión especial por profesional
// ─────────────────────────────────────────────────────────────

export async function guardarComisionServicio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('servicios', 'editar');
    const servicioId = requerido(fd, 'servicioId', 'Servicio');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const porcentaje = decimal(fd, 'porcentaje');
    if (porcentaje < 0 || porcentaje > 100) throw new Error('El porcentaje debe estar entre 0 y 100.');

    await prisma.comisionServicio.upsert({
      where: { profesionalId_servicioId: { profesionalId, servicioId } },
      create: { profesionalId, servicioId, porcentaje },
      update: { porcentaje },
    });

    revalidatePath(`/servicios/${servicioId}`);
    return { ok: true as const, mensaje: 'Comisión específica guardada.' };
  });
}

export async function quitarComisionServicio(fd: FormData): Promise<void> {
  await exigirPermiso('servicios', 'editar');
  const id = String(fd.get('id'));
  const comision = await prisma.comisionServicio.findUnique({ where: { id } });
  if (!comision) return;
  await prisma.comisionServicio.delete({ where: { id } });
  revalidatePath(`/servicios/${comision.servicioId}`);
}
