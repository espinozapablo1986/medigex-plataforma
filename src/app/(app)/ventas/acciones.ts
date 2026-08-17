'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { TipoDocumento } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { aplicarConvenio, calcularComision, calcularTotales, tasaIva, totalLinea } from '@/lib/comercial';
import { recalcularCuenta, refrescarEstadoVenta, registrarMovimientoCuenta } from '@/lib/cuenta';
import { consumirInsumosDeServicio, moverStock } from '@/lib/inventario';
import { leerItems } from '@/lib/items';
import { guardarAdjunto } from '@/lib/uploads';
import {
  decimal,
  entero,
  fecha,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const DOCUMENTOS: TipoDocumento[] = ['NINGUNO', 'BOLETA', 'FACTURA', 'BOLETA_EXENTA', 'NOTA_CREDITO'];

// ═══════════════════════════════════════════════════════════════
//  Ventas
// ═══════════════════════════════════════════════════════════════

export async function crearVenta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevaId = '';
  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('ventas', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const items = leerItems(fd);
    const iva = await tasaIva();
    const descuentoPorcentaje = decimal(fd, 'descuentoPorcentaje');
    const tipoDocumento = texto(fd, 'tipoDocumento') as TipoDocumento;

    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) throw new Error('El paciente no existe.');

    const profesionalCabecera = textoOpcional(fd, 'profesionalId');
    const presupuestoId = textoOpcional(fd, 'presupuestoId');
    const convenioId = textoOpcional(fd, 'convenioId') ?? paciente.convenioId;

    // Resolvemos precio de convenio, comisión y cobertura de cada línea.
    const lineas = await Promise.all(
      items.map(async (item) => {
        const profesionalId = item.profesionalId ?? profesionalCabecera ?? null;

        let precioUnitario = item.precioUnitario;
        let montoCobertura = 0;
        let codigoPrestacion: string | null = null;

        if (item.tipo === 'SERVICIO' && item.servicioId && convenioId) {
          const conv = await aplicarConvenio(item.servicioId, item.precioUnitario, item.cantidad, convenioId);
          precioUnitario = conv.precio;
          montoCobertura = conv.cobertura;
          codigoPrestacion = conv.codigoPrestacion;
        }

        const total = totalLinea(item.cantidad, precioUnitario, item.descuento);

        const comision = await calcularComision({
          profesionalId,
          servicioId: item.servicioId,
          montoLinea: total,
          cantidad: item.cantidad,
        });

        return {
          tipo: item.tipo,
          servicioId: item.servicioId,
          productoId: item.productoId,
          profesionalId,
          descripcion: item.descripcion,
          piezaDental: item.piezaDental || null,
          cantidad: item.cantidad,
          precioUnitario,
          descuento: item.descuento,
          total,
          afectoIva: item.afectoIva,
          comisionTipo: comision.tipo,
          comisionPorcentaje: comision.porcentaje,
          comisionMonto: comision.monto,
          codigoPrestacion,
          montoCobertura,
        };
      }),
    );

    const totales = calcularTotales(
      lineas.map((l) => ({
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuento: l.descuento,
        afectoIva: l.afectoIva,
      })),
      { iva, descuentoPorcentaje },
    );

    const montoCobertura = lineas.reduce((acc, l) => acc + l.montoCobertura, 0);

    const venta = await prisma.$transaction(async (tx) => {
      const creada = await tx.venta.create({
        data: {
          pacienteId,
          profesionalId: profesionalCabecera,
          atencionId: textoOpcional(fd, 'atencionId'),
          presupuestoId,
          convenioId,
          fecha: fecha(fd, 'fecha') ?? new Date(),
          tipoDocumento: DOCUMENTOS.includes(tipoDocumento) ? tipoDocumento : 'BOLETA',
          numeroDocumento: textoOpcional(fd, 'numeroDocumento'),
          observaciones: textoOpcional(fd, 'observaciones'),
          subtotal: totales.subtotal,
          descuento: totales.descuentoMonto,
          neto: totales.neto,
          iva: totales.iva,
          total: totales.total,
          saldo: totales.total,
          montoCobertura: Math.min(montoCobertura, totales.total),
          montoPaciente: Math.max(0, totales.total - montoCobertura),
          creadoPorId: sesion.usuarioId,
          items: { createMany: { data: lineas } },
        },
        include: { items: true },
      });

      // Cargo en la cuenta corriente del paciente
      await registrarMovimientoCuenta(tx, {
        pacienteId,
        tipo: 'CARGO',
        descripcion: `Venta Nº ${creada.folio}`,
        monto: creada.total,
        ventaId: creada.id,
        fecha: creada.fecha,
      });

      // Movimientos de inventario: productos vendidos e insumos consumidos
      for (const item of creada.items) {
        if (item.tipo === 'PRODUCTO' && item.productoId) {
          await moverStock(tx, {
            productoId: item.productoId,
            tipo: 'VENTA',
            cantidad: item.cantidad,
            motivo: `Venta Nº ${creada.folio}`,
            referenciaTipo: 'venta',
            referenciaId: creada.id,
            usuarioId: sesion.usuarioId,
            validarStock: false,
          });
        }
        if (item.tipo === 'SERVICIO' && item.servicioId) {
          await consumirInsumosDeServicio(tx, {
            servicioId: item.servicioId,
            veces: item.cantidad,
            referenciaTipo: 'venta',
            referenciaId: creada.id,
            usuarioId: sesion.usuarioId,
          });
        }
      }

      if (presupuestoId) {
        await tx.presupuesto.update({ where: { id: presupuestoId }, data: { estado: 'FACTURADO' } });
      }

      return creada;
    });

    nuevaId = venta.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'ventas',
      entidad: 'Venta',
      entidadId: venta.id,
      detalle: { folio: venta.folio, total: venta.total },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/ventas');
  redirect(`/ventas/${nuevaId}`);
}

