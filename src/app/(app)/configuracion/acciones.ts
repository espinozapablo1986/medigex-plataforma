'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { normalizarRut, validarRut } from '@/lib/format';
import { decimal, entero, intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

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
