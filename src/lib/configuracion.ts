import 'server-only';

import { cache } from 'react';

import { prisma } from './prisma';

/** Configuración de la clínica, memoizada por petición. */
export const configuracionClinica = cache(async () =>
  prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
);

/**
 * Nombre con el que el centro se presenta en los mensajes.
 * El respaldo evita un «te saludamos de undefined» si aún no se configura.
 */
export const nombreDelCentro = cache(async () => {
  const config = await configuracionClinica();
  return config?.nombreClinica?.trim() || 'nuestro centro';
});
