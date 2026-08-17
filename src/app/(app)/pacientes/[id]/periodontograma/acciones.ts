'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { CARAS_PERIODONTALES, SITIOS, filasDe } from '@/lib/dental';
import { fecha, intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

const esquemaSitio = z.object({
  cara: z.enum(['VESTIBULAR', 'PALATINO_LINGUAL']),
  posicion: z.enum(['MESIAL', 'CENTRAL', 'DISTAL']),
  profundidad: z.number().int().min(0).max(20),
  margen: z.number().int().min(-15).max(15),
  placa: z.boolean(),
  sangrado: z.boolean(),
  supuracion: z.boolean(),
});

const esquemaPieza = z.object({
  pieza: z.string().min(3),
  ausente: z.boolean(),
  implante: z.boolean().optional().default(false),
  movilidad: z.number().int().min(0).max(3).nullable(),
  furcaVestibular: z.number().int().min(0).max(3).nullable(),
  furcaPalatina: z.number().int().min(0).max(3).nullable(),
  notas: z.string().nullable(),
  sitios: z.array(esquemaSitio),
});

/**
 * Crea un examen periodontal nuevo, con las 32 piezas y sus seis sitios en
 * cero. Se registra completo desde el inicio para que el profesional sólo
 * tenga que ir corrigiendo los valores que difieren.
 */
export async function crearPeriodontograma(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevoId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('periodontograma', 'crear');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const denticion = texto(fd, 'denticion') === 'TEMPORAL' ? 'TEMPORAL' : 'PERMANENTE';

    const { superior, inferior } = filasDe(denticion);
    const piezas = [...superior, ...inferior];

    const periodontograma = await prisma.$transaction(async (tx) => {
      const creado = await tx.periodontograma.create({
        data: {
          pacienteId,
          atencionId: textoOpcional(fd, 'atencionId'),
          profesionalId: textoOpcional(fd, 'profesionalId') ?? sesion.profesionalId,
          fecha: fecha(fd, 'fecha') ?? new Date(),
          denticion,
          observaciones: textoOpcional(fd, 'observaciones'),
        },
      });

      for (const pieza of piezas) {
        const registro = await tx.periodontogramaPieza.create({
          data: { periodontogramaId: creado.id, pieza: pieza.codigo },
        });

        await tx.periodontogramaSitio.createMany({
          data: CARAS_PERIODONTALES.flatMap((cara) =>
            SITIOS.map((posicion) => ({ piezaId: registro.id, cara, posicion })),
          ),
        });
      }

      return creado;
    });

    nuevoId = periodontograma.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'periodontograma',
      entidad: 'Periodontograma',
      entidadId: periodontograma.id,
    });
  });

  if (!resultado.ok) return resultado;
  const pacienteId = texto(fd, 'pacienteId');
  revalidatePath(`/pacientes/${pacienteId}/periodontograma`);
  redirect(`/pacientes/${pacienteId}/periodontograma/${nuevoId}`);
}

/**
 * Guarda el examen completo de una vez.
 *
 * Llega como JSON desde el navegador porque son casi 200 valores: enviarlos
 * como campos sueltos haría el formulario inmanejable, y guardarlos uno a uno
 * dejaría el examen a medias si se corta la conexión.
 */
export async function guardarPeriodontograma(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('periodontograma', 'editar');
    const id = requerido(fd, 'id', 'Periodontograma');
    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');

    const crudo = texto(fd, 'datos');
    if (!crudo) throw new Error('No llegaron las mediciones.');

    let parseado: unknown;
    try {
      parseado = JSON.parse(crudo);
    } catch {
      throw new Error('No se pudieron leer las mediciones.');
    }

    const validado = z.array(esquemaPieza).safeParse(parseado);
    if (!validado.success) {
      throw new Error(validado.error.issues[0]?.message ?? 'Hay mediciones fuera de rango.');
    }

    const existentes = await prisma.periodontogramaPieza.findMany({
      where: { periodontogramaId: id },
      select: { id: true, pieza: true },
    });
    const porCodigo = new Map(existentes.map((p) => [p.pieza, p.id]));

    await prisma.$transaction(async (tx) => {
      for (const pieza of validado.data) {
        const piezaId = porCodigo.get(pieza.pieza);
        if (!piezaId) continue;

        await tx.periodontogramaPieza.update({
          where: { id: piezaId },
          data: {
            ausente: pieza.ausente,
            implante: pieza.implante,
            movilidad: pieza.movilidad,
            furcaVestibular: pieza.furcaVestibular,
            furcaPalatina: pieza.furcaPalatina,
            notas: pieza.notas,
          },
        });

        for (const sitio of pieza.sitios) {
          await tx.periodontogramaSitio.update({
            where: {
              piezaId_cara_posicion: { piezaId, cara: sitio.cara, posicion: sitio.posicion },
            },
            data: {
              profundidad: sitio.profundidad,
              margen: sitio.margen,
              placa: sitio.placa,
              sangrado: sitio.sangrado,
              supuracion: sitio.supuracion,
            },
          });
        }
      }

      await tx.periodontograma.update({
        where: { id },
        data: { observaciones: textoOpcional(fd, 'observaciones') },
      });
    });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'editar',
      modulo: 'periodontograma',
      entidad: 'Periodontograma',
      entidadId: id,
    });

    revalidatePath(`/pacientes/${pacienteId}/periodontograma/${id}`);
    return { ok: true as const, mensaje: 'Periodontograma guardado.' };
  });
}

export async function eliminarPeriodontograma(fd: FormData): Promise<void> {
  const sesion = await exigirPermiso('periodontograma', 'eliminar');
  const id = String(fd.get('id'));

  const registro = await prisma.periodontograma.findUnique({ where: { id } });
  if (!registro) return;

  await prisma.periodontograma.delete({ where: { id } });
  await auditar({
    usuarioId: sesion.usuarioId,
    accion: 'eliminar',
    modulo: 'periodontograma',
    entidad: 'Periodontograma',
    entidadId: id,
  });

  redirect(`/pacientes/${registro.pacienteId}/periodontograma`);
}
