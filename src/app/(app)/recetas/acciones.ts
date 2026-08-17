'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { TipoReceta } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auditar, exigirPermiso } from '@/lib/auth';
import { fecha, intentar, requerido, texto, textoOpcional, type Resultado } from '@/lib/resultado';

const TIPOS: TipoReceta[] = ['SIMPLE', 'RETENIDA', 'CHEQUE_MEDICO', 'MAGISTRAL'];

const esquemaMedicamento = z.object({
  medicamento: z.string().min(1, 'Cada línea necesita el nombre del medicamento.'),
  principioActivo: z.string().optional().default(''),
  presentacion: z.string().optional().default(''),
  dosis: z.string().optional().default(''),
  via: z.string().optional().default(''),
  frecuencia: z.string().optional().default(''),
  duracion: z.string().optional().default(''),
  cantidad: z.string().optional().default(''),
  indicaciones: z.string().optional().default(''),
});

function leerMedicamentos(fd: FormData) {
  const crudo = texto(fd, 'medicamentos');
  if (!crudo) throw new Error('La receta debe incluir al menos un medicamento.');

  let parseado: unknown;
  try {
    parseado = JSON.parse(crudo);
  } catch {
    throw new Error('No se pudieron leer los medicamentos de la receta.');
  }

  const resultado = z
    .array(esquemaMedicamento)
    .min(1, 'La receta debe incluir al menos un medicamento.')
    .safeParse(parseado);

  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? 'Los medicamentos de la receta no son válidos.');
  }
  return resultado.data;
}

export async function crearReceta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  let nuevaId = '';

  const resultado = await intentar(async () => {
    const sesion = await exigirPermiso('recetas', 'crear');

    const pacienteId = requerido(fd, 'pacienteId', 'Paciente');
    const profesionalId = requerido(fd, 'profesionalId', 'Profesional');
    const medicamentos = leerMedicamentos(fd);
    const tipo = texto(fd, 'tipo') as TipoReceta;

    // Las recetas retenidas y los cheques médicos exigen diagnóstico.
    const diagnostico = textoOpcional(fd, 'diagnostico');
    if ((tipo === 'RETENIDA' || tipo === 'CHEQUE_MEDICO') && !diagnostico) {
      throw new Error('Las recetas retenidas y los cheques médicos requieren indicar el diagnóstico.');
    }

    const receta = await prisma.receta.create({
      data: {
        pacienteId,
        profesionalId,
        atencionId: textoOpcional(fd, 'atencionId'),
        tipo: TIPOS.includes(tipo) ? tipo : ('SIMPLE' as TipoReceta),
        fecha: fecha(fd, 'fecha') ?? new Date(),
        diagnostico,
        indicacionesGenerales: textoOpcional(fd, 'indicacionesGenerales'),
        vigenteHasta: fecha(fd, 'vigenteHasta'),
        firmadaAt: new Date(),
        items: {
          createMany: {
            data: medicamentos.map((m, orden) => ({
              medicamento: m.medicamento,
              principioActivo: m.principioActivo || null,
              presentacion: m.presentacion || null,
              dosis: m.dosis || null,
              via: m.via || null,
              frecuencia: m.frecuencia || null,
              duracion: m.duracion || null,
              cantidad: m.cantidad || null,
              indicaciones: m.indicaciones || null,
              orden,
            })),
          },
        },
      },
    });

    nuevaId = receta.id;

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'crear',
      modulo: 'recetas',
      entidad: 'Receta',
      entidadId: receta.id,
      detalle: { folio: receta.folio, pacienteId, medicamentos: medicamentos.length },
    });
  });

  if (!resultado.ok) return resultado;
  revalidatePath('/recetas');
  redirect(`/recetas/${nuevaId}`);
}

export async function anularReceta(_previo: Resultado | null, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const sesion = await exigirPermiso('recetas', 'anular');
    const id = requerido(fd, 'id', 'Receta');

    const receta = await prisma.receta.findUnique({ where: { id } });
    if (!receta) throw new Error('La receta no existe.');

    await prisma.receta.update({ where: { id }, data: { anulada: true } });

    await auditar({
      usuarioId: sesion.usuarioId,
      accion: 'anular',
      modulo: 'recetas',
      entidad: 'Receta',
      entidadId: id,
      detalle: { motivo: texto(fd, 'motivo') },
    });

    revalidatePath(`/recetas/${id}`);
    revalidatePath('/recetas');
    return { ok: true as const, mensaje: 'Receta anulada.' };
  });
}
