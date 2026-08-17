import 'server-only';

import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import type { CategoriaAdjunto } from '@prisma/client';
import { prisma } from './prisma';

const TIPOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/dicom',
]);

export function directorioSubidas() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads');
}

function maxBytes() {
  return Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
}

export interface VinculoAdjunto {
  pacienteId?: string;
  atencionId?: string;
  examenId?: string;
  pagoId?: string;
  gastoId?: string;
  presupuestoId?: string;
}

/**
 * Guarda un archivo en disco (bajo `UPLOAD_DIR/<año>/<mes>/`) y crea el
 * registro `Adjunto` asociado a la entidad indicada.
 */
export async function guardarAdjunto(opciones: {
  archivo: File;
  categoria: CategoriaAdjunto;
  descripcion?: string;
  subidoPorId?: string;
  vinculo: VinculoAdjunto;
}) {
  const { archivo, categoria, descripcion, subidoPorId, vinculo } = opciones;

  if (!archivo || archivo.size === 0) throw new Error('El archivo está vacío.');
  if (archivo.size > maxBytes()) {
    throw new Error(`El archivo supera el máximo de ${process.env.MAX_UPLOAD_MB ?? 20} MB.`);
  }
  if (archivo.type && !TIPOS_PERMITIDOS.has(archivo.type)) {
    throw new Error(`Tipo de archivo no permitido: ${archivo.type}`);
  }

  const ahora = new Date();
  const subcarpeta = path.join(String(ahora.getFullYear()), String(ahora.getMonth() + 1).padStart(2, '0'));
  const carpeta = path.join(directorioSubidas(), subcarpeta);
  await mkdir(carpeta, { recursive: true });

  const extension = path.extname(archivo.name).slice(0, 10) || '';
  const nombreArchivo = `${randomUUID()}${extension}`;
  const rutaAbsoluta = path.join(carpeta, nombreArchivo);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  await writeFile(rutaAbsoluta, buffer);

  return prisma.adjunto.create({
    data: {
      categoria,
      nombreArchivo,
      nombreOriginal: archivo.name.slice(0, 255),
      mimeType: archivo.type || 'application/octet-stream',
      tamanoBytes: archivo.size,
      ruta: path.join(subcarpeta, nombreArchivo),
      descripcion,
      subidoPorId,
      ...vinculo,
    },
  });
}

export async function eliminarAdjunto(id: string) {
  const adjunto = await prisma.adjunto.findUnique({ where: { id } });
  if (!adjunto) return;
  try {
    await unlink(path.join(directorioSubidas(), adjunto.ruta));
  } catch {
    // el archivo ya no existe en disco; igual borramos el registro
  }
  await prisma.adjunto.delete({ where: { id } });
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function esImagen(mimeType: string) {
  return mimeType.startsWith('image/');
}
