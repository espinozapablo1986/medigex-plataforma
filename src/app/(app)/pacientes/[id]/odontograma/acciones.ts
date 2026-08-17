'use server';

import { revalidatePath } from 'next/cache';
import type { CaraDental, EstadoRegistroDental, TipoDenticion } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { buscarPieza, CARAS } from '@/lib/dental';
import { intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

const ESTADOS: EstadoRegistroDental[] = ['PENDIENTE', 'REALIZADO', 'ANULADO'];

function leerCaras(fd: FormData): CaraDental[] {
  const elegidas = fd.getAll('caras').map(String);
  return elegidas.filter((c): c is CaraDental => (CARAS as readonly string[]).includes(c));
}

/**
 * Registra un hallazgo o un procedimiento sobre una o varias piezas.
 *
 * Acepta varias piezas de una vez porque en la práctica se marca lo mismo en
 * varios dientes: cuatro obturaciones del mismo tipo, una tanda de sellantes.
 */
export async function registrarEnOdontograma(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('odontograma', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const condicionId = requerido(fd, 'condicionId', 'Condición');
    const piezas = [...new Set(fd.getAll('piezas').map(String).filter(Boolean))];
    if (piezas.length === 0) throw new Error('Selecciona al menos una pieza.');

    for (const codigo of piezas) {
      if (!buscarPieza(codigo)) throw new Error(`La pieza ${codigo} no existe en la notación FDI.`);
    }

    const condicion = await prisma.condicionDental.findUnique({ where: { id: condicionId } });
    if (!condicion) throw new Error('La condición no existe.');

    const caras = leerCaras(fd);
    if (condicion.porCara && caras.length === 0) {
      throw new Error(`«${condicion.nombre}» se marca sobre caras: indica al menos una.`);
    }

    const estado = texto(fd, 'estado') as EstadoRegistroDental;
    const denticion = (texto(fd, 'denticion') || 'PERMANENTE') as TipoDenticion;

    await prisma.registroOdontograma.createMany({
      data: piezas.map((pieza) => ({
        pacienteId,
        atencionId: textoOpcional(fd, 'atencionId'),
        profesionalId: textoOpcional(fd, 'profesionalId') ?? sesion.profesionalId,
        condicionId,
        denticion,
        pieza,
        caras: condicion.porCara ? caras : ['PIEZA_COMPLETA' as CaraDental],
        estado: ESTADOS.includes(estado) ? estado : 'REALIZADO',
        observaciones: textoOpcional(fd, 'observaciones'),
      })),
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'odontograma',
      entidad: 'RegistroOdontograma',
      entidadId: pacienteId,
      detalle: { condicion: condicion.nombre, piezas, caras },
    });

    revalidatePath(`/pacientes/${pacienteId}/odontograma`);
    return {
      ok: true as const,
      mensaje: `${condicion.nombre} registrado en ${piezas.length} pieza(s).`,
    };
  });
}

export async function editarRegistroOdontograma(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('odontograma', 'editar');
    const id = requerido(fd, 'id', 'Registro');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const estado = texto(fd, 'estado') as EstadoRegistroDental;

    await prisma.registroOdontograma.update({
      where: { id },
      data: {
        estado: ESTADOS.includes(estado) ? estado : undefined,
        observaciones: textoOpcional(fd, 'observaciones'),
      },
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'odontograma',
      entidad: 'RegistroOdontograma',
      entidadId: id,
    });

    revalidatePath(`/pacientes/${pacienteId}/odontograma`);
    return { ok: true as const, mensaje: 'Registro actualizado.' };
  });
}

/** Marca un pendiente como ejecutado, dejando ambos registros enlazados. */
export async function completarPendiente(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('odontograma', 'editar');
  const id = String(fd.get('id'));

  const pendiente = await prisma.registroOdontograma.findUnique({ where: { id } });
  if (!pendiente || pendiente.estado !== 'PENDIENTE') return;

  await prisma.$transaction(async (tx) => {
    const realizado = await tx.registroOdontograma.create({
      data: {
        pacienteId: pendiente.pacienteId,
        atencionId: pendiente.atencionId,
        profesionalId: sesion.profesionalId ?? pendiente.profesionalId,
        condicionId: pendiente.condicionId,
        denticion: pendiente.denticion,
        pieza: pendiente.pieza,
        caras: pendiente.caras,
        estado: 'REALIZADO',
        observaciones: pendiente.observaciones,
      },
    });

    await tx.registroOdontograma.update({
      where: { id },
      data: { estado: 'ANULADO', realizadoPorRegistroId: realizado.id },
    });
  });

  revalidatePath(`/pacientes/${pendiente.pacienteId}/odontograma`);
}

