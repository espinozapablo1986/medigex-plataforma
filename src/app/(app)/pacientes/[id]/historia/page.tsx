import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { fechaCorta, fechaHora, isoFechaHora, numero } from '@/lib/format';
import { Badge, Campo, EstadoVacio, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { editarAtencion, registrarAtencion } from '../../acciones';
import { CabeceraPaciente } from '../cabecera';

export default async function HistoriaPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('historia_clinica', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [atenciones, profesionales] = await Promise.all([
    prisma.atencion.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      include: {
        profesional: { select: { nombres: true, apellidos: true, especialidad: true, colorAgenda: true } },
        registradoPor: { select: { nombres: true, apellidos: true } },
        examenes: { select: { id: true, nombre: true, estado: true } },
        recetas: { select: { id: true, folio: true } },
        adjuntos: { select: { id: true, nombreOriginal: true } },
        cita: { select: { id: true, servicios: { include: { servicio: { select: { nombre: true } } } } } },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
  ]);

  const puedeCrear = puede(sesion, 'historia_clinica', 'crear');
  const puedeEditar = puede(sesion, 'historia_clinica', 'editar');

  // Si el usuario es un profesional, su ficha viene preseleccionada.
  const profesionalPorDefecto = sesion.profesionalId ?? '';

  const formularioAtencion = (
    <Formulario accion={registrarAtencion} className="space-y-4">
      <input type="hidden" name="pacienteId" value={id} />

      <Grilla cols={2}>
        <Campo etiqueta="Profesional que atiende" requerido>
          <select name="profesionalId" defaultValue={profesionalPorDefecto} required className="campo">
            <option value="">Selecciona…</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellidos}, {p.nombres} — {p.especialidad}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha y hora de la atención">
          <input name="fecha" type="datetime-local" defaultValue={isoFechaHora(new Date())} className="campo" />
        </Campo>
      </Grilla>

      <Campo
        etiqueta="Motivo de consulta"
        requerido
        ayuda="Qué trae al paciente hoy. Es obligatorio en toda atención."
      >
        <textarea name="motivoConsulta" rows={2} required autoFocus className="campo" />
      </Campo>

      <Grilla cols={2}>
        <Campo etiqueta="Anamnesis">
          <textarea name="anamnesis" rows={3} className="campo" />
        </Campo>
        <Campo etiqueta="Examen físico">
          <textarea name="examenFisico" rows={3} className="campo" />
        </Campo>
      </Grilla>

      <Grilla cols={2}>
        <Campo etiqueta="Diagnóstico">
          <textarea name="diagnostico" rows={2} className="campo" />
        </Campo>
        <Campo etiqueta="Código CIE-10">
          <input name="cie10" className="campo" placeholder="K02.1" />
        </Campo>
      </Grilla>

      <Grilla cols={2}>
        <Campo etiqueta="Tratamiento realizado">
          <textarea name="tratamientoRealizado" rows={3} className="campo" />
        </Campo>
        <Campo etiqueta="Indicaciones al paciente">
          <textarea name="indicaciones" rows={3} className="campo" />
        </Campo>
      </Grilla>

      <fieldset className="rounded-lg border border-tinta-200 bg-tinta-50 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-tinta-500">Signos vitales</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo etiqueta="P. arterial">
            <input name="presionArterial" placeholder="120/80" className="campo" />
          </Campo>
          <Campo etiqueta="F. cardíaca">
            <input name="frecuenciaCardiaca" type="number" min={0} max={300} className="campo" />
          </Campo>
          <Campo etiqueta="Temp. °C">
            <input name="temperatura" type="number" step="0.1" min={30} max={45} className="campo" />
          </Campo>
          <Campo etiqueta="Sat. %">
            <input name="saturacion" type="number" min={0} max={100} className="campo" />
          </Campo>
          <Campo etiqueta="Peso kg">
            <input name="pesoKg" type="number" step="0.1" min={0} className="campo" />
          </Campo>
          <Campo etiqueta="Talla cm">
            <input name="tallaCm" type="number" step="0.5" min={0} className="campo" />
          </Campo>
        </div>
      </fieldset>

      <Grilla cols={2}>
        <Campo etiqueta="Observaciones">
          <textarea name="observaciones" rows={2} className="campo" />
        </Campo>
        <Campo etiqueta="Próximo control">
          <input name="proximoControl" type="date" className="campo" />
        </Campo>
      </Grilla>

      <div className="flex justify-end">
        <BotonEnviar>Guardar atención</BotonEnviar>
      </div>
    </Formulario>
  );

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/historia`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-500">
          {atenciones.length} atención(es) registradas en la historia clínica.
        </p>
        {puedeCrear && (
          <Modal titulo="Registrar atención" etiquetaBoton="Registrar atención" ancho="max-w-4xl">
            {formularioAtencion}
          </Modal>
        )}
      </div>

      {atenciones.length === 0 ? (
        <EstadoVacio
          titulo="Historia clínica vacía"
          descripcion="Registra la primera atención del paciente. Siempre se pide el motivo de consulta."
        />
      ) : (
        <div className="space-y-4">
          {atenciones.map((a) => (
            <article key={a.id} className="tarjeta overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-tinta-200 bg-tinta-50 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.profesional.colorAgenda }} />
                  <div>
                    <p className="text-sm font-semibold text-tinta-900">{fechaHora(a.fecha)}</p>
                    <p className="text-xs text-tinta-500">
                      {a.profesional.nombres} {a.profesional.apellidos} · {a.profesional.especialidad}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {a.cita?.servicios.map((s) => (
                    <Badge key={s.id} tono="azul">
                      {s.servicio.nombre}
                    </Badge>
                  ))}
                  {a.recetas.length > 0 && <Badge tono="verde">{a.recetas.length} receta(s)</Badge>}
                  {a.examenes.length > 0 && <Badge tono="ambar">{a.examenes.length} examen(es)</Badge>}
                  {a.adjuntos.length > 0 && <Badge tono="gris">{a.adjuntos.length} archivo(s)</Badge>}
                  {puedeEditar && (
                    <Modal
                      titulo="Editar atención"
                      etiquetaBoton="Editar"
                      varianteBoton="secundario"
                      tamanoBoton="sm"
                      ancho="max-w-3xl"
                    >
                      <Formulario accion={editarAtencion} className="space-y-4">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="pacienteId" value={id} />
                        <Campo etiqueta="Motivo de consulta" requerido>
                          <textarea name="motivoConsulta" rows={2} defaultValue={a.motivoConsulta} required className="campo" />
                        </Campo>
                        <Grilla cols={2}>
                          <Campo etiqueta="Anamnesis">
                            <textarea name="anamnesis" rows={3} defaultValue={a.anamnesis ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Examen físico">
                            <textarea name="examenFisico" rows={3} defaultValue={a.examenFisico ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Diagnóstico">
                            <textarea name="diagnostico" rows={2} defaultValue={a.diagnostico ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="CIE-10">
                            <input name="cie10" defaultValue={a.cie10 ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Tratamiento realizado">
                            <textarea name="tratamientoRealizado" rows={3} defaultValue={a.tratamientoRealizado ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Indicaciones">
                            <textarea name="indicaciones" rows={3} defaultValue={a.indicaciones ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Observaciones">
                            <textarea name="observaciones" rows={2} defaultValue={a.observaciones ?? ''} className="campo" />
                          </Campo>
                          <Campo etiqueta="Próximo control">
                            <input
                              name="proximoControl"
                              type="date"
                              defaultValue={a.proximoControl ? a.proximoControl.toISOString().slice(0, 10) : ''}
                              className="campo"
                            />
                          </Campo>
                        </Grilla>
                        <div className="flex justify-end">
                          <BotonEnviar>Guardar cambios</BotonEnviar>
                        </div>
                      </Formulario>
                    </Modal>
                  )}
                </div>
              </header>

              <div className="space-y-3 p-4">
                <Seccion titulo="Motivo de consulta" contenido={a.motivoConsulta} destacado />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Seccion titulo="Anamnesis" contenido={a.anamnesis} />
                  <Seccion titulo="Examen físico" contenido={a.examenFisico} />
                  <Seccion titulo="Diagnóstico" contenido={[a.diagnostico, a.cie10 && `(${a.cie10})`].filter(Boolean).join(' ')} />
                  <Seccion titulo="Tratamiento realizado" contenido={a.tratamientoRealizado} />
                  <Seccion titulo="Indicaciones" contenido={a.indicaciones} />
                  <Seccion titulo="Observaciones" contenido={a.observaciones} />
                </div>

                {(a.presionArterial || a.frecuenciaCardiaca || a.temperatura || a.pesoKg || a.tallaCm || a.saturacion) && (
                  <div className="flex flex-wrap gap-3 rounded-lg bg-tinta-50 px-3 py-2 text-xs text-tinta-600">
                    {a.presionArterial && <span>PA {a.presionArterial}</span>}
                    {a.frecuenciaCardiaca && <span>FC {a.frecuenciaCardiaca} lpm</span>}
                    {a.temperatura && <span>T° {numero(a.temperatura, 1)}</span>}
                    {a.saturacion && <span>Sat {a.saturacion}%</span>}
                    {a.pesoKg && <span>Peso {numero(a.pesoKg, 1)} kg</span>}
                    {a.tallaCm && <span>Talla {numero(a.tallaCm, 0)} cm</span>}
                    {a.pesoKg && a.tallaCm && a.tallaCm > 0 && (
                      <span className="font-medium">
                        IMC {numero(a.pesoKg / Math.pow(a.tallaCm / 100, 2), 1)}
                      </span>
                    )}
                  </div>
                )}

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-tinta-100 pt-2 text-xs text-tinta-400">
                  <span>
                    Registrado por {a.registradoPor ? `${a.registradoPor.nombres} ${a.registradoPor.apellidos}` : 'sistema'}
                  </span>
                  {a.proximoControl && (
                    <span className="text-brand-600">Próximo control: {fechaCorta(a.proximoControl)}</span>
                  )}
                </footer>

                {(a.recetas.length > 0 || a.examenes.length > 0) && (
                  <div className="flex flex-wrap gap-2 border-t border-tinta-100 pt-2">
                    {a.recetas.map((r) => (
                      <Link
                        key={r.id}
                        href={`/recetas/${r.id}`}
                        className="rounded-lg border border-tinta-200 px-2 py-1 text-xs text-brand-700 hover:bg-tinta-50"
                      >
                        Receta Nº {r.folio}
                      </Link>
                    ))}
                    {a.examenes.map((e) => (
                      <span key={e.id} className="rounded-lg border border-tinta-200 px-2 py-1 text-xs text-tinta-600">
                        {e.nombre}
                      </span>
                    ))}
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

function Seccion({
  titulo,
  contenido,
  destacado,
}: {
  titulo: string;
  contenido?: string | null;
  destacado?: boolean;
}) {
  if (!contenido) return null;
  return (
    <div className={destacado ? 'rounded-lg border-l-4 border-brand-500 bg-brand-50/50 px-3 py-2' : ''}>
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">{titulo}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-tinta-700">{contenido}</p>
    </div>
  );
}
