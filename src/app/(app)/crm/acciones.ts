'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  CanalInteraccion,
  EstadoContacto,
  OrigenContacto,
  Prioridad,
  SentidoInteraccion,
  TipoSeguimiento,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, validarRut } from '@/lib/format';
import {
  fecha,
  fechaRequerida,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const ORIGENES: OrigenContacto[] = [
  'RECOMENDACION',
  'INSTAGRAM',
  'FACEBOOK',
  'GOOGLE',
  'SITIO_WEB',
  'WHATSAPP',
  'PASABA_POR_FUERA',
  'CONVENIO_EMPRESA',
  'DERIVACION',
  'CAMPANA',
  'OTRO',
];

const ESTADOS: EstadoContacto[] = ['NUEVO', 'CONTACTADO', 'INTERESADO', 'AGENDADO', 'CONVERTIDO', 'PERDIDO'];
const CANALES: CanalInteraccion[] = ['LLAMADA', 'WHATSAPP', 'EMAIL', 'SMS', 'PRESENCIAL', 'INSTAGRAM', 'OTRO'];
const TIPOS: TipoSeguimiento[] = [
  'RECALL',
  'CONTROL',
  'PRESUPUESTO',
  'COBRANZA',
  'POST_ATENCION',
  'PROSPECTO',
  'OTRO',
];

// ═══════════════════════════════════════════════════════════════
//  Contactos (interesados que aún no son pacientes)
// ═══════════════════════════════════════════════════════════════

export async function crearContacto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('crm', 'crear');

    const rut = textoOpcional(fd, 'rut');
    if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

    const origen = texto(fd, 'origen') as OrigenContacto;

    const contacto = await prisma.contacto.create({
      data: {
        nombre: requerido(fd, 'nombre', 'Nombre'),
        telefono: textoOpcional(fd, 'telefono'),
        email: textoOpcional(fd, 'email'),
        rut: rut ? normalizarRut(rut) : null,
        origen: ORIGENES.includes(origen) ? origen : 'OTRO',
        interes: textoOpcional(fd, 'interes'),
        observaciones: textoOpcional(fd, 'observaciones'),
        asignadoAId: textoOpcional(fd, 'asignadoAId') ?? sesion.usuarioId,
      },
    });

    // Un interesado sin seguimiento se pierde: se crea la tarea de una vez.
    const diasSeguimiento = parseInt(texto(fd, 'diasSeguimiento') || '2', 10);
    if (diasSeguimiento > 0) {
      await prisma.seguimiento.create({
        data: {
          titulo: `Contactar a ${contacto.nombre}`,
          descripcion: contacto.interes ? `Interés: ${contacto.interes}` : null,
          tipo: 'PROSPECTO',
          fechaVencimiento: new Date(Date.now() + diasSeguimiento * 86_400_000),
          contactoId: contacto.id,
          asignadoAId: contacto.asignadoAId,
          creadoPorId: sesion.usuarioId,
        },
      });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'crm',
      entidad: 'Contacto',
      entidadId: contacto.id,
    });

    revalidatePath('/crm');
    revalidatePath('/crm/contactos');
    return { ok: true as const, mensaje: `Interesado ${contacto.nombre} registrado.` };
  });
}

export async function editarContacto(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('crm', 'editar');
    const id = requerido(fd, 'id', 'Contacto');

    const rut = textoOpcional(fd, 'rut');
    if (rut && !validarRut(rut)) throw new Error('El RUT ingresado no es válido.');

    const origen = texto(fd, 'origen') as OrigenContacto;
    const estado = texto(fd, 'estado') as EstadoContacto;

    await prisma.contacto.update({
      where: { id },
      data: {
        nombre: requerido(fd, 'nombre', 'Nombre'),
        telefono: textoOpcional(fd, 'telefono'),
        email: textoOpcional(fd, 'email'),
        rut: rut ? normalizarRut(rut) : null,
        origen: ORIGENES.includes(origen) ? origen : 'OTRO',
        estado: ESTADOS.includes(estado) ? estado : 'NUEVO',
        interes: textoOpcional(fd, 'interes'),
        observaciones: textoOpcional(fd, 'observaciones'),
        asignadoAId: textoOpcional(fd, 'asignadoAId'),
        motivoPerdida: estado === 'PERDIDO' ? textoOpcional(fd, 'motivoPerdida') : null,
      },
    });

    revalidatePath('/crm/contactos');
    revalidatePath(`/crm/contactos/${id}`);
    return { ok: true as const, mensaje: 'Interesado actualizado.' };
  });
}

