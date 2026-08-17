'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, validarRut } from '@/lib/format';
import { intentar, requerido, textoOpcional, type Resultado } from '@/lib/resultado';

function datosProveedor(fd: FormData) {
  const rut = textoOpcional(fd, 'rut');
  if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

  return {
    rut: rut ? normalizarRut(rut) : null,
    razonSocial: requerido(fd, 'razonSocial', 'Razón social'),
    nombreFantasia: textoOpcional(fd, 'nombreFantasia'),
    giro: textoOpcional(fd, 'giro'),
    contacto: textoOpcional(fd, 'contacto'),
    telefono: textoOpcional(fd, 'telefono'),
    email: textoOpcional(fd, 'email'),
    direccion: textoOpcional(fd, 'direccion'),
    comuna: textoOpcional(fd, 'comuna'),
    observaciones: textoOpcional(fd, 'observaciones'),
  };
}

export async function crearProveedor(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('proveedores', 'crear');
    const datos = datosProveedor(fd);

    if (datos.rut && (await prisma.proveedor.findUnique({ where: { rut: datos.rut } }))) {
      throw new Error('Ya existe un proveedor con ese RUT.');
    }

    const proveedor = await prisma.proveedor.create({ data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'proveedores',
      entidad: 'Proveedor',
      entidadId: proveedor.id,
    });

    revalidatePath('/proveedores');
    return { ok: true as const, mensaje: 'Proveedor creado.' };
  });
}

export async function editarProveedor(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('proveedores', 'editar');
    const id = requerido(fd, 'id', 'Proveedor');
    const datos = datosProveedor(fd);

    if (datos.rut) {
      const existente = await prisma.proveedor.findUnique({ where: { rut: datos.rut } });
      if (existente && existente.id !== id) throw new Error('Ese RUT ya pertenece a otro proveedor.');
    }

    await prisma.proveedor.update({ where: { id }, data: datos });
    revalidatePath('/proveedores');
    return { ok: true as const, mensaje: 'Proveedor actualizado.' };
  });
}

export async function alternarActivoProveedor(fd: FormData): Promise<void> {
  await exigirPermiso('proveedores', 'editar');
  const id = String(fd.get('id'));
  const p = await prisma.proveedor.findUnique({ where: { id } });
  if (!p) return;
  await prisma.proveedor.update({ where: { id }, data: { activo: !p.activo } });
  revalidatePath('/proveedores');
}

export async function eliminarProveedor(fd: FormData): Promise<void> {
  await exigirPermiso('proveedores', 'eliminar');
  const id = String(fd.get('id'));

  const [gastos, productos] = await Promise.all([
    prisma.gasto.count({ where: { proveedorId: id } }),
    prisma.producto.count({ where: { proveedorId: id } }),
  ]);
  if (gastos > 0 || productos > 0) {
    throw new Error('El proveedor tiene gastos o productos asociados. Desactívalo en vez de eliminarlo.');
  }

  await prisma.proveedor.delete({ where: { id } });
  revalidatePath('/proveedores');
}
