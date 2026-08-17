'use server';

import { revalidatePath } from 'next/cache';
import type { ModeloPagoProfesional, Periodicidad } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { horaAMinutos, normalizarRut, validarRut } from '@/lib/format';
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

const MODELOS: ModeloPagoProfesional[] = ['COMISION', 'ARRIENDO', 'SUELDO', 'COMISION_Y_ARRIENDO'];
const PERIODICIDADES: Periodicidad[] = [
  'UNICA',
  'DIARIA',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
  'BIMESTRAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
];

function datosProfesional(fd: FormData) {
  const rut = requerido(fd, 'rut', 'RUT');
  if (!validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

  const modeloPago = requerido(fd, 'modeloPago', 'Modelo de pago') as ModeloPagoProfesional;
  if (!MODELOS.includes(modeloPago)) throw new Error('Modelo de pago no válido.');

  const comision = decimal(fd, 'comisionPorcentaje');
  if (comision < 0 || comision > 100) throw new Error('La comisión debe estar entre 0 y 100.');

  return {
    rut: normalizarRut(rut),
    nombres: requerido(fd, 'nombres', 'Nombres'),
    apellidos: requerido(fd, 'apellidos', 'Apellidos'),
    email: textoOpcional(fd, 'email'),
    telefono: textoOpcional(fd, 'telefono'),
    especialidad: requerido(fd, 'especialidad', 'Especialidad'),
    subespecialidad: textoOpcional(fd, 'subespecialidad'),
    registroSuperintendencia: textoOpcional(fd, 'registroSuperintendencia'),
    colorAgenda: texto(fd, 'colorAgenda') || '#3384fb',
    modeloPago,
    comisionPorcentaje: comision,
    sueldoBase: entero(fd, 'sueldoBase'),
    observaciones: textoOpcional(fd, 'observaciones'),
  };
}

export async function crearProfesional(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('profesionales', 'crear');
    const datos = datosProfesional(fd);

    if (await prisma.profesional.findUnique({ where: { rut: datos.rut } })) {
      throw new Error('Ya existe un profesional con ese RUT.');
    }

    const profesional = await prisma.profesional.create({ data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'profesionales',
      entidad: 'Profesional',
      entidadId: profesional.id,
    });

    revalidatePath('/profesionales');
    return { ok: true as const, mensaje: `Profesional ${datos.nombres} ${datos.apellidos} creado.` };
  });
}

export async function editarProfesional(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('profesionales', 'editar');
    const id = requerido(fd, 'id', 'Profesional');
    const datos = datosProfesional(fd);

    const existente = await prisma.profesional.findUnique({ where: { rut: datos.rut } });
    if (existente && existente.id !== id) throw new Error('Ese RUT ya pertenece a otro profesional.');

    await prisma.profesional.update({ where: { id }, data: datos });
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'profesionales',
      entidad: 'Profesional',
      entidadId: id,
    });

    revalidatePath('/profesionales');
    revalidatePath(`/profesionales/${id}`);
    return { ok: true as const, mensaje: 'Profesional actualizado.' };
  });
}

export async function alternarActivoProfesional(fd: FormData): Promise<void> {
  await exigirPermiso('profesionales', 'editar');
  const id = String(fd.get('id'));
  const p = await prisma.profesional.findUnique({ where: { id } });
  if (!p) return;
  await prisma.profesional.update({ where: { id }, data: { activo: !p.activo } });
  revalidatePath('/profesionales');
}

export async function eliminarProfesional(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('profesionales', 'eliminar');
  const id = String(fd.get('id'));

  const atenciones = await prisma.atencion.count({ where: { profesionalId: id } });
  if (atenciones > 0) {
    throw new Error(
      `Este profesional tiene ${atenciones} atención(es) en la historia clínica y no puede eliminarse. Desactívalo.`,
    );
  }

  await prisma.profesional.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'profesionales',
    entidad: 'Profesional',
    entidadId: id,
  });
  revalidatePath('/profesionales');
}

// ─────────────────────────────────────────────────────────────
//  Disponibilidad horaria
// ─────────────────────────────────────────────────────────────

