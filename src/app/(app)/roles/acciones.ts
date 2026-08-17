'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { MODULOS, expandirPermisos, type Accion } from '@/lib/permissions';
import { intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';
import { slugificar } from '@/lib/format';

export async function crearRol(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';
  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('roles', 'crear');
    const nombre = requerido(fd, 'nombre', 'Nombre del rol');
    const slug = slugificar(texto(fd, 'slug') || nombre);

    if (await prisma.rol.findUnique({ where: { slug } })) {
      throw new Error(`Ya existe un rol con el identificador "${slug}".`);
    }

    // Se puede partir copiando los permisos de un rol existente.
    const copiarDeId = textoOpcional(fd, 'copiarDe');
    const permisosBase = copiarDeId
      ? (await prisma.rolPermiso.findMany({ where: { rolId: copiarDeId } })).map((p) => ({
          modulo: p.modulo,
          accion: p.accion as Accion,
          permitido: p.permitido,
        }))
      : expandirPermisos({});

    const rol = await prisma.rol.create({
      data: {
        nombre,
        slug,
        descripcion: textoOpcional(fd, 'descripcion'),
        permisos: { createMany: { data: permisosBase } },
      },
    });
    nuevoId = rol.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'roles',
      entidad: 'Rol',
      entidadId: rol.id,
      detalle: { nombre, slug },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/roles');
  redirect(`/roles/${nuevoId}`);
}

export async function guardarPermisos(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('roles', 'editar');
    const rolId = requerido(fd, 'rolId', 'Rol');

    const rol = await prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) throw new Error('El rol no existe.');

    // Los checkboxes marcados llegan como "modulo.accion"
    const marcados = new Set(fd.getAll('permiso').map(String));

    const operaciones = [];
    for (const modulo of MODULOS) {
      for (const accion of modulo.acciones) {
        const clave = `${modulo.slug}.${accion}`;
        operaciones.push(
          prisma.rolPermiso.upsert({
            where: { rolId_modulo_accion: { rolId, modulo: modulo.slug, accion } },
            create: { rolId, modulo: modulo.slug, accion, permitido: marcados.has(clave) },
            update: { permitido: marcados.has(clave) },
          }),
        );
      }
    }
    await prisma.$transaction(operaciones);

    await prisma.rol.update({
      where: { id: rolId },
      data: {
        nombre: requerido(fd, 'nombre', 'Nombre del rol'),
        descripcion: textoOpcional(fd, 'descripcion'),
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'roles',
      entidad: 'Rol',
      entidadId: rolId,
      detalle: { permisosActivos: marcados.size },
    });

    revalidatePath('/roles');
    revalidatePath(`/roles/${rolId}`);
    return { ok: true as const, mensaje: 'Permisos actualizados.' };
  });
}

export async function eliminarRol(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('roles', 'eliminar');
  const id = String(fd.get('id'));

  const rol = await prisma.rol.findUnique({ where: { id }, include: { _count: { select: { usuarios: true } } } });
  if (!rol) return;
  if (rol.esSistema) throw new Error('Los roles del sistema no se pueden eliminar. Puedes desactivarlos.');
  if (rol._count.usuarios > 0) {
    throw new Error(`No puedes eliminar este rol: tiene ${rol._count.usuarios} usuario(s) asignado(s).`);
  }

  await prisma.rol.delete({ where: { id } });
  await auditar({ usuarioId: sesion.usuarioId, accion: 'eliminar', modulo: 'roles', entidad: 'Rol', entidadId: id });
  revalidatePath('/roles');
}

export async function alternarActivoRol(fd: FormData): Promise<void> {
  await exigirPermiso('roles', 'editar');
  const id = String(fd.get('id'));
  const rol = await prisma.rol.findUnique({ where: { id } });
  if (!rol) return;
  await prisma.rol.update({ where: { id }, data: { activo: !rol.activo } });
  revalidatePath('/roles');
}
