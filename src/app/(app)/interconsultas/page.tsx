import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaCorta, humanizar, isoFechaHora } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  Campo,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SelectorBuscable, SelectorMultiple } from '@/components/selector';

import { agendarDesdeInterconsulta, crearInterconsulta, responderInterconsulta } from '../agenda/acciones';

export const metadata = { title: 'Interconsultas' };

const PRIORIDADES = [
  { valor: 'NORMAL', texto: 'Normal' },
  { valor: 'BAJA', texto: 'Baja' },
  { valor: 'ALTA', texto: 'Alta' },
  { valor: 'URGENTE', texto: 'Urgente' },
];

export default async function PaginaInterconsultas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const sesion = await requerirPermiso('interconsultas', 'ver');
  const { estado } = await searchParams;

  const [interconsultas, pacientes, profesionales, servicios, boxes] = await Promise.all([
    prisma.interconsulta.findMany({
      where: estado ? { estado: estado as never } : {},
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, numeroFicha: true } },
        profesionalOrigen: { select: { nombres: true, apellidos: true, especialidad: true } },
        profesionalDestino: { select: { id: true, nombres: true, apellidos: true, especialidad: true } },
        cita: { select: { id: true, inicio: true } },
      },
    }),
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, rut: true },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, duracionMinutos: true },
    }),
    prisma.box.findMany({ where: { activo: true }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, nombre: true } }),
  ]);

  const puedeCrear = puede(sesion, 'interconsultas', 'crear');
  const puedeEditar = puede(sesion, 'interconsultas', 'editar');
  const puedeAgendar = puede(sesion, 'agenda', 'crear');

  const pendientes = interconsultas.filter((i) => i.estado === 'PENDIENTE').length;

  const opcionesPacientes = pacientes.map((p) => ({
    valor: p.id,
    etiqueta: `${p.apellidoPaterno}, ${p.nombres}`,
    detalle: p.rut ?? 'sin RUT',
    buscarPor: p.rut ?? '',
  }));

  const opcionesProfesionales = profesionales.map((p) => ({
    valor: p.id,
    etiqueta: `${p.apellidos}, ${p.nombres}`,
    detalle: p.especialidad,
  }));

  return (
    <>
      <EncabezadoPagina
        ayuda="interconsultas"
        titulo="Interconsultas"
        descripcion="Derivaciones de pacientes entre profesionales del centro."
        acciones={
          puedeCrear && (
            <Modal titulo="Nueva interconsulta" etiquetaBoton="Nueva interconsulta" ancho="max-w-2xl">
              <Formulario accion={crearInterconsulta} className="space-y-4">
                <Campo etiqueta="Paciente" requerido>
                  <SelectorBuscable
                    name="pacienteId"
                    opciones={opcionesPacientes}
                    placeholder="Busca por nombre o RUT…"
                    permiteVacio={false}
                    requerido
                  />
                </Campo>
                <Grilla cols={2}>
                  <Campo etiqueta="Profesional que deriva" requerido>
                    <SelectorBuscable
                      name="profesionalOrigenId"
                      opciones={opcionesProfesionales}
                      valorInicial={sesion.profesionalId}
                      placeholder="Busca…"
                      permiteVacio={false}
                      requerido
                    />
                  </Campo>
                  <Campo etiqueta="Profesional de destino" requerido>
                    <SelectorBuscable
                      name="profesionalDestinoId"
                      opciones={opcionesProfesionales}
                      placeholder="Busca por nombre o especialidad…"
                      permiteVacio={false}
                      requerido
                    />
                  </Campo>
                </Grilla>
                <Campo etiqueta="Motivo de la derivación" requerido>
                  <textarea name="motivo" rows={2} required className="campo" />
                </Campo>
                <Campo etiqueta="Resumen clínico">
                  <textarea name="resumenClinico" rows={3} className="campo" />
                </Campo>
                <Campo etiqueta="Prioridad">
                  <select name="prioridad" defaultValue="NORMAL" className="campo">
                    {PRIORIDADES.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.texto}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="flex justify-end">
                  <BotonEnviar>Enviar interconsulta</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <form className="mb-4 flex items-end gap-3">
        <Campo etiqueta="Estado" className="w-52">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todas</option>
            <option value="PENDIENTE">Pendientes ({pendientes})</option>
            <option value="ACEPTADA">Aceptadas</option>
            <option value="AGENDADA">Agendadas</option>
            <option value="COMPLETADA">Completadas</option>
            <option value="RECHAZADA">Rechazadas</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {interconsultas.length === 0 ? (
        <EstadoVacio
          titulo="Sin interconsultas"
          descripcion="Cuando un profesional derive a un paciente a otro especialista del centro, aparecerá aquí."
        />
      ) : (
        <div className="space-y-4">
          {interconsultas.map((i) => (
            <article key={i.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/pacientes/${i.paciente.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      {i.paciente.nombres} {i.paciente.apellidoPaterno}
                    </Link>
                    <span className="text-xs text-tinta-400">Ficha Nº {i.paciente.numeroFicha}</span>
                    <BadgeEstado estado={i.estado} />
                    {i.prioridad !== 'NORMAL' && <Badge tono={i.prioridad === 'URGENTE' ? 'rojo' : 'ambar'}>{humanizar(i.prioridad)}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-tinta-500">
                    {i.profesionalOrigen.apellidos} ({i.profesionalOrigen.especialidad}) →{' '}
                    <strong className="text-tinta-700">
                      {i.profesionalDestino.apellidos} ({i.profesionalDestino.especialidad})
                    </strong>
                    {' · '}
                    {fechaCorta(i.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {puedeEditar && ['PENDIENTE', 'ACEPTADA'].includes(i.estado) && (
                    <Modal titulo="Responder interconsulta" etiquetaBoton="Responder" varianteBoton="secundario" tamanoBoton="sm" ancho="max-w-lg">
                      <Formulario accion={responderInterconsulta} className="space-y-4">
                        <input type="hidden" name="id" value={i.id} />
                        <Campo etiqueta="Estado" requerido>
                          <select name="estado" defaultValue="ACEPTADA" required className="campo">
                            <option value="ACEPTADA">Aceptar</option>
                            <option value="COMPLETADA">Marcar como completada</option>
                            <option value="RECHAZADA">Rechazar</option>
                          </select>
                        </Campo>
                        <Campo etiqueta="Respuesta / comentario">
                          <textarea name="respuesta" rows={4} defaultValue={i.respuesta ?? ''} className="campo" />
                        </Campo>
                        <div className="flex justify-end">
                          <BotonEnviar>Guardar respuesta</BotonEnviar>
                        </div>
                      </Formulario>
                    </Modal>
                  )}

                  {puedeAgendar && !i.citaId && i.estado !== 'RECHAZADA' && (
                    <Modal titulo="Agendar hora de la interconsulta" etiquetaBoton="Agendar hora" tamanoBoton="sm" ancho="max-w-lg">
                      <Formulario accion={agendarDesdeInterconsulta} className="space-y-4">
                        <input type="hidden" name="interconsultaId" value={i.id} />
                        <p className="text-sm text-tinta-600">
                          Se agendará con <strong>{i.profesionalDestino.nombres} {i.profesionalDestino.apellidos}</strong>.
                        </p>
                        <Campo etiqueta="Fecha y hora" requerido>
                          <input name="inicio" type="datetime-local" required defaultValue={isoFechaHora(new Date())} className="campo" />
                        </Campo>
                        <Campo etiqueta="Servicios de la sesión" ayuda="Puedes agregar más de uno.">
                          <SelectorMultiple
                            name="servicioIds"
                            opciones={servicios.map((s) => ({
                              valor: s.id,
                              etiqueta: s.nombre,
                              detalle: `${s.duracionMinutos} min`,
                            }))}
                            placeholder="Buscar y agregar servicios…"
                          />
                        </Campo>
                        <Campo etiqueta="Box">
                          <SelectorBuscable
                            name="boxId"
                            opciones={boxes.map((b) => ({
                              valor: b.id,
                              etiqueta: `${b.codigo} — ${b.nombre}`,
                            }))}
                            placeholder="Sin box"
                            textoVacio="Sin box"
                          />
                        </Campo>
                        <label className="flex items-center gap-2 text-sm text-tinta-700">
                          <input type="checkbox" name="sobrecupo" className="h-4 w-4 rounded border-tinta-300 text-amber-600" />
                          Permitir sobrecupo fuera del horario habitual
                        </label>
                        <div className="flex justify-end">
                          <BotonEnviar>Agendar</BotonEnviar>
                        </div>
                      </Formulario>
                    </Modal>
                  )}

                  {i.cita && (
                    <Link
                      href={`/agenda?fecha=${i.cita.inicio.toISOString().slice(0, 10)}`}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                    >
                      Agendada {fechaCorta(i.cita.inicio)}
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2 border-t border-tinta-100 pt-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">Motivo</p>
                  <p className="text-tinta-700">{i.motivo}</p>
                </div>
                {i.resumenClinico && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">Resumen clínico</p>
                    <p className="whitespace-pre-wrap text-tinta-700">{i.resumenClinico}</p>
                  </div>
                )}
                {i.respuesta && (
                  <div className="rounded-lg bg-tinta-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">
                      Respuesta {i.respondidaAt && `· ${fechaCorta(i.respondidaAt)}`}
                    </p>
                    <p className="whitespace-pre-wrap text-tinta-700">{i.respuesta}</p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
