'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { cambiarEstadoCita } from './acciones';

interface CitaPanel {
  id: string;
  inicio: Date;
  fin: Date;
  estado: string;
  usaRayosX: boolean;
  motivoConsulta: string | null;
  observaciones: string | null;
  paciente: { id: string; nombres: string; apellidoPaterno: string; telefonoPrincipal: string; alergias: string | null };
  profesional: { nombres: string; apellidos: string; colorAgenda: string };
  servicio: { nombre: string } | null;
  box: { codigo: string } | null;
  atencion: { id: string } | null;
}

const COLORES_ESTADO: Record<string, string> = {
  AGENDADA: 'border-brand-300 bg-brand-50',
  CONFIRMADA: 'border-emerald-300 bg-emerald-50',
  EN_SALA_ESPERA: 'border-amber-300 bg-amber-50',
  EN_ATENCION: 'border-violet-300 bg-violet-50',
  ATENDIDA: 'border-emerald-400 bg-emerald-100',
  NO_ASISTIO: 'border-rose-300 bg-rose-50',
  CANCELADA: 'border-slate-300 bg-slate-100',
  REAGENDADA: 'border-slate-300 bg-slate-100',
};

const TRANSICIONES: { estado: string; texto: string }[] = [
  { estado: 'CONFIRMADA', texto: 'Confirmar' },
  { estado: 'EN_SALA_ESPERA', texto: 'Marcar llegada' },
  { estado: 'EN_ATENCION', texto: 'En atención' },
  { estado: 'NO_ASISTIO', texto: 'No asistió' },
  { estado: 'CANCELADA', texto: 'Cancelar' },
];

function hhmm(fecha: Date) {
  const d = new Date(fecha);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Bloque de cita en la grilla, con panel de acciones al hacer clic. */
export function PanelCita({
  cita,
  anulada,
  puedeEditar,
}: {
  cita: CitaPanel;
  anulada: boolean;
  puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          'h-full w-full overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs transition hover:shadow-md',
          COLORES_ESTADO[cita.estado] ?? 'border-slate-300 bg-white',
          anulada && 'opacity-60',
        )}
        style={{ borderLeftColor: cita.profesional.colorAgenda }}
      >
        <p className={cn('truncate font-semibold text-slate-800', anulada && 'line-through')}>
          {cita.paciente.nombres} {cita.paciente.apellidoPaterno}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {hhmm(cita.inicio)}–{hhmm(cita.fin)}
          {cita.box && ` · ${cita.box.codigo}`}
        </p>
        {cita.servicio && <p className="truncate text-[11px] text-slate-500">{cita.servicio.nombre}</p>}
        <div className="mt-0.5 flex gap-1">
          {cita.usaRayosX && <span className="rounded bg-violet-200 px-1 text-[10px] text-violet-800">RX</span>}
          {cita.paciente.alergias && <span className="rounded bg-rose-200 px-1 text-[10px] text-rose-800">ALG</span>}
        </div>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {cita.paciente.nombres} {cita.paciente.apellidoPaterno}
                </h2>
                <p className="text-xs text-slate-500">
                  {hhmm(cita.inicio)}–{hhmm(cita.fin)} · {cita.profesional.nombres} {cita.profesional.apellidos}
                </p>
              </div>
              <button onClick={() => setAbierto(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                ✕
              </button>
            </header>

            <div className="space-y-2 px-5 py-4 text-sm">
              <Fila etiqueta="Estado" valor={cita.estado.replace(/_/g, ' ').toLowerCase()} />
              {cita.servicio && <Fila etiqueta="Servicio" valor={cita.servicio.nombre} />}
              {cita.box && <Fila etiqueta="Box" valor={cita.box.codigo} />}
              <Fila etiqueta="Teléfono" valor={cita.paciente.telefonoPrincipal} />
              {cita.motivoConsulta && <Fila etiqueta="Motivo" valor={cita.motivoConsulta} />}
              {cita.observaciones && <Fila etiqueta="Observaciones" valor={cita.observaciones} />}
              {cita.usaRayosX && <Fila etiqueta="Rayos X" valor="Requiere sala de rayos X" />}
              {cita.paciente.alergias && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <strong>Alergias:</strong> {cita.paciente.alergias}
                </div>
              )}
            </div>

            <footer className="space-y-3 border-t border-slate-200 px-5 py-3">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/pacientes/${cita.paciente.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver ficha
                </Link>
                {cita.atencion ? (
                  <Link
                    href={`/pacientes/${cita.paciente.id}/historia`}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                  >
                    Atención registrada
                  </Link>
                ) : (
                  <Link
                    href={`/agenda/${cita.id}/atender`}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Atender
                  </Link>
                )}
              </div>

              {puedeEditar && !['ATENDIDA', 'CANCELADA'].includes(cita.estado) && (
                <div className="flex flex-wrap gap-1.5">
                  {TRANSICIONES.filter((t) => t.estado !== cita.estado).map((t) => (
                    <form key={t.estado} action={cambiarEstadoCita}>
                      <input type="hidden" name="id" value={cita.id} />
                      <input type="hidden" name="estado" value={t.estado} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (
                            ['CANCELADA', 'NO_ASISTIO'].includes(t.estado) &&
                            !window.confirm(`¿Marcar esta hora como "${t.texto}"?`)
                          ) {
                            e.preventDefault();
                          }
                        }}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {t.texto}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-slate-400">{etiqueta}</span>
      <span className="text-slate-700">{valor}</span>
    </div>
  );
}
