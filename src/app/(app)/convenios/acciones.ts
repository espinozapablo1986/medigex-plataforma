'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { TipoConvenio } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, slugificar, validarRut } from '@/lib/format';
import {
  booleano,
  decimal,
  entero,
  fecha,
  fechaRequerida,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const TIPOS: TipoConvenio[] = ['ISAPRE', 'SEGURO_COMPLEMENTARIO', 'EMPRESA', 'MUTUAL', 'FONASA', 'OTRO'];

function datosConvenio(fd: FormData) {
  const tipo = texto(fd, 'tipo') as TipoConvenio;
  const rut = textoOpcional(fd, 'rut');
  if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

  const descuento = decimal(fd, 'descuentoPorcentaje');
  const cobertura = decimal(fd, 'coberturaPorcentaje');
  if (descuento < 0 || descuento > 100) throw new Error('El descuento debe estar entre 0 y 100.');
  if (cobertura < 0 || cobertura > 100) throw new Error('La cobertura debe estar entre 0 y 100.');

  const nombre = requerido(fd, 'nombre', 'Nombre');

  return {
    codigo: (texto(fd, 'codigo') || slugificar(nombre)).toUpperCase().slice(0, 30),
    nombre,
    tipo: TIPOS.includes(tipo) ? tipo : ('OTRO' as TipoConvenio),
    rut: rut ? normalizarRut(rut) : null,
    contacto: textoOpcional(fd, 'contacto'),
    telefono: textoOpcional(fd, 'telefono'),
    email: textoOpcional(fd, 'email'),
    descuentoPorcentaje: descuento,
    coberturaPorcentaje: cobertura,
    topePorPrestacion: entero(fd, 'topePorPrestacion'),
    requiereAutorizacion: booleano(fd, 'requiereAutorizacion'),
    vigenteDesde: fecha(fd, 'vigenteDesde') ?? new Date(),
    vigenteHasta: fecha(fd, 'vigenteHasta'),
    observaciones: textoOpcional(fd, 'observaciones'),
  };
}

export async function crearConvenio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('convenios', 'crear');
    const datos = datosConvenio(fd);

    if (await prisma.convenio.findUnique({ where: { codigo: datos.codigo } })) {
      throw new Error(`Ya existe un convenio con el código ${datos.codigo}.`);
    }

    const convenio = await prisma.convenio.create({ data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'convenios',
      entidad: 'Convenio',
      entidadId: convenio.id,
    });

    revalidatePath('/convenios');
    return { ok: true as const, mensaje: `Convenio ${datos.nombre} creado.` };
  });
}

export async function editarConvenio(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('convenios', 'editar');
    const id = requerido(fd, 'id', 'Convenio');
    const datos = datosConvenio(fd);

    const existente = await prisma.convenio.findUnique({ where: { codigo: datos.codigo } });
    if (existente && existente.id !== id) throw new Error(`El código ${datos.codigo} ya está en uso.`);

    await prisma.convenio.update({ where: { id }, data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'convenios',
      entidad: 'Convenio',
      entidadId: id,
    });

    revalidatePath('/convenios');
    revalidatePath(`/convenios/${id}`);
    return { ok: true as const, mensaje: 'Convenio actualizado.' };
  });
}

export async function alternarActivoConvenio(fd: FormData): Promise<void> {
  await exigirPermiso('convenios', 'editar');
  const id = String(fd.get('id'));
  const convenio = await prisma.convenio.findUnique({ where: { id } });
  if (!convenio) return;
  await prisma.convenio.update({ where: { id }, data: { activo: !convenio.activo } });
  revalidatePath('/convenios');
}

export async function eliminarConvenio(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('convenios', 'eliminar');
  const id = String(fd.get('id'));

  const [pacientes, ventas] = await Promise.all([
    prisma.paciente.count({ where: { convenioId: id } }),
    prisma.venta.count({ where: { convenioId: id } }),
  ]);
  if (pacientes > 0 || ventas > 0) {
    throw new Error('El convenio tiene pacientes o ventas asociadas. Desactívalo en vez de eliminarlo.');
  }

  await prisma.convenio.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'convenios',
    entidad: 'Convenio',
    entidadId: id,
  });
  revalidatePath('/convenios');
}

// ─────────────────────────────────────────────────────────────
//  Tarifas por servicio
// ─────────────────────────────────────────────────────────────

