import { NextResponse } from 'next/server';

import { terminarVistaPrevia } from '@/lib/auth';

/**
 * Salida de la vista previa.
 *
 * Es una ruta suelta y sin comprobación de permisos a propósito: mientras dura
 * la vista previa el administrador tiene los permisos del usuario observado, y
 * ese usuario podría no ver el módulo de Usuarios. Si la salida viviera dentro
 * de ese módulo, quedaría atrapado hasta que caduque la cookie.
 */
export async function POST(request: Request) {
  await terminarVistaPrevia();
  return NextResponse.redirect(new URL('/usuarios', request.url), { status: 303 });
}
