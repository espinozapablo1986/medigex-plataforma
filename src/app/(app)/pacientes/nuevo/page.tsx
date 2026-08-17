import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { EncabezadoPagina } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { crearPaciente } from '../acciones';
import { CamposPaciente } from '../campos';

export const metadata = { title: 'Nuevo paciente' };

export default async function PaginaNuevoPaciente() {
  await requerirPermiso('pacientes', 'crear');

  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, tipo: true },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo paciente"
        descripcion="Al guardar se crea la ficha clínica del paciente con su número correlativo."
        volver={{ href: '/pacientes', texto: 'Pacientes' }}
      />

      <Formulario accion={crearPaciente} className="mx-auto max-w-4xl">
        <CamposPaciente convenios={convenios} />
        <div className="sticky bottom-4 mt-5 flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Crear ficha del paciente</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
