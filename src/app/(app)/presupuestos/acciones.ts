'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { aplicarConvenio, calcularTotales, tasaIva, totalLinea } from '@/lib/comercial';
import { leerItems } from '@/lib/items';
import { decimal, fecha, intentar, requerido, textoOpcional, type Resultado } from '@/lib/resultado';

export async function crearPresupuesto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';
  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('presupuestos', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const items = leerItems(fd);
    const iva = await tasaIva();
    const descuentoPorcentaje = decimal(fd, 'descuentoPorcentaje');

    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) throw new Error('El paciente no existe.');

    // Si el paciente tiene convenio, se aplica su tarifa a los servicios.
    const lineas = await Promise.all(
      items.map(async (item, orden) => {
        let precioUnitario = item.precioUnitario;
        if (item.tipo === 'SERVICIO' && item.servicioId && paciente.convenioId) {
          const convenio = await aplicarConvenio(item.servicioId, item.precioUnitario, 1, paciente.convenioId);
          precioUnitario = convenio.precio;
        }
        return {
          tipo: item.tipo,
          servicioId: item.servicioId,
          productoId: item.productoId,
          descripcion: item.descripcion,
          piezaDental: item.piezaDental || null,
          cantidad: item.cantidad,
          precioUnitario,
          descuento: item.descuento,
          total: totalLinea(item.cantidad, precioUnitario, item.descuento),
          afectoIva: item.afectoIva,
          orden,
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

    const presupuesto = await prisma.presupuesto.create({
      data: {
        pacienteId,
        profesionalId: textoOpcional(fd, 'profesionalId'),
        fecha: fecha(fd, 'fecha') ?? new Date(),
        validoHasta: fecha(fd, 'validoHasta'),
        observaciones: textoOpcional(fd, 'observaciones'),
        subtotal: totales.subtotal,
        descuentoPorcentaje,
        descuentoMonto: totales.descuentoMonto,
        neto: totales.neto,
        iva: totales.iva,
        total: totales.total,
        creadoPorId: sesion.usuarioId,
        items: { createMany: { data: lineas } },
      },
    });
    nuevoId = presupuesto.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'presupuestos',
      entidad: 'Presupuesto',
      entidadId: presupuesto.id,
      detalle: { folio: presupuesto.folio, total: totales.total },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/presupuestos');
  redirect(`/presupuestos/${nuevoId}`);
}

export async function actualizarPresupuesto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('presupuestos', 'editar');
    const id = requerido(fd, 'id', 'Presupuesto');

    const presupuesto = await prisma.presupuesto.findUnique({ where: { id } });
    if (!presupuesto) throw new Error('El presupuesto no existe.');
    if (presupuesto.estado === 'FACTURADO') {
      throw new Error('Este presupuesto ya se convirtió en venta y no puede modificarse.');
    }

    const items = leerItems(fd);
    const iva = await tasaIva();
    const descuentoPorcentaje = decimal(fd, 'descuentoPorcentaje');

    const lineas = items.map((item, orden) => ({
      tipo: item.tipo,
      servicioId: item.servicioId,
      productoId: item.productoId,
      descripcion: item.descripcion,
      piezaDental: item.piezaDental || null,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      descuento: item.descuento,
      total: totalLinea(item.cantidad, item.precioUnitario, item.descuento),
      afectoIva: item.afectoIva,
      orden,
    }));

    const totales = calcularTotales(lineas, { iva, descuentoPorcentaje });

    await prisma.$transaction([
      prisma.presupuestoItem.deleteMany({ where: { presupuestoId: id } }),
      prisma.presupuesto.update({
        where: { id },
        data: {
          profesionalId: textoOpcional(fd, 'profesionalId'),
          validoHasta: fecha(fd, 'validoHasta'),
          observaciones: textoOpcional(fd, 'observaciones'),
          subtotal: totales.subtotal,
          descuentoPorcentaje,
          descuentoMonto: totales.descuentoMonto,
          neto: totales.neto,
          iva: totales.iva,
          total: totales.total,
          items: { createMany: { data: lineas } },
        },
      }),
    ]);

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'presupuestos',
      entidad: 'Presupuesto',
      entidadId: id,
    });

    revalidatePath(`/presupuestos/${id}`);
    return { ok: true as const, mensaje: 'Presupuesto actualizado.' };
  });
}

export async function cambiarEstadoPresupuesto(fd: FormData): Promise<void> {
  const estado = String(fd.get('estado'));
  const accion = estado === 'ACEPTADO' || estado === 'RECHAZADO' ? 'aprobar' : 'editar';
  const sesion = await exigirPermiso('presupuestos', accion);

  const id = String(fd.get('id'));
  await prisma.presupuesto.update({
    where: { id },
    data: {
      estado: estado as never,
      aceptadoAt: estado === 'ACEPTADO' ? new Date() : null,
      motivoRechazo: estado === 'RECHAZADO' ? String(fd.get('motivoRechazo') ?? '') || null : null,
    },
  });

  await auditar({
    usuarioId: sesion.usuarioId,
    accion: `estado_${estado.toLowerCase()}`,
    modulo: 'presupuestos',
    entidad: 'Presupuesto',
    entidadId: id,
  });

  revalidatePath(`/presupuestos/${id}`);
  revalidatePath('/presupuestos');
}

export async function eliminarPresupuesto(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('presupuestos', 'eliminar');
  const id = String(fd.get('id'));

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id },
    include: { _count: { select: { ventas: true } } },
  });
  if (!presupuesto) return;
  if (presupuesto._count.ventas > 0) throw new Error('El presupuesto tiene ventas asociadas y no puede eliminarse.');

  await prisma.presupuesto.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'presupuestos',
    entidad: 'Presupuesto',
    entidadId: id,
  });
  redirect('/presupuestos');
}
