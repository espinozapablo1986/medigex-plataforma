import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { cuposDelDia } from '@/lib/agenda';
import { clp, humanizar, isoFecha } from '@/lib/format';
import { Aviso, Campo, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { crearCita } from '../acciones';
import { SelectorCupos } from './selector-cupos';

export const metadata = { title: 'Agendar hora' };

export default async function PaginaNuevaCita({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; profesional?: string; fecha?: string; servicio?: string }>;
}) {
  await requerirPermiso('agenda', 'crear');
  const { paciente: pacienteId, profesional: profesionalId, fecha: fechaTexto, servicio: servicioId } = await searchParams;

  const dia = fechaTexto ? new Date(`${fechaTexto}T12:00:00`) : new Date();

  const [pacientes, profesionales, servicios, boxes, pacienteSeleccionado] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, rut: true, numeroFicha: true },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, duracionMinutos: true, precio: true, usaRayosX: true, tipoBoxRequerido: true },
    }),
    prisma.box.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' } }),
    pacienteId
      ? prisma.paciente.findUnique({
          where: { id: pacienteId },
          select: { id: true, nombres: true, apellidoPaterno: true, alergias: true, numeroFicha: true },
        })
      : null,
  ]);

  // Cupos libres si ya se eligió profesional y fecha.
  const cupos = profesionalId ? await cuposDelDia(profesionalId, dia) : [];

  return (
    <>
      <EncabezadoPagina
        titulo="Agendar hora"
        descripcion="El sistema valida que el profesional y el box estén libres antes de confirmar."
        volver={{ href: `/agenda?fecha=${isoFecha(dia)}`, texto: 'Agenda' }}
      />

      {pacienteSeleccionado?.alergias && (
        <div className="mb-4">
          <Aviso tono="error" titulo={`Alergias de ${pacienteSeleccionado.nombres}`}>
            {pacienteSeleccionado.alergias}
          </Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta titulo="Datos de la hora">
            <Formulario accion={crearCita} className="space-y-4">
              <input type="hidden" name="volverA" value={`/agenda?fecha=${isoFecha(dia)}`} />

              <Campo etiqueta="Paciente" requerido>
                <select name="pacienteId" defaultValue={pacienteId ?? ''} required className="campo">
                  <option value="">Busca y selecciona un paciente…</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.apellidoPaterno} {p.apellidoMaterno ?? ''}, {p.nombres} — {p.rut ?? `Ficha ${p.numeroFicha}`}
                    </option>
                  ))}
                </select>
              </Campo>

              <Grilla cols={2}>
                <Campo etiqueta="Profesional" requerido>
                  <select name="profesionalId" defaultValue={profesionalId ?? ''} required className="campo">
                    <option value="">Selecciona…</option>
                    {profesionales.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.apellidos}, {p.nombres} — {p.especialidad}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Servicio" ayuda="Define la duración y si necesita sala de rayos X.">
                  <select name="servicioId" defaultValue={servicioId ?? ''} className="campo">
                    <option value="">Sin servicio definido</option>
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} — {s.duracionMinutos} min — {clp(s.precio)}
                        {s.usaRayosX ? ' (RX)' : ''}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Fecha y hora de inicio" requerido>
                  <input name="inicio" type="datetime-local" required className="campo" id="campo-inicio" />
                </Campo>

                <Campo etiqueta="Duración (min)" ayuda="Déjalo vacío para usar la duración del servicio.">
                  <input name="duracionMinutos" type="number" min={5} step={5} className="campo" />
                </Campo>

                <Campo etiqueta="Box o sala">
                  <select name="boxId" className="campo">
                    <option value="">Sin box asignado</option>
                    {boxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.codigo} — {b.nombre} ({humanizar(b.tipo)})
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Canal de agendamiento">
                  <select name="canal" defaultValue="PRESENCIAL" className="campo">
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="TELEFONO">Teléfono</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Correo</option>
                    <option value="WEB">Web</option>
                  </select>
                </Campo>
              </Grilla>

              <Campo etiqueta="Motivo de consulta" ayuda="Se vuelve a preguntar al momento de atender.">
                <textarea name="motivoConsulta" rows={2} className="campo" />
              </Campo>

              <Campo etiqueta="Observaciones">
                <textarea name="observaciones" rows={2} className="campo" />
              </Campo>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="usaRayosX" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                  Usará la sala de rayos X
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="sobrecupo" className="h-4 w-4 rounded border-slate-300 text-amber-600" />
                  Sobrecupo: permitir fuera del horario declarado del profesional
                </label>
                <p className="text-xs text-slate-400">
                  El sobrecupo nunca permite pisar otra hora ya reservada ni un box ocupado.
                </p>
              </div>

              <div className="flex justify-end">
                <BotonEnviar tamano="lg">Agendar hora</BotonEnviar>
              </div>
            </Formulario>
          </Tarjeta>
        </div>

        <SelectorCupos
          cupos={cupos.map((c) => ({
            inicio: c.inicio.toISOString(),
            fin: c.fin.toISOString(),
            disponible: c.disponible,
            motivo: c.motivo,
          }))}
          hayProfesional={Boolean(profesionalId)}
          fecha={isoFecha(dia)}
        />
      </div>
    </>
  );
}
