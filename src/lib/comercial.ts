import 'server-only';

import type { TipoComision } from '@prisma/client';
import { prisma } from './prisma';

/** Tasa de IVA vigente, leída de la configuración del centro. */
export async function tasaIva(): Promise<number> {
  const config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } });
  return (config?.ivaPorcentaje ?? 19) / 100;
}

// ─────────────────────────────────────────────────────────────
//  Totales de un documento (presupuesto o venta)
// ─────────────────────────────────────────────────────────────

export interface LineaDocumento {
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  afectoIva: boolean;
}

export interface TotalesDocumento {
  subtotal: number;
  descuentoMonto: number;
  neto: number;
  iva: number;
  total: number;
}

/**
 * Calcula los totales de un documento comercial.
 *
 * Los precios de lista en Chile se manejan con IVA incluido, así que el total
 * es la suma de las líneas y el neto se obtiene desglosando hacia atrás.
 * El descuento global se aplica sobre el total ya sumado.
 */
export function calcularTotales(
  lineas: LineaDocumento[],
  opciones: { iva: number; descuentoPorcentaje?: number; descuentoMonto?: number },
): TotalesDocumento {
  const subtotal = lineas.reduce(
    (acc, l) => acc + Math.round(l.cantidad * l.precioUnitario) - Math.round(l.descuento),
    0,
  );

  const descuentoMonto =
    opciones.descuentoMonto && opciones.descuentoMonto > 0
      ? Math.round(opciones.descuentoMonto)
      : Math.round((subtotal * (opciones.descuentoPorcentaje ?? 0)) / 100);

  const total = Math.max(0, subtotal - descuentoMonto);

  // Proporción de las líneas afectas a IVA dentro del subtotal
  const brutoAfecto = lineas
    .filter((l) => l.afectoIva)
    .reduce((acc, l) => acc + Math.round(l.cantidad * l.precioUnitario) - Math.round(l.descuento), 0);

  const proporcionAfecta = subtotal > 0 ? brutoAfecto / subtotal : 0;
  const totalAfecto = Math.round(total * proporcionAfecta);
  const netoAfecto = opciones.iva > 0 ? Math.round(totalAfecto / (1 + opciones.iva)) : totalAfecto;
  const iva = totalAfecto - netoAfecto;
  const neto = total - iva;

  return { subtotal, descuentoMonto, neto, iva, total };
}

/** Calcula el total de una línea aplicando su descuento. */
export function totalLinea(cantidad: number, precioUnitario: number, descuento: number) {
  return Math.max(0, Math.round(cantidad * precioUnitario) - Math.round(descuento));
}

// ─────────────────────────────────────────────────────────────
//  Convenios: precio y cobertura
// ─────────────────────────────────────────────────────────────

export interface ResultadoConvenio {
  precio: number;
  cobertura: number;
  copago: number;
  codigoPrestacion: string | null;
}

/**
 * Precio y cobertura de un servicio bajo un convenio.
 * Prioridad: tarifa negociada del servicio → descuento general del convenio.
 */
