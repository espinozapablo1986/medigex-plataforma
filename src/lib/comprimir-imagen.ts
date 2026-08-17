/**
 * Compresión de imágenes en el navegador, antes de subirlas.
 *
 * Una foto de un teléfono actual pesa entre 3 y 8 MB. Para una fotografía
 * clínica o el respaldo de un examen eso es desproporcionado: consume la
 * cuota de subida, llena el disco del servidor y hace lenta la ficha del
 * paciente. Redimensionando a 2400 px de lado mayor y recodificando en WebP
 * se baja a 200–600 KB sin pérdida visible en pantalla ni al imprimir.
 */

export interface OpcionesCompresion {
  /** Lado mayor máximo en píxeles. Nunca agranda una imagen pequeña. */
  ladoMaximo: number;
  /** 0 a 1. Sobre 0,9 el archivo crece mucho sin ganancia perceptible. */
  calidad: number;
}

export const COMPRESION_ESTANDAR: OpcionesCompresion = { ladoMaximo: 2400, calidad: 0.85 };

/** Para radiografías y fotos donde importa el detalle fino. */
export const COMPRESION_ALTA_FIDELIDAD: OpcionesCompresion = { ladoMaximo: 3500, calidad: 0.94 };

export interface ResultadoCompresion {
  archivo: File;
  tamanoOriginal: number;
  tamanoFinal: number;
  ancho: number;
  alto: number;
  seComprimio: boolean;
}

export function esImagenComprimible(archivo: File) {
  // HEIC de iPhone no lo decodifica canvas en todos los navegadores; se sube
  // tal cual y el servidor lo guarda sin tocar.
  return /^image\/(jpeg|png|webp)$/.test(archivo.type);
}

/** Elige el mejor formato de salida disponible en el navegador. */
function formatoSalida(): { tipo: string; extension: string } {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1;
  lienzo.height = 1;
  const soportaWebp = lienzo.toDataURL('image/webp').startsWith('data:image/webp');
  return soportaWebp ? { tipo: 'image/webp', extension: 'webp' } : { tipo: 'image/jpeg', extension: 'jpg' };
}

function cambiarExtension(nombre: string, extension: string) {
  const base = nombre.replace(/\.[^.]+$/, '');
  return `${base}.${extension}`;
}

/**
 * Redimensiona y recodifica una imagen. Si el resultado no es más liviano
 * que el original —cosa que pasa con imágenes ya optimizadas o muy
 * pequeñas—, devuelve el archivo original sin tocar.
 */
export async function comprimirImagen(
  archivo: File,
  opciones: OpcionesCompresion = COMPRESION_ESTANDAR,
): Promise<ResultadoCompresion> {
  const sinCambios = (): ResultadoCompresion => ({
    archivo,
    tamanoOriginal: archivo.size,
    tamanoFinal: archivo.size,
    ancho: 0,
    alto: 0,
    seComprimio: false,
  });

  if (!esImagenComprimible(archivo)) return sinCambios();

  let bitmap: ImageBitmap;
  try {
    // `from-image` respeta la orientación EXIF: sin esto, las fotos tomadas
    // en vertical con el teléfono quedan acostadas.
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    return sinCambios();
  }

  const escala = Math.min(1, opciones.ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) {
    bitmap.close();
    return sinCambios();
  }

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const { tipo, extension } = formatoSalida();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, tipo, opciones.calidad),
  );

  if (!blob || blob.size >= archivo.size) {
    return { ...sinCambios(), ancho, alto };
  }

  return {
    archivo: new File([blob], cambiarExtension(archivo.name, extension), {
      type: tipo,
      lastModified: Date.now(),
    }),
    tamanoOriginal: archivo.size,
    tamanoFinal: blob.size,
    ancho,
    alto,
    seComprimio: true,
  };
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
