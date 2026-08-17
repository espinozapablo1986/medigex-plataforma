import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';

import { prisma } from './prisma';
import { claveP, type Accion } from './permissions';

export const COOKIE_SESION = 'medic_session';

function secreto() {
  const valor = process.env.AUTH_SECRET;
  if (!valor || valor.length < 16) {
    throw new Error('AUTH_SECRET no está definido o es demasiado corto (mínimo 16 caracteres).');
  }
  return new TextEncoder().encode(valor);
}

function horasSesion() {
  return Number(process.env.SESSION_MAX_AGE_HOURS ?? 12);
}

// ─────────────────────────────────────────────────────────────
//  Contraseñas
// ─────────────────────────────────────────────────────────────

export async function hashPassword(plano: string) {
  return bcrypt.hash(plano, 12);
}

export async function verificarPassword(plano: string, hash: string) {
  return bcrypt.compare(plano, hash);
}

// ─────────────────────────────────────────────────────────────
//  Sesión
// ─────────────────────────────────────────────────────────────

export interface SesionUsuario {
  usuarioId: string;
  sesionId: string;
  email: string;
  nombres: string;
  apellidos: string;
  rolId: string;
  rolSlug: string;
  rolNombre: string;
  profesionalId: string | null;
  /** Set con claves "modulo.accion" permitidas. */
  permisos: Set<string>;
}

export async function crearSesion(usuarioId: string) {
  const expiraAt = new Date(Date.now() + horasSesion() * 60 * 60 * 1000);
  const jti = randomUUID();

  const hdrs = await headers();
  const sesion = await prisma.sesion.create({
    data: {
      usuarioId,
      token: jti,
      expiraAt,
      ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent')?.slice(0, 500) ?? null,
    },
  });

  const jwt = await new SignJWT({ sid: sesion.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuarioId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiraAt)
    .sign(secreto());

  const store = await cookies();
  store.set(COOKIE_SESION, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraAt,
  });

  await prisma.usuario.update({ where: { id: usuarioId }, data: { ultimoAccesoAt: new Date() } });
  return sesion;
}

export async function cerrarSesion() {
  const store = await cookies();
  const jwt = store.get(COOKIE_SESION)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, secreto());
      const sid = payload.sid as string | undefined;
      if (sid) await prisma.sesion.updateMany({ where: { id: sid }, data: { revocada: true } });
    } catch {
      // token inválido o expirado: basta con borrar la cookie
    }
  }
  store.delete(COOKIE_SESION);
}

/** Lee la sesión actual. Memoizada por request. */
export const obtenerSesion = cache(async (): Promise<SesionUsuario | null> => {
  const store = await cookies();
  const jwt = store.get(COOKIE_SESION)?.value;
  if (!jwt) return null;

  let sid: string;
  try {
    const { payload } = await jwtVerify(jwt, secreto());
    sid = payload.sid as string;
    if (!sid) return null;
  } catch {
    return null;
  }

  const sesion = await prisma.sesion.findUnique({
    where: { id: sid },
    include: {
      usuario: {
        include: {
          rol: { include: { permisos: true } },
          profesional: { select: { id: true } },
        },
      },
    },
  });

  if (!sesion || sesion.revocada || sesion.expiraAt < new Date()) return null;
  if (!sesion.usuario.activo || !sesion.usuario.rol.activo) return null;

  const permisos = new Set(
    sesion.usuario.rol.permisos.filter((p) => p.permitido).map((p) => claveP(p.modulo, p.accion)),
  );

  return {
    usuarioId: sesion.usuario.id,
    sesionId: sesion.id,
    email: sesion.usuario.email,
    nombres: sesion.usuario.nombres,
    apellidos: sesion.usuario.apellidos,
    rolId: sesion.usuario.rolId,
    rolSlug: sesion.usuario.rol.slug,
    rolNombre: sesion.usuario.rol.nombre,
    profesionalId: sesion.usuario.profesional?.id ?? null,
    permisos,
  };
});

/** Sesión obligatoria: redirige al login si no hay. */
export async function requerirSesion(): Promise<SesionUsuario> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  return sesion;
}

export function puede(sesion: SesionUsuario | null, modulo: string, accion: Accion = 'ver'): boolean {
  if (!sesion) return false;
  return sesion.permisos.has(claveP(modulo, accion));
}

/** Exige un permiso concreto; redirige a /sin-acceso si falta. */
export async function requerirPermiso(modulo: string, accion: Accion = 'ver'): Promise<SesionUsuario> {
  const sesion = await requerirSesion();
  if (!puede(sesion, modulo, accion)) redirect(`/sin-acceso?modulo=${modulo}&accion=${accion}`);
  return sesion;
}

/** Igual que requerirPermiso, pero lanza en vez de redirigir (para server actions). */
export async function exigirPermiso(modulo: string, accion: Accion = 'ver'): Promise<SesionUsuario> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  if (!puede(sesion, modulo, accion)) {
    throw new Error(`No tienes permiso para ${accion} en el módulo ${modulo}.`);
  }
  return sesion;
}

// ─────────────────────────────────────────────────────────────
//  Auditoría
// ─────────────────────────────────────────────────────────────

export async function auditar(opciones: {
  usuarioId?: string | null;
  accion: string;
  modulo: string;
  entidad?: string;
  entidadId?: string;
  detalle?: unknown;
}) {
  try {
    const hdrs = await headers();
    await prisma.registroAuditoria.create({
      data: {
        usuarioId: opciones.usuarioId ?? null,
        accion: opciones.accion,
        modulo: opciones.modulo,
        entidad: opciones.entidad,
        entidadId: opciones.entidadId,
        detalle: opciones.detalle === undefined ? undefined : JSON.parse(JSON.stringify(opciones.detalle)),
        ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });
  } catch {
    // la auditoría nunca debe romper la operación principal
  }
}