export async function agregarDisponibilidad(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('profesionales', 'editar');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const horaInicio = requerido(fd, 'horaInicio', 'Hora de inicio');
    const horaFin = requerido(fd, 'horaFin', 'Hora de término');

    if (horaAMinutos(horaFin) <= horaAMinutos(horaInicio)) {
      throw new Error('La hora de término debe ser posterior a la de inicio.');
    }

    // Se pueden marcar varios días de una vez.
    const dias = fd.getAll('diaSemana').map((d) => parseInt(String(d), 10));
    if (dias.length === 0) throw new Error('Selecciona al menos un día de la semana.');

    const boxId = textoOpcional(fd, 'boxId');
    const duracionSlot = Math.max(5, entero(fd, 'duracionSlot', 30));
    const vigenteDesde = fecha(fd, 'vigenteDesde') ?? new Date();
    const vigenteHasta = fecha(fd, 'vigenteHasta');

    for (const diaSemana of dias) {
      // Evita solapar dos bloques del mismo día para el mismo profesional.
      const existentes = await prisma.disponibilidad.findMany({
        where: { profesionalId, diaSemana, activo: true },
      });
      const inicio = horaAMinutos(horaInicio);
      const fin = horaAMinutos(horaFin);
      const choque = existentes.find(
        (b) => inicio < horaAMinutos(b.horaFin) && fin > horaAMinutos(b.horaInicio),
      );
      if (choque) {
        throw new Error(
          `El bloque se superpone con uno existente (${choque.horaInicio}–${choque.horaFin}) en ese día.`,
        );
      }

      await prisma.disponibilidad.create({
        data: { profesionalId, boxId, diaSemana, horaInicio, horaFin, duracionSlot, vigenteDesde, vigenteHasta },
      });
    }

    revalidatePath(`/profesionales/${profesionalId}`);
    revalidatePath('/agenda');
    return { ok: true as const, mensaje: `Disponibilidad agregada en ${dias.length} día(s).` };
  });
}

export async function eliminarDisponibilidad(fd: FormData): Promise<void> {
  await exigirPermiso('profesionales', 'editar');
  const id = String(fd.get('id'));
  const bloque = await prisma.disponibilidad.findUnique({ where: { id } });
  if (!bloque) return;
  await prisma.disponibilidad.delete({ where: { id } });
  revalidatePath(`/profesionales/${bloque.profesionalId}`);
  revalidatePath('/agenda');
}

// ─────────────────────────────────────────────────────────────
//  Bloqueos y excepciones de agenda
// ─────────────────────────────────────────────────────────────

export async function agregarExcepcion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('agenda', 'editar');
    const profesionalId = textoOpcional(fd, 'profesionalId');
    const boxId = textoOpcional(fd, 'boxId');
    if (!profesionalId && !boxId) throw new Error('Indica a qué profesional o box afecta el bloqueo.');

    const fechaInicio = fechaRequerida(fd, 'fechaInicio', 'Desde');
    const fechaFin = fechaRequerida(fd, 'fechaFin', 'Hasta');
    if (fechaFin < fechaInicio) throw new Error('La fecha de término debe ser posterior a la de inicio.');

    await prisma.excepcionAgenda.create({
      data: {
        profesionalId,
        boxId,
        tipo: (texto(fd, 'tipo') || 'BLOQUEO') as never,
        fechaInicio,
        fechaFin,
        todoElDia: booleano(fd, 'todoElDia'),
        motivo: textoOpcional(fd, 'motivo'),
      },
    });

    if (profesionalId) revalidatePath(`/profesionales/${profesionalId}`);
    revalidatePath('/agenda');
    return { ok: true as const, mensaje: 'Bloqueo registrado.' };
  });
}

export async function eliminarExcepcion(fd: FormData): Promise<void> {
  await exigirPermiso('agenda', 'editar');
  const id = String(fd.get('id'));
  const exc = await prisma.excepcionAgenda.findUnique({ where: { id } });
  if (!exc) return;
  await prisma.excepcionAgenda.delete({ where: { id } });
  if (exc.profesionalId) revalidatePath(`/profesionales/${exc.profesionalId}`);
  revalidatePath('/agenda');
}

// ─────────────────────────────────────────────────────────────
//  Arriendo de box
// ─────────────────────────────────────────────────────────────

export async function agregarArriendo(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('profesionales', 'editar');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const boxId = requerido(fd, 'boxId', 'Box');
    const monto = entero(fd, 'monto');
    if (monto <= 0) throw new Error('El monto del arriendo debe ser mayor que cero.');

    const periodicidad = requerido(fd, 'periodicidad', 'Periodicidad') as Periodicidad;
    if (!PERIODICIDADES.includes(periodicidad)) throw new Error('Periodicidad no válida.');

    await prisma.arriendoBox.create({
      data: {
        profesionalId,
        boxId,
        monto,
        periodicidad,
        vigenteDesde: fecha(fd, 'vigenteDesde') ?? new Date(),
        vigenteHasta: fecha(fd, 'vigenteHasta'),
        observaciones: textoOpcional(fd, 'observaciones'),
      },
    });

    revalidatePath(`/profesionales/${profesionalId}`);
    revalidatePath('/boxes');
    return { ok: true as const, mensaje: 'Arriendo de box registrado.' };
  });
}

export async function eliminarArriendo(fd: FormData): Promise<void> {
  await exigirPermiso('profesionales', 'editar');
  const id = String(fd.get('id'));
  const arriendo = await prisma.arriendoBox.findUnique({ where: { id } });
  if (!arriendo) return;
  await prisma.arriendoBox.delete({ where: { id } });
  revalidatePath(`/profesionales/${arriendo.profesionalId}`);
  revalidatePath('/boxes');
}
