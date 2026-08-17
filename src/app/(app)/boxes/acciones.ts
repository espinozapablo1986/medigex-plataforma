'use server';

import { revalidatePath } from 'next/cache';
import type { TipoBox } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { entero, intentar, requerido, textoOpcional, type Resultado } from '@/lib/resultado';

const TIPOS: TipoBox[] = [
  'BOX_DENTAL',
  'BOX_MEDICO',
  'SALA_RAYOS_X',
  'SALA_PROCEDIMIENTOS',
  'SALA_CIRUGIA',
  'OTRO',
];

function datosDesdeFormulario(fd: FormData) {
  const tipo = requerido(fd, 'tipo', 'Tipo') as TipoBox;
  if (!TIPOS.includes(tipo)) throw new Error('Tipo de box no válido.');

  return {
    codigo: requerido(fd, 'codigo', 'Código').toUpperCase(),
    nombre: requerido(fd, 'nombre', 'Nombre'),
    tipo,
    ubicacion: textoOpcional(fd, 'ubicacion'),
    descripcion: textoOpcional(fd, 'descripcion'),
    equipamiento: textoOpcional(fd, 'equipamiento'),
    valorArriendoHora: entero(fd, 'valorArriendoHora'),
  };
}

export async function crearBox(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('boxes', 'crear');
    const datos = datosDesdeFormulario(fd);

    if (await prisma.box.findUnique({ where: { codigo: datos.codigo } })) {
      throw new Error(`Ya existe un box con el código ${datos.codigo}.`);
    }

    const box = await prisma.box.create({ data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'boxes',
      entidad: 'Box',
      entidadId: box.id,
    });

    revalidatePath('/boxes');
    return { ok: true as const, mensaje: `Box ${datos.nombre} creado.` };
  });
}

export async function editarBox(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('boxes', 'editar');
    const id = requerido(fd, 'id', 'Box');
    const datos = datosDesdeFormulario(fd);

    const existente = await prisma.box.findUnique({ where: { codigo: datos.codigo } });
    if (existente && existente.id !== id) throw new Error(`El código ${datos.codigo} ya está en uso.`);

    await prisma.box.update({ where: { id }, data: datos });
    await auditar({ usuarioId: sesion.usuarioId, accion: 'editar', modulo: 'boxes', entidad: 'Box', entidadId: id });

    revalidatePath('/boxes');
    return { ok: true as const, mensaje: 'Box actualizado.' };
  });
}

export async function alternarActivoBox(fd: FormData): Promise<void> {
  await exigirPermiso('boxes', 'editar');
  const id = String(fd.get('id'));
  const box = await prisma.box.findUnique({ where: { id } });
  if (!box) return;
  await prisma.box.update({ where: { id }, data: { activo: !box.activo } });
  revalidatePath('/boxes');
}

export async function eliminarBox(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('boxes', 'eliminar');
  const id = String(fd.get('id'));

  const usos = await prisma.cita.count({ where: { boxId: id } });
  if (usos > 0) {
    throw new Error(
      `Este box tiene ${usos} cita(s) asociadas y no puede eliminarse. Desactívalo para sacarlo de la agenda.`,
    );
  }

  await prisma.box.delete({ where: { id } });
  await auditar({ usuarioId: sesion.usuarioId, accion: 'eliminar', modulo: 'boxes', entidad: 'Box', entidadId: id });
  revalidatePath('/boxes');
}
