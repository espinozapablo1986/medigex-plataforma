import 'server-only';

import type { Prisma, TipoMovimientoStock } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const SUMAN: TipoMovimientoStock[] = ['ENTRADA', 'DEVOLUCION', 'INVENTARIO_INICIAL'];
const RESTAN: TipoMovimientoStock[] = ['SALIDA', 'MERMA', 'CONSUMO_SERVICIO', 'VENTA'];

/**
 * Registra un movimiento de stock y actualiza el saldo del producto.
 *
 * - ENTRADA / DEVOLUCION / INVENTARIO_INICIAL suman.
 * - SALIDA / MERMA / CONSUMO_SERVICIO / VENTA restan.
 * - AJUSTE deja el stock exactamente en `cantidad`.
 *
 * En las entradas recalcula el costo promedio ponderado.
 */
export async function moverStock(
  tx: Tx,
  datos: {
    productoId: string;
    tipo: TipoMovimientoStock;
    cantidad: number;
    costoUnitario?: number;
    motivo?: string | null;
    referenciaTipo?: string | null;
    referenciaId?: string | null;
    lote?: string | null;
    fechaVencimiento?: Date | null;
    usuarioId?: string | null;
    /** Si es false, permite dejar el stock en negativo (útil en migraciones). */
    validarStock?: boolean;
  },
) {
  const producto = await tx.producto.findUnique({ where: { id: datos.productoId } });
  if (!producto) throw new Error('El producto no existe.');

  const cantidad = Math.abs(datos.cantidad);
  // En un AJUSTE la cantidad es el stock final, y dejar un producto en cero es
  // un resultado legítimo —de hecho el más común tras un conteo físico—. En
  // los demás tipos, un movimiento de cero unidades no significa nada.
  if (cantidad === 0 && datos.tipo !== 'AJUSTE') {
    throw new Error('La cantidad del movimiento debe ser distinta de cero.');
  }
  if (datos.tipo === 'AJUSTE' && datos.cantidad < 0) {
    throw new Error('El stock ajustado no puede ser negativo.');
  }

  const stockAnterior = producto.stockActual;
  let stockResultante: number;

  if (datos.tipo === 'AJUSTE') {
    stockResultante = datos.cantidad; // en un ajuste la cantidad es el stock final
  } else if (SUMAN.includes(datos.tipo)) {
    stockResultante = stockAnterior + cantidad;
  } else if (RESTAN.includes(datos.tipo)) {
    stockResultante = stockAnterior - cantidad;
    if (datos.validarStock !== false && stockResultante < 0) {
      throw new Error(
        `Stock insuficiente de "${producto.nombre}": disponible ${stockAnterior}, se intenta descontar ${cantidad}.`,
      );
    }
  } else {
    stockResultante = stockAnterior;
  }

  // Costo promedio ponderado sólo en entradas con costo informado
  let costoPromedio = producto.costoPromedio;
  if (SUMAN.includes(datos.tipo) && datos.costoUnitario && datos.costoUnitario > 0) {
    const valorAnterior = stockAnterior * producto.costoPromedio;
    const valorEntrada = cantidad * datos.costoUnitario;
    const unidades = stockAnterior + cantidad;
    costoPromedio = unidades > 0 ? Math.round((valorAnterior + valorEntrada) / unidades) : datos.costoUnitario;
  }

  await tx.producto.update({
    where: { id: datos.productoId },
    data: { stockActual: stockResultante, costoPromedio },
  });

  return tx.movimientoStock.create({
    data: {
      productoId: datos.productoId,
      tipo: datos.tipo,
      cantidad,
      costoUnitario: datos.costoUnitario ?? producto.costoPromedio,
      stockAnterior,
      stockResultante,
      motivo: datos.motivo ?? null,
      referenciaTipo: datos.referenciaTipo ?? null,
      referenciaId: datos.referenciaId ?? null,
      lote: datos.lote ?? null,
      fechaVencimiento: datos.fechaVencimiento ?? null,
      usuarioId: datos.usuarioId ?? null,
    },
  });
}

/**
 * Descuenta del inventario los insumos configurados para un servicio.
 * Se llama al registrar una atención o al cerrar una venta.
 */
export async function consumirInsumosDeServicio(
  tx: Tx,
  opciones: {
    servicioId: string;
    veces?: number;
    referenciaTipo: string;
    referenciaId: string;
    usuarioId?: string | null;
  },
) {
  const insumos = await tx.insumoServicio.findMany({
    where: { servicioId: opciones.servicioId },
    include: { producto: { select: { nombre: true, activo: true } } },
  });

  const veces = opciones.veces ?? 1;
  const consumidos: string[] = [];

  for (const insumo of insumos) {
    if (!insumo.producto.activo) continue;
    await moverStock(tx, {
      productoId: insumo.productoId,
      tipo: 'CONSUMO_SERVICIO',
      cantidad: insumo.cantidad * veces,
      motivo: 'Consumo automático por servicio realizado',
      referenciaTipo: opciones.referenciaTipo,
      referenciaId: opciones.referenciaId,
      usuarioId: opciones.usuarioId,
      // No bloqueamos la atención clínica por falta de stock: queda en negativo
      // y aparece en las alertas de inventario para su regularización.
      validarStock: false,
    });
    consumidos.push(insumo.producto.nombre);
  }

  return consumidos;
}
