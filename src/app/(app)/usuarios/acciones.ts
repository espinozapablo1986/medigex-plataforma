'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso, hashPassword } from '@/lib/auth';
import { normalizarRut, validarRut } from '@/lib/format';
import { intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

function validarPassword(valor: string) {
  if (valor.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
}

export async function crearUsuario(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('usuarios', 'crear');

    const email = requerido(fd, 'email', 'Correo').toLowerCase();
    const password = requerido(fd, 'password', 'Contraseña');
    validarPassword(password);

    const rut = textoOpcional(fd, 'rut');
    if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

    if (await prisma.usuario.findUnique({ where: { email } })) {
      throw new Error('Ya existe un usuario con ese correo.');
    }

    const profesionalId = textoOpcional(fd, 'profesionalId');

    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        nombres: requerido(fd, 'nombres', 'Nombres'),
        apellidos: requerido(fd, 'apellidos', 'Apellidos'),
        rut: rut ? normalizarRut(rut) : null,
        telefono: textoOpcional(fd, 'telefono'),
        rolId: requerido(fd, 'rolId', 'Rol'),
        debeCambiarPassword: true,
      },
    });

    // Vincula la cuenta con una ficha de profesional para que vea "su" agenda.
    if (profesionalId) {
      await prisma.profesional.update({ where: { id: profesionalId }, data: { usuarioId: usuario.id } });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'usuarios',
      entidad: 'Usuario',
      entidadId: usuario.id,
      detalle: { email },
    });

    revalidatePath('/usuarios');
    return { ok: true as const, mensaje: `Usuario ${email} creado.` };
  });
}

export async function editarUsuario(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('usuarios', 'editar');
    const id = requerido(fd, 'id', 'Usuario');

    const rut = textoOpcional(fd, 'rut');
    if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

    const email = requerido(fd, 'email', 'Correo').toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente && existente.id !== id) throw new Error('Ese correo ya está en uso por otro usuario.');

    await prisma.usuario.update({
      where: { id },
      data: {
        email,
        nombres: requerido(fd, 'nombres', 'Nombres'),
        apellidos: requerido(fd, 'apellidos', 'Apellidos'),
        rut: rut ? normalizarRut(rut) : null,
        telefono: textoOpcional(fd, 'telefono'),
        rolId: requerido(fd, 'rolId', 'Rol'),
      },
    });

    // Reasigna el vínculo con la ficha de profesional
    const profesionalId = textoOpcional(fd, 'profesionalId');
    await prisma.profesional.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } });
    if (profesionalId) {
      await prisma.profesional.update({ where: { id: profesionalId }, data: { usuarioId: id } });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'usuarios',
      entidad: 'Usuario',
      entidadId: id,
    });

    revalidatePath('/usuarios');
    return { ok: true as const, mensaje: 'Usuario actualizado.' };
  });
}

export async function cambiarPassword(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('usuarios', 'editar');
    const id = requerido(fd, 'id', 'Usuario');
    const password = requerido(fd, 'password', 'Nueva contraseña');
    const confirmacion = texto(fd, 'confirmacion');

    validarPassword(password);
    if (password !== confirmacion) throw new Error('Las contraseñas no coinciden.');

    await prisma.usuario.update({
      where: { id },
      data: { passwordHash: await hashPassword(password), debeCambiarPassword: true },
    });

    // Cierra las sesiones abiertas del usuario afectado.
    await prisma.sesion.updateMany({ where: { usuarioId: id, revocada: false }, data: { revocada: true } });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'cambiar_password',
      modulo: 'usuarios',
      entidad: 'Usuario',
      entidadId: id,
    });

    revalidatePath('/usuarios');
    return { ok: true as const, mensaje: 'Contraseña restablecida. El usuario deberá volver a iniciar sesión.' };
  });
}

export async function alternarActivoUsuario(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('usuarios', 'editar');
  const id = String(fd.get('id'));

  if (id === sesion.usuarioId) throw new Error('No puedes desactivar tu propia cuenta.');

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return;

  await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } });
  if (usuario.activo) {
    await prisma.sesion.updateMany({ where: { usuarioId: id, revocada: false }, data: { revocada: true } });
  }

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: usuario.activo ? 'desactivar' : 'activar',
    modulo: 'usuarios',
    entidad: 'Usuario',
    entidadId: id,
  });
  revalidatePath('/usuarios');
}

export async function eliminarUsuario(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('usuarios', 'eliminar');
  const id = String(fd.get('id'));
  if (id === sesion.usuarioId) throw new Error('No puedes eliminar tu propia cuenta.');

  await prisma.profesional.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } });
  await prisma.usuario.delete({ where: { id } });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'usuarios',
    entidad: 'Usuario',
    entidadId: id,
  });
  revalidatePath('/usuarios');
}