export async function anularVenta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('ventas', 'anular');
    const id = requerido(fd, 'id', 'Venta');
    const motivo = requerido(fd, 'motivo', 'Motivo de anulación');

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { pagos: { where: { estado: 'CONFIRMADO' } } },
    });
    if (!venta) throw new Error('La venta no existe.');
    if (venta.estado === 'ANULADA') throw new Error('La venta ya está anulada.');
    if (venta.pagos.length > 0) {
      throw new Error('La venta tiene pagos confirmados. Anula primero los pagos para poder anular la venta.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.venta.update({
        where: { id },
        data: { estado: 'ANULADA', anuladaMotivo: motivo, saldo: 0 },
      });

      // Contra-asiento en la cuenta del paciente
      await registrarMovimientoCuenta(tx, {
        pacienteId: venta.pacienteId,
        tipo: 'NOTA_CREDITO',
        descripcion: `Anulación de venta Nº ${venta.folio}: ${motivo}`,
        monto: venta.total,
        ventaId: venta.id,
      });

      await recalcularCuenta(tx, venta.pacienteId);
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'anular',
      modulo: 'ventas',
      entidad: 'Venta',
      entidadId: id,
      detalle: { motivo },
    });

    revalidatePath(`/ventas/${id}`);
    revalidatePath('/ventas');
    return { ok: true as const, mensaje: 'Venta anulada.' };
  });
}

// ═══════════════════════════════════════════════════════════════
//  Pagos
// ═══════════════════════════════════════════════════════════════

