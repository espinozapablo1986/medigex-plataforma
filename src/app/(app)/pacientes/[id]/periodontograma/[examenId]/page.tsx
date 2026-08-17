import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { filasDe } from '@/lib/dental';
import { fechaCorta, humanizar } from '@/lib/format';
import { EncabezadoPagina } from '@/components/ui';
import { BotonEliminar } from '@/components/formulario';

import { eliminarPeriodontograma } from '../acciones';
import { TablaPeriodontal, type PiezaVista } from './tabla';

export const metadata = { title: 'Periodontograma' };

export default async function DetallePeriodontograma({
  params,
}: {
  params: Promise<{ id: string; examenId: string }>;
}) {
  const { id, examenId } = await params;
  const sesion = await requerirPermiso('periodontograma', 'ver');

  const examen = await prisma.periodontograma.findUnique({
    where: { id: examenId },
    include: {
      paciente: { select: { id: true, nombres: true, apellidoPaterno: true } },
      profesional: { select: { nombres: true, apellidos: true } },
      piezas: { include: { sitios: true } },
    },
  });
  if (!examen || examen.pacienteId !== id) notFound();

  const { superior, inferior } = filasDe(examen.denticion);

  const aVista = (codigos: { codigo: string }[]): PiezaVista[] =>
    codigos.map((c) => {
      const guardada = examen.piezas.find((p) => p.pieza === c.codigo);
      return {
        pieza: c.codigo,
        ausente: guardada?.ausente ?? false,
        implante: guardada?.implante ?? false,
        movilidad: guardada?.movilidad ?? null,
        furcaVestibular: guardada?.furcaVestibular ?? null,
        furcaPalatina: guardada?.furcaPalatina ?? null,
        notas: guardada?.notas ?? null,
        sitios: (guardada?.sitios ?? []).map((s) => ({
          cara: s.cara,
          posicion: s.posicion,
          profundidad: s.profundidad,
          margen: s.margen,
          placa: s.placa,
          sangrado: s.sangrado,
          supuracion: s.supuracion,
        })),
      };
    });

  return (
    <>
      <EncabezadoPagina
        titulo={`Periodontograma del ${fechaCorta(examen.fecha)}`}
        descripcion={`${examen.paciente.nombres} ${examen.paciente.apellidoPaterno} · dentición ${humanizar(
          examen.denticion,
        ).toLowerCase()}${
          examen.profesional ? ` · ${examen.profesional.nombres} ${examen.profesional.apellidos}` : ''
        }`}
        volver={{ href: `/pacientes/${id}/periodontograma`, texto: 'Periodontogramas' }}
        acciones={
          puede(sesion, 'periodontograma', 'eliminar') && (
            <BotonEliminar
              accion={eliminarPeriodontograma}
              id={examenId}
              variante="peligro"
              mensaje="¿Eliminar este examen periodontal? Se pierden todas sus mediciones."
            />
          )
        }
      />

      <TablaPeriodontal
        examenId={examenId}
        pacienteId={id}
        piezasSuperiores={aVista(superior)}
        piezasInferiores={aVista(inferior)}
        observaciones={examen.observaciones}
        puedeEditar={puede(sesion, 'periodontograma', 'editar')}
      />
    </>
  );
}
