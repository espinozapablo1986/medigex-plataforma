import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { horaAMinutos, minutosAHora } from './format';

type Tx = Prisma.TransactionClient;

/** Devuelve el instante correspondiente a "HH:mm" del día indicado. */
export function enFecha(dia: Date, hhmm: string): Date {
  const d = new Date(dia);
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function inicioSemana(fecha: Date): Date {
  const d = inicioDelDia(fecha);
  const dia = d.getDay(); // 0 = domingo
  return sumarDias(d, dia === 0 ? -6 : 1 - dia);
}

const ESTADOS_QUE_OCUPAN = ['AGENDADA', 'CONFIRMADA', 'EN_SALA_ESPERA', 'EN_ATENCION', 'ATENDIDA'] as const;

// ─────────────────────────────────────────────────────────────
//  Validación de disponibilidad
// ─────────────────────────────────────────────────────────────

export interface ConflictoAgenda {
  tipo: 'profesional' | 'box' | 'bloqueo' | 'fuera_de_horario';
  mensaje: string;
}

/**
 * Comprueba si se puede agendar un bloque. Devuelve la lista de conflictos
 * encontrados; vacía significa que la hora está disponible.
 *
 * `exigirHorario` valida además que el bloque caiga dentro de la
 * disponibilidad declarada del profesional (se puede desactivar para
 * sobrecupos autorizados por administración).
 */
export async function detectarConflictos(
  cliente: Tx | typeof prisma,
  datos: {
    profesionalId: string;
    boxId?: string | null;
    inicio: Date;
    fin: Date;
    excluirCitaId?: string | null;
    exigirHorario?: boolean;
  },
): Promise<ConflictoAgenda[]> {
  const conflictos: ConflictoAgenda[] = [];
  const { profesionalId, boxId, inicio, fin, excluirCitaId } = datos;

  // 1. El profesional ya tiene otra cita que se solapa
  const citaProfesional = await cliente.cita.findFirst({
    where: {
      profesionalId,
      estado: { in: [...ESTADOS_QUE_OCUPAN] },
      ...(excluirCitaId ? { id: { not: excluirCitaId } } : {}),
      inicio: { lt: fin },
      fin: { gt: inicio },
    },
    include: { paciente: { select: { nombres: true, apellidoPaterno: true } } },
  });
  if (citaProfesional) {
    conflictos.push({
      tipo: 'profesional',
      mensaje: `El profesional ya tiene una hora entre ${formatoHora(citaProfesional.inicio)} y ${formatoHora(citaProfesional.fin)} con ${citaProfesional.paciente.nombres} ${citaProfesional.paciente.apellidoPaterno}.`,
    });
  }

  // 2. El box está ocupado por otra cita
  if (boxId) {
    const citaBox = await cliente.cita.findFirst({
      where: {
        boxId,
        estado: { in: [...ESTADOS_QUE_OCUPAN] },
        ...(excluirCitaId ? { id: { not: excluirCitaId } } : {}),
        inicio: { lt: fin },
        fin: { gt: inicio },
      },
      include: { box: { select: { codigo: true } }, profesional: { select: { apellidos: true } } },
    });
    if (citaBox) {
      conflictos.push({
        tipo: 'box',
        mensaje: `El box ${citaBox.box?.codigo ?? ''} está ocupado entre ${formatoHora(citaBox.inicio)} y ${formatoHora(citaBox.fin)} (Dr./Dra. ${citaBox.profesional.apellidos}).`,
      });
    }
  }

  // 3. Bloqueos, vacaciones o mantenciones
  const bloqueo = await cliente.excepcionAgenda.findFirst({
    where: {
      tipo: { not: 'DISPONIBILIDAD_EXTRA' },
      OR: [{ profesionalId }, ...(boxId ? [{ boxId }] : [])],
      fechaInicio: { lt: fin },
      fechaFin: { gt: inicio },
    },
  });
  if (bloqueo) {
    conflictos.push({
      tipo: 'bloqueo',
      mensaje: `Hay un bloqueo de agenda (${bloqueo.tipo.toLowerCase().replace(/_/g, ' ')})${bloqueo.motivo ? `: ${bloqueo.motivo}` : ''}.`,
    });
  }

  // 4. Fuera del horario declarado del profesional
  if (datos.exigirHorario !== false) {
    const dentro = await estaDentroDeDisponibilidad(cliente, profesionalId, inicio, fin);
    if (!dentro) {
      conflictos.push({
        tipo: 'fuera_de_horario',
        mensaje: 'El horario solicitado está fuera de la disponibilidad declarada del profesional.',
      });
    }
  }

  return conflictos;
}

async function estaDentroDeDisponibilidad(
  cliente: Tx | typeof prisma,
  profesionalId: string,
  inicio: Date,
  fin: Date,
): Promise<boolean> {
  // Una disponibilidad extra explícita siempre habilita el bloque.
  const extra = await cliente.excepcionAgenda.findFirst({
    where: {
      profesionalId,
      tipo: 'DISPONIBILIDAD_EXTRA',
      fechaInicio: { lte: inicio },
      fechaFin: { gte: fin },
    },
  });
  if (extra) return true;

  const bloques = await cliente.disponibilidad.findMany({
    where: {
      profesionalId,
      diaSemana: inicio.getDay(),
      activo: true,
      vigenteDesde: { lte: inicio },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: inicio } }],
    },
  });

  const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes();
  const minutosFin = fin.getHours() * 60 + fin.getMinutes();

  return bloques.some(
    (b) => horaAMinutos(b.horaInicio) <= minutosInicio && horaAMinutos(b.horaFin) >= minutosFin,
  );
}