export async function aplicarConvenio(
  servicioId: string,
  precioLista: number,
  cantidad: number,
  convenioId?: string | null,
): Promise<ResultadoConvenio> {
  const bruto = Math.round(precioLista * cantidad);
  if (!convenioId) {
    return { precio: precioLista, cobertura: 0, copago: bruto, codigoPrestacion: null };
  }

  const [convenio, tarifa] = await Promise.all([
    prisma.convenio.findUnique({ where: { id: convenioId } }),
    prisma.convenioServicio.findUnique({
      where: { convenioId_servicioId: { convenioId, servicioId } },
    }),
  ]);

  if (!convenio || !convenio.activo) {
    return { precio: precioLista, cobertura: 0, copago: bruto, codigoPrestacion: null };
  }

  const precio =
    tarifa && tarifa.precioConvenio > 0
      ? tarifa.precioConvenio
      : Math.round(precioLista * (1 - convenio.descuentoPorcentaje / 100));

  const porcentajeCobertura =
    tarifa && tarifa.coberturaPorcentaje > 0 ? tarifa.coberturaPorcentaje : convenio.coberturaPorcentaje;

  let cobertura = Math.round((precio * cantidad * porcentajeCobertura) / 100);
  if (convenio.topePorPrestacion > 0) {
    cobertura = Math.min(cobertura, convenio.topePorPrestacion * cantidad);
  }

  const totalLineaConvenio = Math.round(precio * cantidad);
  cobertura = Math.min(cobertura, totalLineaConvenio);

  return {
    precio,
    cobertura,
    copago: totalLineaConvenio - cobertura,
    codigoPrestacion: tarifa?.codigoPrestacion ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
//  Honorario del profesional
// ─────────────────────────────────────────────────────────────

export interface ResultadoComision {
  tipo: TipoComision;
  porcentaje: number;
  monto: number;
  origen: 'comision_por_servicio' | 'servicio' | 'profesional' | 'sin_comision';
}

/**
 * Determina el honorario del profesional por una prestación.
 *
 * Prioridad de las reglas, de mayor a menor:
 *  1. Comisión pactada para ese profesional en ese servicio.
 *  2. Comisión definida en el servicio.
 *  3. Comisión general del profesional.
 *
 * Cada regla puede ser un porcentaje sobre lo cobrado o un monto fijo por
 * prestación (multiplicado por la cantidad realizada).
 */
export async function calcularComision(opciones: {
  profesionalId?: string | null;
  servicioId?: string | null;
  /** Monto cobrado por la línea, ya con descuentos aplicados. */
  montoLinea: number;
  cantidad: number;
}): Promise<ResultadoComision> {
  const { profesionalId, servicioId, montoLinea, cantidad } = opciones;
  const sinComision: ResultadoComision = {
    tipo: 'PORCENTAJE',
    porcentaje: 0,
    monto: 0,
    origen: 'sin_comision',
  };

  if (!profesionalId) return sinComision;

  const [profesional, servicio, especifica] = await Promise.all([
    prisma.profesional.findUnique({ where: { id: profesionalId } }),
    servicioId ? prisma.servicio.findUnique({ where: { id: servicioId } }) : null,
    profesionalId && servicioId
      ? prisma.comisionServicio.findUnique({
          where: { profesionalId_servicioId: { profesionalId, servicioId } },
        })
      : null,
  ]);

  if (!profesional) return sinComision;
  // Un profesional a sueldo o que sólo arrienda box no genera comisión.
  if (profesional.modeloPago === 'SUELDO' || profesional.modeloPago === 'ARRIENDO') return sinComision;

  const desde = (tipo: TipoComision, porcentaje: number, montoFijo: number, origen: ResultadoComision['origen']) => ({
    tipo,
    porcentaje: tipo === 'PORCENTAJE' ? porcentaje : 0,
    monto:
      tipo === 'MONTO_FIJO'
        ? Math.round(montoFijo * cantidad)
        : Math.round((montoLinea * porcentaje) / 100),
    origen,
  });

  if (especifica) {
    return desde(especifica.tipo, especifica.porcentaje, especifica.montoFijo, 'comision_por_servicio');
  }

  if (servicio && (servicio.comisionPorcentaje !== null || servicio.comisionMontoFijo > 0)) {
    return desde(
      servicio.comisionTipo,
      servicio.comisionPorcentaje ?? 0,
      servicio.comisionMontoFijo,
      'servicio',
    );
  }

  return desde(
    profesional.comisionTipo,
    profesional.comisionPorcentaje,
    profesional.comisionMontoFijo,
    'profesional',
  );
}

// ─────────────────────────────────────────────────────────────
//  Folios
// ─────────────────────────────────────────────────────────────

/** Etiqueta legible de un documento, ej. "Venta Nº 1042". */
export function folio(prefijo: string, numero: number) {
  return `${prefijo} Nº ${numero}`;
}
