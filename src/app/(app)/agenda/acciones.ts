'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CanalAgendamiento, EstadoCita } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { detectarConflictos } from '@/lib/agenda';
import {
  booleano,
  entero,
  fechaRequerida,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const CANALES: CanalAgendamiento[] = ['PRESENCIAL', 'TELEFONO', 'WHATSAPP', 'EMAIL', 'WEB', 'DERIVACION'];

const ESTADOS: EstadoCita[] = [
  'AGENDADA',
  'CONFIRMADA',
  'EN_SALA_ESPERA',
  'EN_ATENCION',
  'ATENDIDA',
  'NO_ASISTIO',
  'CANCELADA',
  'REAGENDADA',
];

/** Lee los servicios elegidos para la sesión. Pueden ser varios. */
function leerServicios(fd: FormData): string[] {
  return [...new Set(fd.getAll('servicioIds').map(String).filter(Boolean))];
}

/**
 * Resuelve duración total y necesidad de rayos X a partir de los servicios.
 * La duración manual, si viene, manda sobre la suma.
 */
async function resolverSesion(servicioIds: string[], duracionManual: number) {
  if (servicioIds.length === 0) {
    return { duracion: duracionManual > 0 ? duracionManual : 30, usaRayosX: false, servicios: [] };
  }

  const servicios = await prisma.servicio.findMany({ where: { id: { in: servicioIds } } });
  const suma = servicios.reduce((acc, s) => acc + s.duracionMinutos, 0);

  return {
    duracion: duracionManual > 0 ? duracionManual : suma || 30,
    usaRayosX: servicios.some((s) => s.usaRayosX),
    servicios,
  };
}

export async function crearCita(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let creadaId = '';
  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('agenda', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const servicioIds = leerServicios(fd);
    const boxId = textoOpcional(fd, 'boxId');
    const inicio = fechaRequerida(fd, 'inicio', 'Fecha y hora');

    const sesionCita = await resolverSesion(servicioIds, entero(fd, 'duracionMinutos'));
    const fin = new Date(inicio.getTime() + sesionCita.duracion * 60_000);
    if (fin <= inicio) throw new Error('La hora de término debe ser posterior a la de inicio.');

    // Un sobrecupo salta la validación de horario, pero nunca la de choque real.
    const sobrecupo = booleano(fd, 'sobrecupo');
    const conflictos = await detectarConflictos(prisma, {
      profesionalId,
      boxId,
      inicio,
      fin,
      exigirHorario: !sobrecupo,
    });

    const bloqueantes = sobrecupo ? conflictos.filter((c) => c.tipo !== 'fuera_de_horario') : conflictos;
    if (bloqueantes.length > 0) {
      throw new Error(`No se puede agendar:\n· ${bloqueantes.map((c) => c.mensaje).join('\n· ')}`);
    }

    const canal = texto(fd, 'canal') as CanalAgendamiento;

    const cita = await prisma.cita.create({
      data: {
        pacienteId,
        profesionalId,
        boxId,
        inicio,
        fin,
        canal: CANALES.includes(canal) ? canal : 'PRESENCIAL',
        motivoConsulta: textoOpcional(fd, 'motivoConsulta'),
        // Basta con que uno de los servicios la use para reservar la sala.
        usaRayosX: booleano(fd, 'usaRayosX') || sesionCita.usaRayosX,
        observaciones: textoOpcional(fd, 'observaciones'),
        citaOrigenId: textoOpcional(fd, 'citaOrigenId'),
        creadoPorId: sesion.usuarioId,
        servicios: {
          createMany: {
            data: servicioIds.map((servicioId, orden) => ({ servicioId, orden })),
          },
        },
      },
    });
    creadaId = cita.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'agenda',
      entidad: 'Cita',
      entidadId: cita.id,
      detalle: {
        pacienteId,
        profesionalId,
        inicio: inicio.toISOString(),
        servicios: servicioIds.length,
        duracion: sesionCita.duracion,
        sobrecupo,
      },
    });
  });

  if (!resultado.ok) return resultado;

  revalidatePath('/agenda');
  const volverA = texto(fd, 'volverA');
  redirect(volverA || '/agenda');
}

export async function reagendarCita(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('agenda', 'editar');
    const id = requerido(fd, 'id', 'Cita');

    const cita = await prisma.cita.findUnique({ where: { id } });
    if (!cita) throw new Error('La cita no existe.');
    if (cita.estado === 'ATENDIDA') throw new Error('No se puede reagendar una cita ya atendida.');

    const inicio = fechaRequerida(fd, 'inicio', 'Nueva fecha y hora');
    const boxId = textoOpcional(fd, 'boxId') ?? cita.boxId;
    // Se conserva el largo de la sesión original salvo que se indique otro.
    const duracionOriginal = Math.round((cita.fin.getTime() - cita.inicio.getTime()) / 60_000);
    const fin = new Date(inicio.getTime() + (entero(fd, 'duracionMinutos') || duracionOriginal) * 60_000);

    const conflictos = await detectarConflictos(prisma, {
      profesionalId: textoOpcional(fd, 'profesionalId') ?? cita.profesionalId,
      boxId,
      inicio,
      fin,
      excluirCitaId: id,
      exigirHorario: !booleano(fd, 'sobrecupo'),
    });
    if (conflictos.length > 0) {
      throw new Error(`No se puede reagendar:\n· ${conflictos.map((c) => c.mensaje).join('\n· ')}`);
    }

    await prisma.cita.update({
      where: { id },
      data: {
        inicio,
        fin,
        boxId,
        profesionalId: textoOpcional(fd, 'profesionalId') ?? cita.profesionalId,
        estado: 'AGENDADA',
        confirmadaAt: null,
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'reagendar',
      modulo: 'agenda',
      entidad: 'Cita',
      entidadId: id,
      detalle: { desde: cita.inicio.toISOString(), hacia: inicio.toISOString() },
    });

    revalidatePath('/agenda');
    return { ok: true as const, mensaje: 'Hora reagendada.' };
  });
}

