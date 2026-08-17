import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { obtenerSesion, puede } from '@/lib/auth';
import { directorioSubidas } from '@/lib/uploads';

/**
 * Sirve un adjunto desde disco, verificando la sesión y el permiso del módulo
 * al que pertenece. Los archivos nunca se exponen como estáticos.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await params;
  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return new NextResponse('Archivo no encontrado', { status: 404 });

  // El módulo requerido depende de a qué entidad está vinculado el archivo.
  const modulo = adjunto.gastoId
    ? 'gastos'
    : adjunto.pagoId
      ? 'pagos'
      : adjunto.presupuestoId
        ? 'presupuestos'
        : 'historia_clinica';

  if (!puede(sesion, modulo, 'ver')) return new NextResponse('Sin permiso', { status: 403 });

  // `ruta` se genera internamente (uuid + subcarpeta año/mes); igual normalizamos
  // para descartar cualquier intento de salir del directorio de subidas.
  const raiz = path.resolve(directorioSubidas());
  const destino = path.resolve(raiz, adjunto.ruta);
  if (!destino.startsWith(raiz + path.sep)) {
    return new NextResponse('Ruta inválida', { status: 400 });
  }

  try {
    const contenido = await readFile(destino);
    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': adjunto.mimeType,
        'Content-Length': String(adjunto.tamanoBytes),
        'Content-Disposition': `inline; filename="${encodeURIComponent(adjunto.nombreOriginal)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('El archivo ya no está disponible en el servidor', { status: 410 });
  }
}
