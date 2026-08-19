import { NextResponse } from 'next/server';

import { obtenerSesion } from '@/lib/auth';
import { buscarGlobal } from '@/lib/busqueda';

/**
 * Alimenta el buscador rápido del teclado. La página `/buscar` hace lo mismo
 * sin depender de JavaScript; esto sólo existe para responder mientras se
 * escribe.
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return new NextResponse('No autorizado', { status: 401 });

  const consulta = new URL(request.url).searchParams.get('q') ?? '';
  const grupos = await buscarGlobal(consulta, sesion);

  return NextResponse.json({ grupos });
}
