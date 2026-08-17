import type { Periodicidad } from '@prisma/client';

const DIAS_POR_PERIODO: Record<Periodicidad, number> = {
  UNICA: 0,
  DIARIA: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
  BIMESTRAL: 60,
  TRIMESTRAL: 90,
  SEMESTRAL: 180,
  ANUAL: 365,
};

/**
 * Cuántos períodos de arriendo caben en el rango liquidado.
 *
 * Ej.: un arriendo mensual liquidado del 1 al 30 de junio → 1 período.
 * Si el contrato empieza o termina dentro del rango, se prorratea por días.
 */
export function periodosEnRango(
  periodicidad: Periodicidad,
  desde: Date,
  hasta: Date,
  vigenteDesde: Date,
  vigenteHasta: Date | null,
): number {
  const dias = DIAS_POR_PERIODO[periodicidad];
  if (dias === 0) return 1; // arriendo de pago único

  const inicio = vigenteDesde > desde ? vigenteDesde : desde;
  const fin = vigenteHasta && vigenteHasta < hasta ? vigenteHasta : hasta;
  if (fin < inicio) return 0;

  const diasCubiertos = Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
  return Math.round((diasCubiertos / dias) * 100) / 100;
}