export async function cambiarEstadoCita(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('agenda', 'editar');
  const id = String(fd.get('id'));
  const estado = String(fd.get('estado')) as EstadoCita;
  if (!ESTADOS.includes(estado)) throw new Error('Estado de cita no válido.');

  const datos: Record<string, unknown> = { estado };
  if (estado === 'CONFIRMADA') datos.confirmadaAt = new Date();
  if (estado === 'EN_SALA_ESPERA') datos.llegadaAt = new Date();
  if (estado === 'ATENDIDA') datos.atendidaAt = new Date();
  if (estado === 'CANCELADA') datos.motivoCancelacion = String(fd.get('motivoCancelacion') ?? '') || null;

  await prisma.cita.update({ where: { id }, data: datos });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: `estado_${estado.toLowerCase()}`,
    modulo: 'agenda',
    entidad: 'Cita',
    entidadId: id,
  });

  revalidatePath('/agenda');
}

export async function eliminarCita(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('agenda', 'eliminar');
  const id = String(fd.get('id'));

  const atencion = await prisma.atencion.findUnique({ where: { citaId: id } });
  if (atencion) throw new Error('Esta cita tiene una atención registrada; cancélala en vez de eliminarla.');

  await prisma.cita.delete({ where: { id } });
  await auditar({ usuarioId: sesion.usuarioId, accion: 'eliminar', modulo: 'agenda', entidad: 'Cita', entidadId: id });
  revalidatePath('/agenda');
}

// ─────────────────────────────────────────────────────────────
//  Interconsultas / derivaciones internas
// ─────────────────────────────────────────────────────────────

export async function crearInterconsulta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('interconsultas', 'crear');

    const profesionalOrigenId = requerido(fd, 'profesionalOrigenId', 'Profesional que deriva');
    const profesionalDestinoId = requerido(fd, 'profesionalDestinoId', 'Profesional de destino');
    if (profesionalOrigenId === profesionalDestinoId) {
      throw new Error('El profesional de destino debe ser distinto al que deriva.');
    }

    const interconsulta = await prisma.interconsulta.create({
      data: {
        pacienteId: requerido(fd, 'pacienteId', 'Paciente'),
        profesionalOrigenId,
        profesionalDestinoId,
        motivo: requerido(fd, 'motivo', 'Motivo de la derivación'),
        resumenClinico: textoOpcional(fd, 'resumenClinico'),
        prioridad: (texto(fd, 'prioridad') || 'NORMAL') as never,
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'interconsultas',
      entidad: 'Interconsulta',
      entidadId: interconsulta.id,
    });

    revalidatePath('/interconsultas');
    return { ok: true as const, mensaje: 'Interconsulta enviada al profesional de destino.' };
  });
}

export async function responderInterconsulta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('interconsultas', 'editar');
    const id = requerido(fd, 'id', 'Interconsulta');
    const estado = texto(fd, 'estado');

    await prisma.interconsulta.update({
      where: { id },
      data: {
        estado: (estado || 'ACEPTADA') as never,
        respuesta: textoOpcional(fd, 'respuesta'),
        respondidaAt: new Date(),
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'responder',
      modulo: 'interconsultas',
      entidad: 'Interconsulta',
      entidadId: id,
    });

    revalidatePath('/interconsultas');
    return { ok: true as const, mensaje: 'Interconsulta actualizada.' };
  });
}

/** Agenda una hora a partir de una interconsulta y las deja enlazadas. */
export async function agendarDesdeInterconsulta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('agenda', 'crear');
    const interconsultaId = requerido(fd, 'interconsultaId', 'Interconsulta');

    const interconsulta = await prisma.interconsulta.findUnique({ where: { id: interconsultaId } });
    if (!interconsulta) throw new Error('La interconsulta no existe.');

    const inicio = fechaRequerida(fd, 'inicio', 'Fecha y hora');
    const servicioIds = leerServicios(fd);
    const boxId = textoOpcional(fd, 'boxId');

    const sesionCita = await resolverSesion(servicioIds, entero(fd, 'duracionMinutos'));
    const fin = new Date(inicio.getTime() + sesionCita.duracion * 60_000);

    const conflictos = await detectarConflictos(prisma, {
      profesionalId: interconsulta.profesionalDestinoId,
      boxId,
      inicio,
      fin,
      exigirHorario: !booleano(fd, 'sobrecupo'),
    });
    if (conflictos.length > 0) {
      throw new Error(`No se puede agendar:\n· ${conflictos.map((c) => c.mensaje).join('\n· ')}`);
    }

    await prisma.$transaction(async (tx) => {
      const cita = await tx.cita.create({
        data: {
          pacienteId: interconsulta.pacienteId,
          profesionalId: interconsulta.profesionalDestinoId,
          boxId,
          inicio,
          fin,
          canal: 'DERIVACION',
          motivoConsulta: interconsulta.motivo,
          usaRayosX: sesionCita.usaRayosX,
          creadoPorId: sesion.usuarioId,
          servicios: {
            createMany: { data: servicioIds.map((servicioId, orden) => ({ servicioId, orden })) },
          },
        },
      });

      await tx.interconsulta.update({
        where: { id: interconsultaId },
        data: { citaId: cita.id, estado: 'AGENDADA' },
      });
    });

    revalidatePath('/interconsultas');
    revalidatePath('/agenda');
    return { ok: true as const, mensaje: 'Hora agendada y vinculada a la interconsulta.' };
  });
}
