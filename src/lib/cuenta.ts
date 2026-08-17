import 'server-only';

import type { Prisma, TipoMovimientoCuenta } from '@prisma/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

/**
 * Cuenta corriente del paciente.
 *
 * Convención de signos: los CARGOS suman (el paciente debe más) y los ABONOS
 * restan. `saldoResultante` guarda el saldo acumulado tras cada movimiento,
 * de modo que la cartola se puede leer sin recalcular toda la historia.
 *
 * Saldo positivo = el paciente debe. Saldo negativo = tiene saldo a favor.
 */
export async function registrarMovimientoCuenta(
  tx: Tx,
  datos: {
    pacienteId: string;
    tipo: TipoMovimientoCuenta;
    descripcion: string;
    /** Siempre positivo; el tipo define si suma o resta. */
    monto: number;
    ventaId?: string | null;
    pagoId?: string | null;
    fecha?: Date;
  },
) {
  const ultimo = await tx.movimientoCuenta.findFirst({
    where: { pacienteId: datos.pacienteId },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    select: { saldoResultante: true },
  });

  const signo = datos.tipo === 'CARGO' ? 1 : -1;
  const monto = Math.abs(Math.round(datos.monto)) * signo;
  const saldoResultante = (ultimo?.saldoResultante ?? 0) + monto;

  return tx.movimientoCuenta.create({
    data: {
      pacienteId: datos.pacienteId,
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      monto,
      saldoResultante,
      ventaId: datos.ventaId ?? null,
      pagoId: datos.pagoId ?? null,
      fecha: datos.fecha ?? new Date(),
    },
  });
}

/** Saldo actual del paciente (positivo = debe). */
export async function saldoPaciente(pacienteId: string): Promise<number> {
  const ultimo = await prisma.movimientoCuenta.findFirst({
    where: { pacienteId },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    select: { saldoResultante: true },
  });
  return ultimo?.saldoResultante ?? 0;
}

/**
 * Recalcula toda la cartola de un paciente en orden cronológico.
 * Se usa tras anular documentos para dejar los saldos consistentes.
 */
export async function recalcularCuenta(tx: Tx, pacienteId: string) {
  const movimientos = await tx.movimientoCuenta.findMany({
    where: { pacienteId },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, monto: true },
  });

  let saldo = 0;
  for (const movimiento of movimientos) {
    saldo += movimiento.monto;
    await tx.movimientoCuenta.update({
      where: { id: movimiento.id },
      data: { saldoResultante: saldo },
    });
  }
  return saldo;
}

/** Actualiza `pagado`, `saldo` y `estado` de una venta según sus pagos confirmados. */
export async function refrescarEstadoVenta(tx: Tx, ventaId: string) {
  const venta = await tx.venta.findUnique({
    where: { id: ventaId },
    include: { pagos: { where: { estado: 'CONFIRMADO' } } },
  });
  if (!venta || venta.estado === 'ANULADA') return;

  const pagado = venta.pagos.reduce((acc, p) => acc + p.monto, 0);
  const saldo = venta.total - pagado;

  await tx.venta.update({
    where: { id: ventaId },
    data: {
      pagado,
      saldo,
      estado: saldo <= 0 ? 'PAGADA' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE',
    },
  });
}
