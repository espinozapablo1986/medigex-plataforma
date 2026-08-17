import { z } from 'zod';
import { texto } from './resultado';

/** Estructura de las líneas que envía el editor de ítems del navegador. */
const esquemaItem = z.object({
  tipo: z.enum(['SERVICIO', 'PRODUCTO', 'OTRO']),
  servicioId: z.string().nullable(),
  productoId: z.string().nullable(),
  profesionalId: z.string().nullable().optional(),
  descripcion: z.string().min(1, 'Cada línea necesita una descripción.'),
  piezaDental: z.string().optional().default(''),
  cantidad: z.number().positive('La cantidad debe ser mayor que cero.'),
  precioUnitario: z.number().min(0, 'El precio no puede ser negativo.'),
  descuento: z.number().min(0, 'El descuento no puede ser negativo.'),
  afectoIva: z.boolean(),
});

export type ItemDocumento = z.infer<typeof esquemaItem>;

/**
 * Lee y valida el campo `items` del formulario. Nunca se confía en los
 * totales calculados en el navegador: aquí sólo se validan las líneas y
 * el servidor recalcula los montos.
 */
export function leerItems(fd: FormData): ItemDocumento[] {
  const crudo = texto(fd, 'items');
  if (!crudo) throw new Error('El documento debe tener al menos una línea.');

  let parseado: unknown;
  try {
    parseado = JSON.parse(crudo);
  } catch {
    throw new Error('No se pudieron leer las líneas del documento.');
  }

  const resultado = z
    .array(esquemaItem)
    .min(1, 'El documento debe tener al menos una línea.')
    .safeParse(parseado);

  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? 'Las líneas del documento no son válidas.');
  }
  return resultado.data;
}
