import 'server-only';

import { notFound } from 'next/navigation';
import { prisma } from './prisma';

/**
 * Carga los datos que necesita la cabecera de la ficha del paciente,
 * junto con su saldo y los contadores de las pestañas.
 */
export async function cargarPacienteConCabecera(id: string) {
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      convenio: { select: { id: true, nombre: true, tipo: true, coberturaPorcentaje: true } },
      movimientosCuenta: {
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { saldoResultante: true },
      },
      _count: { select: { atenciones: true, examenes: true, adjuntos: true, recetas: true } },
    },
  });

  if (!paciente) notFound();

  return {
    paciente,
    saldo: paciente.movimientosCuenta[0]?.saldoResultante ?? 0,
    contadores: {
      atenciones: paciente._count.atenciones,
      examenes: paciente._count.examenes,
      archivos: paciente._count.adjuntos,
      recetas: paciente._count.recetas,
    },
  };
}
