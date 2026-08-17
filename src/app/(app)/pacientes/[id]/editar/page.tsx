import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { EncabezadoPagina } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { editarPaciente } from '../../acciones';
import { CamposPaciente } from '../../campos';

export const metadata = { title: 'Editar paciente' };

export default async function PaginaEditarPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requerirPermiso('pacientes', 'editar');

  const [paciente, convenios, previsiones] = await Promise.all([
    prisma.paciente.findUnique({ where: { id } }),
    prisma.convenio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tipo: true },
    }),
    prisma.prevision.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, tipo: true, requiereDetalle: true, etiquetaDetalle: true },
    }),
  ]);
  if (!paciente) notFound();

  return (
    <>
      <EncabezadoPagina
        titulo={`Editar ficha Nº ${paciente.numeroFicha}`}
        descripcion={`${paciente.nombres} ${paciente.apellidoPaterno}`}
        volver={{ href: `/pacientes/${id}`, texto: 'Volver a la ficha' }}
      />

      <Formulario accion={editarPaciente} className="mx-auto max-w-4xl">
        <input type="hidden" name="id" value={paciente.id} />
        <CamposPaciente valores={paciente} convenios={convenios} previsiones={previsiones} />
        <div className="sticky bottom-4 mt-5 flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Guardar cambios</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