export async function eliminarRegistroOdontograma(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('odontograma', 'eliminar');
  const id = String(fd.get('id'));

  const registro = await prisma.registroOdontograma.findUnique({ where: { id } });
  if (!registro) return;

  await prisma.registroOdontograma.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'odontograma',
    entidad: 'RegistroOdontograma',
    entidadId: id,
  });

  revalidatePath(`/pacientes/${registro.pacienteId}/odontograma`);
}

/**
 * Arma un presupuesto con todo lo que quedó pendiente en el odontograma.
 * Evita volver a escribir a mano lo que el profesional ya marcó en el esquema.
 */
export async function presupuestarPendientes(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('presupuestos', 'crear');
    await exigirPermiso('odontograma', 'ver');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');

    const pendientes = await prisma.registroOdontograma.findMany({
      where: { pacienteId, estado: 'PENDIENTE' },
      include: { condicion: { include: { servicio: true } } },
      orderBy: { pieza: 'asc' },
    });

    if (pendientes.length === 0) throw new Error('No hay procedimientos pendientes en el odontograma.');

    const conServicio = pendientes.filter((p) => p.condicion.servicio);
    if (conServicio.length === 0) {
      throw new Error(
        'Ninguna de las condiciones pendientes tiene un servicio asociado. Vincúlalas en Configuración → Condiciones dentales para poder presupuestarlas.',
      );
    }

    const config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } });
    const tasaIva = (config?.ivaPorcentaje ?? 19) / 100;

    const lineas = conServicio.map((p, orden) => {
      const servicio = p.condicion.servicio!;
      return {
        tipo: 'SERVICIO' as const,
        servicioId: servicio.id,
        descripcion: `${p.condicion.nombre} — pieza ${p.pieza}`,
        piezaDental: p.pieza,
        cantidad: 1,
        precioUnitario: servicio.precio,
        descuento: 0,
        total: servicio.precio,
        afectoIva: servicio.afectoIva,
        orden,
      };
    });

    const subtotal = lineas.reduce((acc, l) => acc + l.total, 0);
    const brutoAfecto = lineas.filter((l) => l.afectoIva).reduce((acc, l) => acc + l.total, 0);
    const netoAfecto = tasaIva > 0 ? Math.round(brutoAfecto / (1 + tasaIva)) : brutoAfecto;
    const iva = brutoAfecto - netoAfecto;

    const validez = new Date();
    validez.setDate(validez.getDate() + 30);

    const presupuesto = await prisma.presupuesto.create({
      data: {
        pacienteId,
        profesionalId: sesion.profesionalId,
        validoHasta: validez,
        observaciones: `Generado desde el odontograma · ${conServicio.length} procedimiento(s) pendiente(s).`,
        subtotal,
        neto: subtotal - iva,
        iva,
        total: subtotal,
        creadoPorId: sesion.usuarioId,
        items: { createMany: { data: lineas } },
      },
    });
    nuevoId = presupuesto.id;

    const sinServicio = pendientes.length - conServicio.length;
    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'presupuestar_odontograma',
      modulo: 'odontograma',
      entidad: 'Presupuesto',
      entidadId: presupuesto.id,
      detalle: { pendientes: pendientes.length, presupuestados: conServicio.length, sinServicio },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/presupuestos');
  return { ok: true as const, mensaje: `Presupuesto creado. Ábrelo en /presupuestos/${nuevoId}` };
}

// ─────────────────────────────────────────────────────────────
//  Mantenedor de condiciones dentales
// ─────────────────────────────────────────────────────────────

export async function guardarCondicionDental(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await exigirPermiso('configuracion', 'editar');

    const id = textoOpcional(fd, 'id');
    const nombre = requerido(fd, 'nombre', 'Nombre');
    const codigo = (texto(fd, 'codigo') || nombre).toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30);

    const existente = await prisma.condicionDental.findUnique({ where: { codigo } });
    if (existente && existente.id !== id) throw new Error(`Ya existe una condición con el código ${codigo}.`);

    const datos = {
      codigo,
      nombre,
      categoria: (texto(fd, 'categoria') || 'DIAGNOSTICO') as never,
      color: texto(fd, 'color') || '#B94642',
      porCara: fd.get('porCara') === 'on',
      servicioId: textoOpcional(fd, 'servicioId'),
      orden: parseInt(texto(fd, 'orden') || '50', 10) || 50,
    };

    if (id) {
      await prisma.condicionDental.update({ where: { id }, data: datos });
    } else {
      await prisma.condicionDental.create({ data: datos });
    }

    revalidatePath('/configuracion');
    return { ok: true as const, mensaje: `Condición ${nombre} guardada.` };
  });
}

export async function alternarActivoCondicion(fd: FormData): Promise<void> {
  await exigirPermiso('configuracion', 'editar');
  const id = String(fd.get('id'));
  const condicion = await prisma.condicionDental.findUnique({ where: { id } });
  if (!condicion) return;
  await prisma.condicionDental.update({ where: { id }, data: { activo: !condicion.activo } });
  revalidatePath('/configuracion');
}
