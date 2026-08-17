'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auditar, crearSesion, verificarPassword } from '@/lib/auth';
import { intentar, requerido, texto, type Resultado } from '@/lib/resultado';

export async function iniciarSesion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  const resultado = await intentar(async () => {
    const email = requerido(fd, 'email', 'Correo').toLowerCase();
    const password = requerido(fd, 'password', 'Contraseña');

    const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });

    // Mensaje genérico: no revelamos si el correo existe o no.
    const credencialesInvalidas = new Error('Correo o contraseña incorrectos.');
    if (!usuario) throw credencialesInvalidas;

    const valida = await verificarPassword(password, usuario.passwordHash);
    if (!valida) {
      await auditar({ usuarioId: usuario.id, accion: 'login_fallido', modulo: 'usuarios' });
      throw credencialesInvalidas;
    }

    if (!usuario.activo) throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
    if (!usuario.rol.activo) throw new Error('Tu perfil de acceso está desactivado. Contacta al administrador.');

    await crearSesion(usuario.id);
    await auditar({ usuarioId: usuario.id, accion: 'login', modulo: 'usuarios' });
  });

  if (!resultado.ok) return resultado;

  const siguiente = texto(fd, 'siguiente');
  redirect(siguiente && siguiente.startsWith('/') ? siguiente : '/');
}