export async function cambiarEstadoContacto(fd: FormData): Promise<void> {
  await exigirPermiso('crm', 'editar');
  const id = String(fd.get('id'));
  const estado = String(fd.get('estado')) as EstadoContacto;
  if (!ESTADOS.includes(estado)) return;

  await prisma.contacto.update({
    where: { id },
    data: { estado, motivoPerdida: estado === 'PERDIDO' ? String(fd.get('motivoPerdida') ?? '') || null : null },
  });

  revalidatePath('/crm/contactos');
  revalidatePath(`/crm/contactos/${id}`);
}

/**
 * Convierte un interesado en paciente: crea la ficha con lo que ya se sabe de
 * él y deja ambos registros enlazados, para no perder de dónde vino.
 */
export async function convertirEnPaciente(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let pacienteId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('pacientes', 'crear');
    await exigirPermiso('crm', 'editar');

    const id = requerido(fd, 'id', 'Contacto');
    const contacto = await prisma.contacto.findUnique({ where: { id } });
    if (!contacto) throw new Error('El interesado no existe.');
    if (contacto.pacienteId) throw new Error('Este interesado ya tiene una ficha de paciente.');

    const telefono = contacto.telefono ?? texto(fd, 'telefono');
    if (!telefono) throw new Error('Se necesita un teléfono de contacto para crear la ficha.');

    if (contacto.rut) {
      const existente = await prisma.paciente.findUnique({ where: { rut: contacto.rut } });
      if (existente) {
        throw new Error(
          `Ya existe una ficha con el RUT ${contacto.rut} (Nº ${existente.numeroFicha}). Enlázala manualmente en vez de duplicarla.`,
        );
      }
    }

    // El nombre del interesado viene en un solo campo; se parte lo mejor posible
    // y queda editable en la ficha.
    const partes = contacto.nombre.trim().split(/\s+/);
    const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || contacto.nombre;
    const apellidoPaterno = partes.length > 1 ? partes[partes.length - 2] : '—';
    const apellidoMaterno = partes.length > 2 ? partes[partes.length - 1] : null;

    const paciente = await prisma.$transaction(async (tx) => {
      const creado = await tx.paciente.create({
        data: {
          nombres,
          apellidoPaterno,
          apellidoMaterno,
          rut: contacto.rut,
          telefonoPrincipal: telefono,
          email: contacto.email,
          comoNosConocio: contacto.origen.replace(/_/g, ' ').toLowerCase(),
          observaciones: contacto.interes ? `Interés inicial: ${contacto.interes}` : null,
          creadoPorId: sesion.usuarioId,
        },
      });

      await tx.contacto.update({
        where: { id },
        data: { pacienteId: creado.id, estado: 'CONVERTIDO', convertidoAt: new Date() },
      });

      // La bitácora del interesado pasa a colgar también del paciente.
      await tx.interaccion.updateMany({ where: { contactoId: id }, data: { pacienteId: creado.id } });

      return creado;
    });

    pacienteId = paciente.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'convertir',
      modulo: 'crm',
      entidad: 'Contacto',
      entidadId: id,
      detalle: { pacienteId: paciente.id },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/crm');
  redirect(`/pacientes/${pacienteId}/editar`);
}

export async function eliminarContacto(fd: FormData): Promise<void> {
  await exigirPermiso('crm', 'eliminar');
  const id = String(fd.get('id'));
  await prisma.contacto.delete({ where: { id } });
  revalidatePath('/crm/contactos');
  redirect('/crm/contactos');
}

