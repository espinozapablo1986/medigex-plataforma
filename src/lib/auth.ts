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
export const COOKIE_VISTA_PREVIA = 'medigex_vista_previa';

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
  /**
   * Presente cuando un administrador está mirando la plataforma con los
   * permisos de otra cuenta. La identidad completa pasa a ser la del usuario
   * observado —incluido su profesional vinculado, para que la agenda y el
   * panel se vean igual que él los ve— y toda escritura queda bloqueada.
   */
  vistaPrevia?: {
    /** Quién está mirando de verdad. */
    administradorId: string;
    administradorNombre: string;
    observadoNombre: string;
    observadoEmail: string;
  };
}

/** En vista previa sólo se permite leer: escribir falsearía la autoría. */
export function esSoloLectura(sesion: SesionUsuario | null): boolean {
  return Boolean(sesion?.vistaPrevia);
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

  // Un inicio de sesión siempre empieza en la identidad propia: si quedó una
  // vista previa colgada de la sesión anterior, se descarta aquí.
  store.delete(COOKIE_VISTA_PREVIA);

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
  store.delete(COOKIE_VISTA_PREVIA);
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

  const propia: SesionUsuario = {
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

  // La vista previa se autoriza contra los permisos reales del administrador,
  // nunca contra los del usuario observado: si no, bastaría con entrar en
  // vista previa una vez para no poder salir o para encadenar saltos.
  const observadoId = store.get(COOKIE_VISTA_PREVIA)?.value;
  if (!observadoId || !permisos.has(claveP('usuarios', 'suplantar'))) return propia;

  const observado = await prisma.usuario.findUnique({
    where: { id: observadoId },
    include: {
      rol: { include: { permisos: true } },
      profesional: { select: { id: true } },
    },
  });
  if (!observado || !observado.activo) return propia;

  return {
    usuarioId: observado.id,
    sesionId: sesion.id,
    email: observado.email,
    nombres: observado.nombres,
    apellidos: observado.apellidos,
    rolId: observado.rolId,
    rolSlug: observado.rol.slug,
    rolNombre: observado.rol.nombre,
    profesionalId: observado.profesional?.id ?? null,
    permisos: new Set(
      observado.rol.permisos.filter((p) => p.permitido).map((p) => claveP(p.modulo, p.accion)),
    ),
    vistaPrevia: {
      administradorId: sesion.usuario.id,
      administradorNombre: `${sesion.usuario.nombres} ${sesion.usuario.apellidos}`,
      observadoNombre: `${observado.nombres} ${observado.apellidos}`,
      observadoEmail: observado.email,
    },
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

  // El bloqueo va antes que la comprobación de permisos: en vista previa no
  // se escribe aunque el rol observado tuviera la atribución.
  if (sesion.vistaPrevia && accion !== 'ver') {
    throw new Error(
      `Estás viendo la plataforma como ${sesion.vistaPrevia.observadoNombre}. La vista previa es de sólo lectura: sal de ella para poder ${accion}.`,
    );
  }

  if (!puede(sesion, modulo, accion)) {
    throw new Error(`No tienes permiso para ${accion} en el módulo ${modulo}.`);
  }
  return sesion;
}

// ─────────────────────────────────────────────────────────────
//  Vista previa como otro usuario
// ─────────────────────────────────────────────────────────────

export async function iniciarVistaPrevia(usuarioId: string) {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error('Sesión expirada.');
  if (sesion.vistaPrevia) throw new Error('Ya estás en vista previa. Sal de ella antes de cambiar de usuario.');
  if (!puede(sesion, 'usuarios', 'suplantar')) {
    throw new Error('Tu perfil no permite ver la plataforma como otro usuario.');
  }
  if (usuarioId === sesion.usuarioId) throw new Error('Esa es tu propia cuenta.');

  const observado = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { rol: true } });
  if (!observado) throw new Error('El usuario no existe.');
  if (!observado.activo) throw new Error('Esa cuenta está desactivada.');

  const store = await cookies();
  store.set(COOKIE_VISTA_PREVIA, usuarioId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Dura poco a propósito: es para comprobar, no para trabajar.
    maxAge: 60 * 60,
  });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'vista_previa_inicio',
    modulo: 'usuarios',
    entidad: 'Usuario',
    entidadId: usuarioId,
    detalle: { observado: observado.email, rol: observado.rol.nombre },
  });
}

export async function terminarVistaPrevia() {
  // Se lee la sesión antes de borrar la cookie para saber quién es el
  // administrador de verdad; así el registro queda a su nombre y no al del
  // usuario observado.
  const sesion = await obtenerSesion();

  const store = await cookies();
  store.delete(COOKIE_VISTA_PREVIA);

  if (sesion?.vistaPrevia) {
    await auditar({
      usuarioId: sesion.vistaPrevia.administradorId,
      accion: 'vista_previa_fin',
      modulo: 'usuarios',
      entidad: 'Usuario',
      entidadId: sesion.usuarioId,
      detalle: { observado: sesion.vistaPrevia.observadoEmail },
    });
  }
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
