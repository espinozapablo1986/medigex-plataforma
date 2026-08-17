import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { formatearRut, isoFecha } from '@/lib/format';
import { Aviso, EncabezadoPagina } from '@/components/ui';
import { Formulario } from '@/components/formulario';

import { crearCita } from '../acciones';
import { FormularioCita } from './formulario-cita';

export const metadata = { title: 'Agendar hora' };

export default async function PaginaNuevaCita({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; fecha?: string }>;
}) {
  await requerirPermiso('agenda', 'crear');
  const { paciente: pacienteId, fecha: fechaTexto } = await searchParams;

  const dia = fechaTexto ? new Date(`${fechaTexto}T12:00:00`) : new Date();

  const [pacientes, profesionales, servicios, boxes, pacienteSeleccionado] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        rut: true,
        numeroFicha: true,
        telefonoPrincipal: true,
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, precio: true, duracionMinutos: true, usaRayosX: true, tipoBoxRequerido: true },
    }),
    prisma.box.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, nombre: true, tipo: true },
    }),
    pacienteId
      ? prisma.paciente.findUnique({
          where: { id: pacienteId },
          select: { nombres: true, alergias: true },
        })
      : null,
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Agendar hora"
        descripcion="Elige los servicios de la sesión y el sistema propone las horas libres del profesional."
        volver={{ href: `/agenda?fecha=${isoFecha(dia)}`, texto: 'Agenda' }}
      />

      {pacienteSeleccionado?.alergias && (
        <div className="mb-4">
          <Aviso tono="error" titulo={`Alergias de ${pacienteSeleccionado.nombres}`}>
            {pacienteSeleccionado.alergias}
          </Aviso>
        </div>
      )}

      <Formulario accion={crearCita}>
        <FormularioCita
          pacientes={pacientes.map((p) => ({
            valor: p.id,
            etiqueta: `${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}, ${p.nombres}`.replace(/\s+/g, ' '),
            detalle: `${formatearRut(p.rut) || `Ficha ${p.numeroFicha}`} · ${p.telefonoPrincipal}`,
            buscarPor: `${p.rut ?? ''} ${p.telefonoPrincipal} ${p.numeroFicha}`,
          }))}
          profesionales={profesionales.map((p) => ({
            valor: p.id,
            etiqueta: `${p.apellidos}, ${p.nombres}`,
            detalle: p.especialidad,
          }))}
          servicios={servicios}
          boxes={boxes}
          pacientePreseleccionado={pacienteId}
          fechaInicial={isoFecha(dia)}
          volverA={`/agenda?fecha=${isoFecha(dia)}`}
        />
      </Formulario>
    </>
  );
}
