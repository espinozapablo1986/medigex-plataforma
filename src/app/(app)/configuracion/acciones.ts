'use server';

import { revalidatePath } from 'next/cache';

import type { TipoPrevision } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, slugificar, validarRut } from '@/lib/format';
import {
  booleano,
  decimal,
  entero,
  intentar,
  requerido,
  texto,
  textoOpcional,
  type Resultado,
} from '@/lib/resultado';

const TIPOS_PREVISION: TipoPrevision[] = ['FONASA', 'ISAPRE', 'PARTICULAR', 'SEGURO_COMPLEMENTARIO', 'OTRO'];

export async function guardarConfiguracion(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('configuracion', 'editar');

    const rut = textoOpcional(fd, 'rut');
    if (rut && !validarRut(rut)) throw new Error('El RUT del centro no es válido.');

    const iva = decimal(fd, 'ivaPorcentaje', 19);
    if (iva < 0 || iva > 100) throw new Error('El porcentaje de IVA debe estar entre 0 y 100.');

    // Los días hábiles llegan como varios checkbox con el mismo nombre.
    const dias = fd.getAll('diasHabiles').map(String).join(',');

    const datos = {
      nombreClinica: requerido(fd, 'nombreClinica', 'Nombre del centro'),
      rut: rut ? normalizarRut(rut) : null,
      giro: textoOpcional(fd, 'giro'),
      direccion: textoOpcional(fd, 'direccion'),
      comuna: textoOpcional(fd, 'comuna'),
      ciudad: textoOpcional(fd, 'ciudad'),
      telefono: textoOpcional(fd, 'telefono'),
      email: textoOpcional(fd, 'email'),
      sitioWeb: textoOpcional(fd, 'sitioWeb'),
      ivaPorcentaje: iva,
      moneda: texto(fd, 'moneda') || 'CLP',
      zonaHoraria: texto(fd, 'zonaHoraria') || 'America/Santiago',
      horaApertura: texto(fd, 'horaApertura') || '08:00',
      horaCierre: texto(fd, 'horaCierre') || '20:00',
      diasHabiles: dias || '1,2,3,4,5',
      duracionSlotDefecto: Math.max(5, entero(fd, 'duracionSlotDefecto', 30)),
    };

    await prisma.configuracion.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...datos },
      update: datos,
    });

    await auditar({ usuarioId: sesion.usuarioId, accion: 'editar', modulo: 'configuracion', entidad: 'Configuracion' });

    revalidatePath('/configuracion');
    revalidatePath('/', 'layout');
    return { ok: true as const, mensaje: 'Configuración guardada.' };
  });
}

// ═══════════════════════════════════════════════════════════════
//  Mantenedor de previsiones
// ═══════════════════════════════════════════════════════════════

export async function guardarPrevision(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('configuracion', 'editar');

    const id = textoOpcional(fd, 'id');
    const nombre = requerido(fd, 'nombre', 'Nombre');
    const tipo = texto(fd, 'tipo') as TipoPrevision;
    const codigo = (texto(fd, 'codigo') || slugificar(nombre)).toUpperCase().slice(0, 40);

    const existente = await prisma.prevision.findUnique({ where: { codigo } });
    if (existente && existente.id !== id) {
      throw new Error(`Ya existe una previsión con el código ${codigo}.`);
    }

    const datos = {
      codigo,
      nombre,
      tipo: TIPOS_PREVISION.includes(tipo) ? tipo : ('OTRO' as TipoPrevision),
      requiereDetalle: booleano(fd, 'requiereDetalle'),
      etiquetaDetalle: textoOpcional(fd, 'etiquetaDetalle'),
      orden: entero(fd, 'orden'),
    };

    if (id) {
      await prisma.prevision.update({ where: { id }, data: datos });
    } else {
      await prisma.prevision.create({ data: datos });
    }

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: id ? 'editar' : 'crear',
      modulo: 'configuracion',
      entidad: 'Prevision',
      entidadId: id ?? undefined,
      detalle: { nombre, codigo },
    });

    revalidatePath('/configuracion');
    revalidatePath('/pacientes');
    return { ok: true as const, mensaje: `Previsión ${nombre} guardada.` };
  });
}

export async function alternarActivoPrevision(fd: FormData): Promise<void> {
  await exigirPermiso('configuracion', 'editar');
  const id = String(fd.get('id'));
  const prevision = await prisma.prevision.findUnique({ where: { id } });
  if (!prevision) return;
  await prisma.prevision.update({ where: { id }, data: { activo: !prevision.activo } });
  revalidatePath('/configuracion');
}

export async function eliminarPrevision(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('configuracion', 'editar');
  const id = String(fd.get('id'));

  const enUso = await prisma.paciente.count({ where: { previsionId: id } });
  if (enUso > 0) {
    throw new Error(
      `Esta previsión está asignada a ${enUso} paciente(s) y no puede eliminarse. Desactívala para sacarla del listado.`,
    );
  }

  await prisma.prevision.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'configuracion',
    entidad: 'Prevision',
    entidadId: id,
  });
  revalidatePath('/configuracion');
}