// ═══════════════════════════════════════════════════════════════
//  Interacciones (bitácora)
// ═══════════════════════════════════════════════════════════════

export async function registrarInteraccion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('crm', 'crear');

    const contactoId = textoOpcional(fd, 'contactoId');
    const pacienteId = textoOpcional(fd, 'pacienteId');
    if (!contactoId && !pacienteId) throw new Error('La interacción debe referirse a un interesado o a un paciente.');

    const canal = texto(fd, 'canal') as CanalInteraccion;
    const sentido = texto(fd, 'sentido') as SentidoInteraccion;

    await prisma.interaccion.create({
      data: {
        contactoId,
        pacienteId,
        canal: CANALES.includes(canal) ? canal : 'LLAMADA',
        sentido: sentido === 'ENTRANTE' ? 'ENTRANTE' : 'SALIENTE',
        asunto: requerido(fd, 'asunto', 'Asunto'),
        detalle: textoOpcional(fd, 'detalle'),
        resultado: textoOpcional(fd, 'resultado'),
        fecha: fecha(fd, 'fecha') ?? new Date(),
        usuarioId: sesion.usuarioId,
      },
    });

    // Registrar un contacto hace avanzar automáticamente al interesado.
    if (contactoId) {
      const contacto = await prisma.contacto.findUnique({ where: { id: contactoId } });
      if (contacto?.estado === 'NUEVO') {
        await prisma.contacto.update({ where: { id: contactoId }, data: { estado: 'CONTACTADO' } });
      }
      revalidatePath(`/crm/contactos/${contactoId}`);
    }
    if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`);

    revalidatePath('/crm');
    return { ok: true as const, mensaje: 'Interacción registrada.' };
  });
}

// ═══════════════════════════════════════════════════════════════
//  Seguimientos (tareas)
// ═══════════════════════════════════════════════════════════════

export async function crearSeguimiento(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('crm', 'crear');

    const tipo = texto(fd, 'tipo') as TipoSeguimiento;
    const prioridad = texto(fd, 'prioridad') as Prioridad;

    await prisma.seguimiento.create({
      data: {
        titulo: requerido(fd, 'titulo', 'Título'),
        descripcion: textoOpcional(fd, 'descripcion'),
        tipo: TIPOS.includes(tipo) ? tipo : 'OTRO',
        prioridad: (['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as Prioridad[]).includes(prioridad)
          ? prioridad
          : 'NORMAL',
        fechaVencimiento: fechaRequerida(fd, 'fechaVencimiento', 'Fecha de vencimiento'),
        contactoId: textoOpcional(fd, 'contactoId'),
        pacienteId: textoOpcional(fd, 'pacienteId'),
        presupuestoId: textoOpcional(fd, 'presupuestoId'),
        asignadoAId: textoOpcional(fd, 'asignadoAId') ?? sesion.usuarioId,
        creadoPorId: sesion.usuarioId,
      },
    });

    revalidatePath('/crm');
    return { ok: true as const, mensaje: 'Seguimiento agendado.' };
  });
}

export async function completarSeguimiento(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('crm', 'editar');
    const id = requerido(fd, 'id', 'Seguimiento');

    const seguimiento = await prisma.seguimiento.findUnique({ where: { id } });
    if (!seguimiento) throw new Error('El seguimiento no existe.');

    const resultado = textoOpcional(fd, 'resultado');

    await prisma.$transaction(async (tx) => {
      await tx.seguimiento.update({
        where: { id },
        data: { estado: 'COMPLETADO', completadoAt: new Date(), resultado },
      });

      // Completar una tarea deja también constancia en la bitácora.
      if (seguimiento.contactoId || seguimiento.pacienteId) {
        await tx.interaccion.create({
          data: {
            contactoId: seguimiento.contactoId,
            pacienteId: seguimiento.pacienteId,
            canal: (texto(fd, 'canal') || 'LLAMADA') as CanalInteraccion,
            sentido: 'SALIENTE',
            asunto: seguimiento.titulo,
            resultado,
            usuarioId: sesion.usuarioId,
          },
        });
      }
    });

    // Permite encadenar el próximo contacto sin salir de la pantalla.
    const proximo = fecha(fd, 'proximoSeguimiento');
    if (proximo) {
      await prisma.seguimiento.create({
        data: {
          titulo: texto(fd, 'proximoTitulo') || `Volver a contactar — ${seguimiento.titulo}`,
          tipo: seguimiento.tipo,
          prioridad: seguimiento.prioridad,
          fechaVencimiento: proximo,
          contactoId: seguimiento.contactoId,
          pacienteId: seguimiento.pacienteId,
          presupuestoId: seguimiento.presupuestoId,
          asignadoAId: seguimiento.asignadoAId,
          creadoPorId: sesion.usuarioId,
        },
      });
    }

    revalidatePath('/crm');
    if (seguimiento.contactoId) revalidatePath(`/crm/contactos/${seguimiento.contactoId}`);
    return { ok: true as const, mensaje: 'Seguimiento completado.' };
  });
}

export async function posponerSeguimiento(fd: FormData): Promise<void> {
  await exigirPermiso('crm', 'editar');
  const id = String(fd.get('id'));
  const dias = parseInt(String(fd.get('dias') ?? '7'), 10) || 7;

  const seguimiento = await prisma.seguimiento.findUnique({ where: { id } });
  if (!seguimiento) return;

  // Se pospone desde hoy, no desde el vencimiento original: si ya estaba
  // atrasado, sumar sobre la fecha vieja lo dejaría vencido igual.
  await prisma.seguimiento.update({
    where: { id },
    data: { fechaVencimiento: new Date(Date.now() + dias * 86_400_000), estado: 'PENDIENTE' },
  });

  revalidatePath('/crm');
}

export async function cancelarSeguimiento(fd: FormData): Promise<void> {
  await exigirPermiso('crm', 'editar');
  const id = String(fd.get('id'));
  await prisma.seguimiento.update({ where: { id }, data: { estado: 'CANCELADO' } });
  revalidatePath('/crm');
}

/**
 * Crea seguimientos en lote desde una lista inteligente: recepción marca a
 * quiénes va a llamar y quedan como tareas con responsable y fecha.
 */
export async function agendarSeguimientosEnLote(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('crm', 'crear');

    const pacienteIds = [...new Set(fd.getAll('pacienteIds').map(String).filter(Boolean))];
    if (pacienteIds.length === 0) throw new Error('Selecciona al menos un paciente de la lista.');

    const tipo = texto(fd, 'tipo') as TipoSeguimiento;
    const dias = parseInt(texto(fd, 'dias') || '0', 10);
    const vencimiento = new Date(Date.now() + dias * 86_400_000);
    const asignadoAId = textoOpcional(fd, 'asignadoAId') ?? sesion.usuarioId;
    const plantilla = texto(fd, 'titulo') || 'Contactar paciente';

    const pacientes = await prisma.paciente.findMany({
      where: { id: { in: pacienteIds } },
      select: { id: true, nombres: true, apellidoPaterno: true },
    });

    await prisma.seguimiento.createMany({
      data: pacientes.map((p) => ({
        titulo: `${plantilla} — ${p.nombres} ${p.apellidoPaterno}`,
        tipo: TIPOS.includes(tipo) ? tipo : 'RECALL',
        fechaVencimiento: vencimiento,
        pacienteId: p.id,
        asignadoAId,
        creadoPorId: sesion.usuarioId,
      })),
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear_lote',
      modulo: 'crm',
      entidad: 'Seguimiento',
      detalle: { cantidad: pacientes.length, tipo },
    });

    revalidatePath('/crm');
    return { ok: true as const, mensaje: `${pacientes.length} seguimiento(s) agendado(s).` };
  });
}
