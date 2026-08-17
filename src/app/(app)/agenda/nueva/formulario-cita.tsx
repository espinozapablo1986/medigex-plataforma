'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Campo, Grilla } from '@/components/ui';
import { BotonEnviar } from '@/components/formulario';
import { SelectorBuscable, SelectorMultiple, type Opcion } from '@/components/selector';

interface ServicioOpcion {
  id: string;
  nombre: string;
  precio: number;
  duracionMinutos: number;
  usaRayosX: boolean;
  tipoBoxRequerido: string | null;
}

interface Cupo {
  inicio: string;
  fin: string;
  disponible: boolean;
  motivo?: string;
  boxSugeridoId: string | null;
}

function clp(monto: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto);
}

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "2026-03-14T09:30" a partir de un ISO, para el input datetime-local. */
function paraInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FormularioCita({
  pacientes,
  profesionales,
  servicios,
  boxes,
  pacientePreseleccionado,
  fechaInicial,
  volverA,
}: {
  pacientes: Opcion[];
  profesionales: Opcion[];
  servicios: ServicioOpcion[];
  boxes: { id: string; codigo: string; nombre: string; tipo: string }[];
  pacientePreseleccionado?: string;
  fechaInicial: string;
  volverA: string;
}) {
  const [profesionalId, setProfesionalId] = useState('');
  const [serviciosElegidos, setServiciosElegidos] = useState<string[]>([]);
  const [fecha, setFecha] = useState(fechaInicial);
  const [cupos, setCupos] = useState<Cupo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [inicioElegido, setInicioElegido] = useState('');
  const [boxId, setBoxId] = useState('');
  const [sobrecupo, setSobrecupo] = useState(false);

  const detalle = useMemo(
    () => serviciosElegidos.map((id) => servicios.find((s) => s.id === id)).filter((s): s is ServicioOpcion => Boolean(s)),
    [serviciosElegidos, servicios],
  );

  const duracionTotal = detalle.reduce((acc, s) => acc + s.duracionMinutos, 0);
  const precioTotal = detalle.reduce((acc, s) => acc + s.precio, 0);
  const necesitaRayosX = detalle.some((s) => s.usaRayosX);

  // Recarga los cupos cada vez que cambia profesional, fecha o duración.
  const cargarCupos = useCallback(async () => {
    if (!profesionalId || !fecha) {
      setCupos([]);
      return;
    }
    setCargando(true);
    try {
      const parametros = new URLSearchParams({ profesional: profesionalId, fecha });
      if (duracionTotal > 0) parametros.set('duracion', String(duracionTotal));
      const respuesta = await fetch(`/api/agenda/cupos?${parametros}`);
      const datos = await respuesta.json();
      setCupos(datos.cupos ?? []);
    } catch {
      setCupos([]);
    } finally {
      setCargando(false);
    }
  }, [profesionalId, fecha, duracionTotal]);

  useEffect(() => {
    void cargarCupos();
  }, [cargarCupos]);

  // Propone automáticamente el primer cupo libre del día.
  useEffect(() => {
    const libres = cupos.filter((c) => c.disponible);
    if (libres.length === 0) {
      setInicioElegido('');
      return;
    }
    const sigueValido = libres.some((c) => c.inicio === inicioElegido);
    if (!sigueValido) {
      setInicioElegido(libres[0].inicio);
      if (libres[0].boxSugeridoId) setBoxId(libres[0].boxSugeridoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupos]);

  const libres = cupos.filter((c) => c.disponible).length;
  const boxesCompatibles = necesitaRayosX ? boxes.filter((b) => b.tipo === 'SALA_RAYOS_X') : boxes;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <section className="tarjeta p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Paciente y profesional</h2>

          <div className="space-y-4">
            <Campo etiqueta="Paciente" requerido>
              <SelectorBuscable
                name="pacienteId"
                opciones={pacientes}
                valorInicial={pacientePreseleccionado}
                placeholder="Busca por nombre, RUT o teléfono…"
                permiteVacio={false}
                requerido
              />
            </Campo>

            <Campo etiqueta="Profesional" requerido>
              <SelectorBuscable
                name="profesionalId"
                opciones={profesionales}
                placeholder="Busca por nombre o especialidad…"
                permiteVacio={false}
                requerido
                onCambio={(valor) => setProfesionalId(valor)}
              />
            </Campo>
          </div>
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Servicios de la sesión</h2>
          <p className="mb-4 text-xs text-slate-500">
            Puedes agregar varios si el paciente aprovechará la misma visita para más de un procedimiento. La duración
            de la hora es la suma de todos.
          </p>

          <SelectorMultiple
            name="servicioIds"
            opciones={servicios.map((s) => ({
              valor: s.id,
              etiqueta: s.nombre,
              detalle: `${s.duracionMinutos} min · ${clp(s.precio)}${s.usaRayosX ? ' · rayos X' : ''}`,
            }))}
            placeholder="Buscar y agregar servicios…"
            onCambio={setServiciosElegidos}
          />

          {detalle.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <ul className="space-y-1 text-sm">
                {detalle.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 text-slate-700">
                    <span className="truncate">{s.nombre}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {s.duracionMinutos} min · {clp(s.precio)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
                <span>{detalle.length} servicio(s)</span>
                <span className="tabular-nums">
                  {duracionTotal} min · {clp(precioTotal)}
                </span>
              </div>
            </div>
          )}

          {necesitaRayosX && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Algún servicio usa rayos X: reserva la sala correspondiente.</span>
            </div>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Box y detalles</h2>
          <Grilla cols={2}>
            <Campo etiqueta="Box o sala">
              <SelectorBuscable
                name="boxId"
                opciones={boxesCompatibles.map((b) => ({
                  valor: b.id,
                  etiqueta: `${b.codigo} — ${b.nombre}`,
                  detalle: b.tipo.replace(/_/g, ' ').toLowerCase(),
                }))}
                valorInicial={boxId}
                key={boxId} /* refleja la sugerencia automática del cupo */
                placeholder="Sin box asignado"
                textoVacio="Sin box asignado"
              />
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

          <Campo etiqueta="Motivo de consulta" ayuda="Se vuelve a confirmar al momento de atender." className="mt-4">
            <textarea name="motivoConsulta" rows={2} className="campo" />
          </Campo>

          <Campo etiqueta="Observaciones" className="mt-4">
            <textarea name="observaciones" rows={2} className="campo" />
          </Campo>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="usaRayosX"
                defaultChecked={necesitaRayosX}
                key={`rx-${necesitaRayosX}`}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Usará la sala de rayos X
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="sobrecupo"
                checked={sobrecupo}
                onChange={(e) => setSobrecupo(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600"
              />
              Sobrecupo: permitir fuera del horario declarado del profesional
            </label>
            <p className="text-xs text-slate-400">
              El sobrecupo nunca permite pisar una hora ya reservada ni un box ocupado.
            </p>
          </div>
        </section>
      </div>

      {/* ── Selección de horario ── */}
      <aside className="lg:sticky lg:top-4 lg:h-fit">
        <section className="tarjeta overflow-hidden">
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <CalendarClock className="h-4 w-4 text-brand-600" />
              Horario
            </h2>
            <p className="text-xs text-slate-500">
              {!profesionalId
                ? 'Elige un profesional para ver sus horas libres'
                : cargando
                  ? 'Buscando horas disponibles…'
                  : `${libres} hora(s) disponible(s)`}
              {duracionTotal > 0 && ` · bloques de ${duracionTotal} min`}
            </p>
          </header>

          <div className="space-y-3 p-4">
            <Campo etiqueta="Día">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
            </Campo>

            {/* Valor real que recibe la server action */}
            <input type="hidden" name="inicio" value={inicioElegido ? paraInput(inicioElegido) : ''} />
            <input type="hidden" name="volverA" value={volverA} />

            {!profesionalId ? (
              <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
                Selecciona un profesional
              </p>
            ) : cargando ? (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-6 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando cupos…
              </p>
            ) : cupos.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800">
                <p className="font-medium">Sin disponibilidad este día</p>
                <p className="mt-0.5 text-xs">
                  El profesional no atiende este día de la semana, o el bloque no alcanza para
                  {duracionTotal > 0 ? ` ${duracionTotal} minutos` : ' la duración pedida'}. Prueba otra fecha o marca
                  sobrecupo e ingresa la hora manualmente.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {cupos.map((cupo) => {
                    const elegido = cupo.inicio === inicioElegido;
                    return (
                      <button
                        key={cupo.inicio}
                        type="button"
                        disabled={!cupo.disponible}
                        title={cupo.motivo}
                        onClick={() => {
                          setInicioElegido(cupo.inicio);
                          if (cupo.boxSugeridoId) setBoxId(cupo.boxSugeridoId);
                        }}
                        className={cn(
                          'rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums transition',
                          !cupo.disponible
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                            : elegido
                              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                        )}
                      >
                        {hhmm(cupo.inicio)}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded border border-emerald-300 bg-emerald-50" /> libre
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-brand-600" /> elegida
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-slate-200" /> ocupada
                  </span>
                </div>
              </>
            )}

            {sobrecupo && (
              <Campo etiqueta="Hora manual (sobrecupo)" ayuda="Sólo se usa si no elegiste un cupo de la grilla.">
                <input
                  type="time"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setInicioElegido(new Date(`${fecha}T${e.target.value}:00`).toISOString());
                  }}
                  className="campo"
                />
              </Campo>
            )}

            {inicioElegido && (
              <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                <p className="font-semibold">{hhmm(inicioElegido)} h</p>
                <p className="text-xs">
                  {new Date(inicioElegido).toLocaleDateString('es-CL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  {duracionTotal > 0 && ` · ${duracionTotal} min`}
                </p>
              </div>
            )}

            <BotonEnviar tamano="lg" className="w-full">
              Agendar hora
            </BotonEnviar>

            {!inicioElegido && (
              <p className="text-center text-xs text-amber-600">Elige una hora de la grilla para continuar.</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