export async function registrarPago(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('pagos', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const formaPagoId = requerido(fd, 'formaPagoId', 'Forma de pago');
    const monto = entero(fd, 'monto');
    if (monto <= 0) throw new Error('El monto del pago debe ser mayor que cero.');

    const ventaId = textoOpcional(fd, 'ventaId');
    const formaPago = await prisma.formaPago.findUnique({ where: { id: formaPagoId } });
    if (!formaPago) throw new Error('La forma de pago no existe.');

    const comprobante = fd.get('comprobante');
    const tieneComprobante = comprobante instanceof File && comprobante.size > 0;

    if (formaPago.requiereComprobante && !tieneComprobante) {
      throw new Error(`La forma de pago "${formaPago.nombre}" exige adjuntar el comprobante.`);
    }
    if (formaPago.requiereReferencia && !texto(fd, 'referencia')) {
      throw new Error(`La forma de pago "${formaPago.nombre}" exige el número de operación o referencia.`);
    }

    if (ventaId) {
      const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
      if (!venta) throw new Error('La venta indicada no existe.');
      if (venta.estado === 'ANULADA') throw new Error('No se puede pagar una venta anulada.');
      if (monto > venta.saldo) {
        throw new Error(`El monto supera el saldo de la venta (${venta.saldo}). Ajusta el monto o deja el pago sin asociar.`);
      }
    }

    const pago = await prisma.$transaction(async (tx) => {
      const creado = await tx.pago.create({
        data: {
          pacienteId,
          ventaId,
          formaPagoId,
          monto,
          fecha: fecha(fd, 'fecha') ?? new Date(),
          referencia: textoOpcional(fd, 'referencia'),
          banco: textoOpcional(fd, 'banco'),
          cuotas: Math.max(1, entero(fd, 'cuotas', 1)),
          observaciones: textoOpcional(fd, 'observaciones'),
          registradoPorId: sesion.usuarioId,
        },
      });

      await registrarMovimientoCuenta(tx, {
        pacienteId,
        tipo: 'ABONO',
        descripcion: `Pago Nº ${creado.folio} · ${formaPago.nombre}`,
        monto,
        pagoId: creado.id,
        ventaId,
        fecha: creado.fecha,
      });

      if (ventaId) await refrescarEstadoVenta(tx, ventaId);

      return creado;
    });

    // El adjunto se guarda fuera de la transacción para no dejar el archivo
    // huérfano si algo falla en la base de datos.
    if (tieneComprobante) {
      await guardarAdjunto({
        archivo: comprobante as File,
        categoria: 'COMPROBANTE_PAGO',
        descripcion: `Comprobante del pago Nº ${pago.folio}`,
        subidoPorId: sesion.usuarioId,
        vinculo: { pagoId: pago.id, pacienteId },
      });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'pagos',
      entidad: 'Pago',
      entidadId: pago.id,
      detalle: { folio: pago.folio, monto, formaPago: formaPago.nombre },
    });

    revalidatePath('/pagos');
    revalidatePath(`/pacientes/${pacienteId}/cuenta`);
    if (ventaId) revalidatePath(`/ventas/${ventaId}`);
    return { ok: true as const, mensaje: `Pago de ${monto} registrado.` };
  });
}

export async function anularPago(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('pagos', 'anular');
    const id = requerido(fd, 'id', 'Pago');
    const motivo = requerido(fd, 'motivo', 'Motivo de anulación');

    const pago = await prisma.pago.findUnique({ where: { id } });
    if (!pago) throw new Error('El pago no existe.');
    if (pago.estado === 'ANULADO') throw new Error('El pago ya está anulado.');

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({ where: { id }, data: { estado: 'ANULADO', anuladoMotivo: motivo } });

      await registrarMovimientoCuenta(tx, {
        pacienteId: pago.pacienteId,
        tipo: 'AJUSTE',
        descripcion: `Anulación del pago Nº ${pago.folio}: ${motivo}`,
        monto: pago.monto,
        pagoId: pago.id,
      });

      await recalcularCuenta(tx, pago.pacienteId);
      if (pago.ventaId) await refrescarEstadoVenta(tx, pago.ventaId);
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'anular',
      modulo: 'pagos',
      entidad: 'Pago',
      entidadId: id,
      detalle: { motivo },
    });

    revalidatePath('/pagos');
    revalidatePath(`/pacientes/${pago.pacienteId}/cuenta`);
    return { ok: true as const, mensaje: 'Pago anulado.' };
  });
}

// ═══════════════════════════════════════════════════════════════
//  Formas de pago
// ═══════════════════════════════════════════════════════════════

export async function guardarFormaPago(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('configuracion', 'editar');
    const id = textoOpcional(fd, 'id');
    const datos = {
      nombre: requerido(fd, 'nombre', 'Nombre'),
      tipo: (texto(fd, 'tipo') || 'EFECTIVO') as never,
      requiereComprobante: fd.get('requiereComprobante') === 'on',
      requiereReferencia: fd.get('requiereReferencia') === 'on',
      comisionPorcentaje: decimal(fd, 'comisionPorcentaje'),
      cuentaContable: textoOpcional(fd, 'cuentaContable'),
    };

    if (id) {
      await prisma.formaPago.update({ where: { id }, data: datos });
    } else {
      await prisma.formaPago.create({ data: datos });
    }

    revalidatePath('/configuracion');
    revalidatePath('/pagos');
    return { ok: true as const, mensaje: 'Forma de pago guardada.' };
  });
}

export async function alternarActivoFormaPago(fd: FormData): Promise<void> {
  await exigirPermiso('configuracion', 'editar');
  const id = String(fd.get('id'));
  const forma = await prisma.formaPago.findUnique({ where: { id } });
  if (!forma) return;
  await prisma.formaPago.update({ where: { id }, data: { activo: !forma.activo } });
  revalidatePath('/configuracion');
}