export async function guardarTarifa(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('convenios', 'editar');
    const convenioId = requerido(fd, 'convenioId', 'Convenio');
    const servicioId = requerido(fd, 'servicioId', 'Servicio');
    const cobertura = decimal(fd, 'coberturaPorcentaje');
    if (cobertura < 0 || cobertura > 100) throw new Error('La cobertura debe estar entre 0 y 100.');

    await prisma.convenioServicio.upsert({
      where: { convenioId_servicioId: { convenioId, servicioId } },
      create: {
        convenioId,
        servicioId,
        precioConvenio: entero(fd, 'precioConvenio'),
        coberturaPorcentaje: cobertura,
        codigoPrestacion: textoOpcional(fd, 'codigoPrestacion'),
      },
      update: {
        precioConvenio: entero(fd, 'precioConvenio'),
        coberturaPorcentaje: cobertura,
        codigoPrestacion: textoOpcional(fd, 'codigoPrestacion'),
      },
    });

    revalidatePath(`/convenios/${convenioId}`);
    return { ok: true as const, mensaje: 'Tarifa guardada.' };
  });
}

export async function quitarTarifa(fd: FormData): Promise<void> {
  await exigirPermiso('convenios', 'editar');
  const id = String(fd.get('id'));
  const tarifa = await prisma.convenioServicio.findUnique({ where: { id } });
  if (!tarifa) return;
  await prisma.convenioServicio.delete({ where: { id } });
  revalidatePath(`/convenios/${tarifa.convenioId}`);
}

// ═══════════════════════════════════════════════════════════════
//  Informes de beneficio (reembolso Isapre / seguro)
// ═══════════════════════════════════════════════════════════════

export async function emitirInforme(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('informes_beneficio', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const periodoDesde = fechaRequerida(fd, 'periodoDesde', 'Desde');
    const periodoHasta = fechaRequerida(fd, 'periodoHasta', 'Hasta');
    if (periodoHasta < periodoDesde) throw new Error('La fecha de término debe ser posterior a la de inicio.');

    const hastaFinDia = new Date(periodoHasta);
    hastaFinDia.setHours(23, 59, 59, 999);

    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) throw new Error('El paciente no existe.');

    // Sólo se certifican prestaciones efectivamente pagadas.
    const items = await prisma.ventaItem.findMany({
      where: {
        venta: {
          pacienteId,
          fecha: { gte: periodoDesde, lte: hastaFinDia },
          estado: 'PAGADA',
        },
        tipo: 'SERVICIO',
      },
      include: {
        venta: { select: { fecha: true, folio: true } },
        profesional: { select: { nombres: true, apellidos: true, especialidad: true } },
      },
      orderBy: { venta: { fecha: 'asc' } },
    });

    if (items.length === 0) {
      throw new Error(
        'No hay prestaciones pagadas en el período seleccionado. El informe sólo certifica atenciones ya canceladas.',
      );
    }

    const totalPrestaciones = items.reduce((acc, i) => acc + i.total, 0);
    const totalCobertura = items.reduce((acc, i) => acc + i.montoCobertura, 0);

    const informe = await prisma.informeBeneficio.create({
      data: {
        pacienteId,
        convenioId: textoOpcional(fd, 'convenioId') ?? paciente.convenioId,
        profesionalId: textoOpcional(fd, 'profesionalId'),
        periodoDesde,
        periodoHasta: hastaFinDia,
        diagnostico: textoOpcional(fd, 'diagnostico'),
        cie10: textoOpcional(fd, 'cie10'),
        totalPrestaciones,
        totalCobertura,
        totalPaciente: totalPrestaciones - totalCobertura,
        observaciones: textoOpcional(fd, 'observaciones'),
        emitidoPorId: sesion.usuarioId,
        items: {
          createMany: {
            data: items.map((i) => ({
              ventaItemId: i.id,
              fecha: i.venta.fecha,
              codigoPrestacion: i.codigoPrestacion,
              descripcion: i.descripcion,
              profesional: i.profesional ? `${i.profesional.nombres} ${i.profesional.apellidos}` : null,
              cantidad: i.cantidad,
              montoTotal: i.total,
              montoCobertura: i.montoCobertura,
              montoPaciente: i.total - i.montoCobertura,
            })),
          },
        },
      },
    });

    nuevoId = informe.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'informes_beneficio',
      entidad: 'InformeBeneficio',
      entidadId: informe.id,
      detalle: { folio: informe.folio, prestaciones: items.length, totalPrestaciones },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/informes');
  redirect(`/informes/${nuevoId}`);
}

export async function cambiarEstadoInforme(fd: FormData): Promise<void> {
  const estado = String(fd.get('estado'));
  const sesion = await exigirPermiso('informes_beneficio', estado === 'RECHAZADO' ? 'anular' : 'editar');
  const id = String(fd.get('id'));

  await prisma.informeBeneficio.update({ where: { id }, data: { estado: estado as never } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: `estado_${estado.toLowerCase()}`,
    modulo: 'informes_beneficio',
    entidad: 'InformeBeneficio',
    entidadId: id,
  });

  revalidatePath(`/informes/${id}`);
  revalidatePath('/informes');
}

export async function eliminarInforme(fd: FormData): Promise<void> {
  await exigirPermiso('informes_beneficio', 'anular');
  const id = String(fd.get('id'));
  await prisma.informeBeneficio.delete({ where: { id } });
  redirect('/informes');
}