function formatoHora(fecha: Date) {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
//  Generación de cupos libres
// ─────────────────────────────────────────────────────────────

export interface Cupo {
  inicio: Date;
  fin: Date;
  disponible: boolean;
  motivo?: string;
  boxSugeridoId?: string | null;
}

/**
 * Cupos de un profesional en un día concreto, marcando cuáles están libres.
 * `duracionMinutos` permite calcular cupos para un servicio específico.
 */
export async function cuposDelDia(
  profesionalId: string,
  dia: Date,
  duracionMinutos?: number,
): Promise<Cupo[]> {
  const desde = inicioDelDia(dia);
  const hasta = finDelDia(dia);

  const [bloques, extras, citas, bloqueos] = await Promise.all([
    prisma.disponibilidad.findMany({
      where: {
        profesionalId,
        diaSemana: dia.getDay(),
        activo: true,
        vigenteDesde: { lte: hasta },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }],
      },
      orderBy: { horaInicio: 'asc' },
    }),
    prisma.excepcionAgenda.findMany({
      where: {
        profesionalId,
        tipo: 'DISPONIBILIDAD_EXTRA',
        fechaInicio: { lte: hasta },
        fechaFin: { gte: desde },
      },
    }),
    prisma.cita.findMany({
      where: {
        profesionalId,
        estado: { in: [...ESTADOS_QUE_OCUPAN] },
        inicio: { lte: hasta },
        fin: { gte: desde },
      },
      select: { inicio: true, fin: true },
    }),
    prisma.excepcionAgenda.findMany({
      where: {
        profesionalId,
        tipo: { not: 'DISPONIBILIDAD_EXTRA' },
        fechaInicio: { lte: hasta },
        fechaFin: { gte: desde },
      },
    }),
  ]);

  const rangos: { inicio: number; fin: number; paso: number; boxId: string | null }[] = bloques.map((b) => ({
    inicio: horaAMinutos(b.horaInicio),
    fin: horaAMinutos(b.horaFin),
    paso: duracionMinutos ?? b.duracionSlot,
    boxId: b.boxId,
  }));

  for (const extra of extras) {
    rangos.push({
      inicio: extra.fechaInicio.getHours() * 60 + extra.fechaInicio.getMinutes(),
      fin: extra.fechaFin.getHours() * 60 + extra.fechaFin.getMinutes(),
      paso: duracionMinutos ?? 30,
      boxId: extra.boxId,
    });
  }

  const cupos: Cupo[] = [];

  for (const rango of rangos) {
    for (let minuto = rango.inicio; minuto + rango.paso <= rango.fin; minuto += rango.paso) {
      const inicio = enFecha(dia, minutosAHora(minuto));
      const fin = enFecha(dia, minutosAHora(minuto + rango.paso));

      const ocupado = citas.some((c) => c.inicio < fin && c.fin > inicio);
      const bloqueado = bloqueos.find((b) => b.fechaInicio < fin && b.fechaFin > inicio);

      cupos.push({
        inicio,
        fin,
        disponible: !ocupado && !bloqueado,
        motivo: ocupado ? 'Hora ya reservada' : bloqueado ? (bloqueado.motivo ?? 'Agenda bloqueada') : undefined,
        boxSugeridoId: rango.boxId,
      });
    }
  }

  return cupos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/**
 * Boxes libres en un rango horario, opcionalmente filtrando por tipo
 * (por ejemplo, sólo la sala de rayos X).
 */
export async function boxesDisponibles(inicio: Date, fin: Date, tipo?: string | null) {
  const boxes = await prisma.box.findMany({
    where: { activo: true, ...(tipo ? { tipo: tipo as never } : {}) },
    orderBy: { codigo: 'asc' },
  });

  const [citas, bloqueos] = await Promise.all([
    prisma.cita.findMany({
      where: {
        boxId: { not: null },
        estado: { in: [...ESTADOS_QUE_OCUPAN] },
        inicio: { lt: fin },
        fin: { gt: inicio },
      },
      select: { boxId: true },
    }),
    prisma.excepcionAgenda.findMany({
      where: {
        boxId: { not: null },
        tipo: { not: 'DISPONIBILIDAD_EXTRA' },
        fechaInicio: { lt: fin },
        fechaFin: { gt: inicio },
      },
      select: { boxId: true },
    }),
  ]);

  const ocupados = new Set([
    ...citas.map((c) => c.boxId),
    ...bloqueos.map((b) => b.boxId),
  ]);

  return boxes.map((box) => ({ ...box, disponible: !ocupados.has(box.id) }));
}
