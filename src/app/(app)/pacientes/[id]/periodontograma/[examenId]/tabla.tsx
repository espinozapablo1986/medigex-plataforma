'use client';

import { useMemo, useState } from 'react';
import { Droplet, StickyNote } from 'lucide-react';

import { cn } from '@/lib/cn';
import { buscarPieza, nivelInsercion, severidadBolsa } from '@/lib/dental';
import { Campo } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { guardarPeriodontograma } from '../acciones';

type Cara = 'VESTIBULAR' | 'PALATINO_LINGUAL';
type Posicion = 'MESIAL' | 'CENTRAL' | 'DISTAL';

export interface SitioVista {
  cara: Cara;
  posicion: Posicion;
  profundidad: number;
  margen: number;
  placa: boolean;
  sangrado: boolean;
  supuracion: boolean;
}

export interface PiezaVista {
  pieza: string;
  ausente: boolean;
  implante: boolean;
  movilidad: number | null;
  furcaVestibular: number | null;
  furcaPalatina: number | null;
  notas: string | null;
  sitios: SitioVista[];
}

const ORDEN: Posicion[] = ['MESIAL', 'CENTRAL', 'DISTAL'];

/** Alto en píxeles de un milímetro en el gráfico. */
const MM = 7;
/** Línea de referencia del límite amelocementario. */
const BASE = 42;

function claveSitio(cara: Cara, posicion: Posicion) {
  return `${cara}:${posicion}`;
}

/**
 * Tabla de registro periodontal.
 *
 * Se edita todo en pantalla y se envía de una sola vez: son casi 200 valores
 * y guardarlos por separado dejaría exámenes a medio llenar si algo falla.
 * Las mediciones se ordenan siempre de mesial a distal según el cuadrante,
 * igual que en la ficha de papel.
 */
export function TablaPeriodontal({
  examenId,
  pacienteId,
  piezasSuperiores,
  piezasInferiores,
  observaciones,
  puedeEditar,
}: {
  examenId: string;
  pacienteId: string;
  piezasSuperiores: PiezaVista[];
  piezasInferiores: PiezaVista[];
  observaciones: string | null;
  puedeEditar: boolean;
}) {
  const [arcada, setArcada] = useState<'superior' | 'inferior'>('superior');
  const [datos, setDatos] = useState<PiezaVista[]>([...piezasSuperiores, ...piezasInferiores]);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  const codigosVisibles = (arcada === 'superior' ? piezasSuperiores : piezasInferiores).map((p) => p.pieza);
  const visibles = codigosVisibles
    .map((c) => datos.find((d) => d.pieza === c))
    .filter((p): p is PiezaVista => Boolean(p));

  const actualizarPieza = (pieza: string, cambios: Partial<PiezaVista>) =>
    setDatos((previo) => previo.map((p) => (p.pieza === pieza ? { ...p, ...cambios } : p)));

  const actualizarSitio = (pieza: string, cara: Cara, posicion: Posicion, cambios: Partial<SitioVista>) =>
    setDatos((previo) =>
      previo.map((p) =>
        p.pieza !== pieza
          ? p
          : {
              ...p,
              sitios: p.sitios.map((s) =>
                s.cara === cara && s.posicion === posicion ? { ...s, ...cambios } : s,
              ),
            },
      ),
    );

  const sitioDe = (p: PiezaVista, cara: Cara, posicion: Posicion) =>
    p.sitios.find((s) => s.cara === cara && s.posicion === posicion) ?? {
      cara,
      posicion,
      profundidad: 0,
      margen: 0,
      placa: false,
      sangrado: false,
      supuracion: false,
    };

  // ── Índices del examen completo ──
  const indices = useMemo(() => {
    const presentes = datos.filter((p) => !p.ausente);
    const sitios = presentes.flatMap((p) => p.sitios);
    if (sitios.length === 0) {
      return { sangrado: 0, placa: 0, bolsas: 0, profundidadMedia: 0, piezasPresentes: 0 };
    }
    return {
      sangrado: Math.round((sitios.filter((s) => s.sangrado).length / sitios.length) * 100),
      placa: Math.round((sitios.filter((s) => s.placa).length / sitios.length) * 100),
      bolsas: sitios.filter((s) => s.profundidad >= 4).length,
      profundidadMedia:
        Math.round((sitios.reduce((acc, s) => acc + s.profundidad, 0) / sitios.length) * 10) / 10,
      piezasPresentes: presentes.length,
    };
  }, [datos]);

  /** Gráfico: línea del margen gingival y línea del fondo de la bolsa. */
  const grafico = (cara: Cara) => {
    const ancho = visibles.length * 54;
    const puntosMargen: string[] = [];
    const puntosFondo: string[] = [];

    visibles.forEach((p, i) => {
      if (p.ausente) return;
      ORDEN.forEach((posicion, j) => {
        const s = sitioDe(p, cara, posicion);
        const x = i * 54 + 9 + j * 18;
        // Margen positivo = encía cubre; se dibuja por encima de la línea base.
        puntosMargen.push(`${x},${BASE - s.margen * MM}`);
        puntosFondo.push(`${x},${BASE - s.margen * MM + s.profundidad * MM}`);
      });
    });

    return (
      <svg width={ancho} height={110} className="block">
        {/* Referencia del límite amelocementario */}
        <line x1="0" y1={BASE} x2={ancho} y2={BASE} stroke="#BCCED5" strokeWidth="1" strokeDasharray="3 3" />
        {[2, 4, 6, 8].map((mm) => (
          <line
            key={mm}
            x1="0"
            y1={BASE + mm * MM}
            x2={ancho}
            y2={BASE + mm * MM}
            stroke="#E7F0F4"
            strokeWidth="1"
          />
        ))}
        {puntosFondo.length > 1 && (
          <polyline points={puntosFondo.join(' ')} fill="none" stroke="#2A6B80" strokeWidth="1.5" />
        )}
        {puntosMargen.length > 1 && (
          <polyline points={puntosMargen.join(' ')} fill="none" stroke="#B94642" strokeWidth="1.5" />
        )}
      </svg>
    );
  };

  const filaMedicion = (
    etiqueta: string,
    cara: Cara,
    campo: 'profundidad' | 'margen',
  ) => (
    <tr>
      <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
        {etiqueta}
      </th>
      {visibles.map((p) => (
        <td key={p.pieza} className="border-l border-tinta-200 p-0">
          <div className="flex">
            {ORDEN.map((posicion) => {
              const s = sitioDe(p, cara, posicion);
              const valor = s[campo];
              const alerta = campo === 'profundidad' && severidadBolsa(valor) !== 'sana';
              return (
                <input
                  key={posicion}
                  type="number"
                  min={campo === 'margen' ? -15 : 0}
                  max={campo === 'margen' ? 15 : 20}
                  value={valor}
                  disabled={p.ausente || !puedeEditar}
                  onChange={(e) =>
                    actualizarSitio(p.pieza, cara, posicion, {
                      [campo]: parseInt(e.target.value, 10) || 0,
                    } as Partial<SitioVista>)
                  }
                  className={cn(
                    'w-[18px] border-0 bg-transparent p-0 text-center text-[11px] tabular-nums outline-none',
                    'focus:bg-brand-50 focus:ring-1 focus:ring-brand-500',
                    'disabled:opacity-30',
                    alerta
                      ? valor >= 7
                        ? 'font-bold text-error'
                        : 'font-semibold text-alerta-texto'
                      : 'text-brand-900',
                  )}
                />
              );
            })}
          </div>
        </td>
      ))}
    </tr>
  );

  const filaNic = (cara: Cara) => (
    <tr className="bg-tinta-50">
      <th className="sticky left-0 z-10 whitespace-nowrap bg-tinta-50 px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
        NIC
      </th>
      {visibles.map((p) => (
        <td key={p.pieza} className="border-l border-tinta-200 p-0">
          <div className="flex">
            {ORDEN.map((posicion) => {
              const s = sitioDe(p, cara, posicion);
              const nic = nivelInsercion(s.profundidad, s.margen);
              return (
                <span
                  key={posicion}
                  className={cn(
                    'w-[18px] text-center text-[11px] tabular-nums',
                    p.ausente ? 'opacity-30' : nic >= 5 ? 'font-semibold text-error' : 'text-tinta-600',
                  )}
                >
                  {p.ausente ? '' : nic}
                </span>
              );
            })}
          </div>
        </td>
      ))}
    </tr>
  );

  const filaMarca = (
    etiqueta: string,
    cara: Cara,
    campo: 'placa' | 'sangrado' | 'supuracion',
    color: string,
  ) => (
    <tr>
      <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
        {etiqueta}
      </th>
      {visibles.map((p) => (
        <td key={p.pieza} className="border-l border-tinta-200 p-0">
          <div className="flex">
            {ORDEN.map((posicion) => {
              const s = sitioDe(p, cara, posicion);
              return (
                <button
                  key={posicion}
                  type="button"
                  disabled={p.ausente || !puedeEditar}
                  onClick={() => actualizarSitio(p.pieza, cara, posicion, { [campo]: !s[campo] } as Partial<SitioVista>)}
                  aria-label={`${etiqueta} ${p.pieza} ${posicion}`}
                  className="flex h-4 w-[18px] items-center justify-center disabled:opacity-30"
                >
                  {s[campo] && <span className="h-2.5 w-2.5" style={{ backgroundColor: color }} />}
                </button>
              );
            })}
          </div>
        </td>
      ))}
    </tr>
  );

  const cabeceraPiezas = (
    <tr>
      <th className="sticky left-0 z-10 bg-tinta-50 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-tinta-600">
        Pieza
      </th>
      {visibles.map((p) => (
        <th
          key={p.pieza}
          className={cn(
            'w-[54px] border-l border-tinta-200 bg-tinta-50 px-0 py-1 text-center font-mono text-[11px]',
            p.ausente ? 'text-tinta-300 line-through' : 'text-brand-900',
          )}
        >
          {p.pieza}
        </th>
      ))}
    </tr>
  );

  return (
    <Formulario accion={guardarPeriodontograma} className="space-y-4">
      <input type="hidden" name="id" value={examenId} />
      <input type="hidden" name="pacienteId" value={pacienteId} />
      <input type="hidden" name="datos" value={JSON.stringify(datos)} />

      {/* ── Índices ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { etiqueta: 'Piezas presentes', valor: String(indices.piezasPresentes) },
          { etiqueta: 'Índice de placa', valor: `${indices.placa}%`, alerta: indices.placa > 20 },
          { etiqueta: 'Índice de sangrado', valor: `${indices.sangrado}%`, alerta: indices.sangrado > 10 },
          { etiqueta: 'Sitios con bolsa ≥ 4 mm', valor: String(indices.bolsas), alerta: indices.bolsas > 0 },
          { etiqueta: 'Sondaje promedio', valor: `${indices.profundidadMedia} mm` },
        ].map((i) => (
          <div key={i.etiqueta} className="tarjeta p-3">
            <p className="text-[11px] uppercase tracking-wide text-tinta-500">{i.etiqueta}</p>
            <p
              className={cn(
                'mt-1 font-display text-xl font-bold tabular-nums',
                i.alerta ? 'text-error' : 'text-brand-900',
              )}
            >
              {i.valor}
            </p>
          </div>
        ))}
      </div>

      {/* ── Selector de arcada ── */}
      <div className="flex gap-1">
        {(['superior', 'inferior'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArcada(a)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition',
              arcada === a
                ? 'bg-brand-600 text-white'
                : 'border border-tinta-300 bg-white text-brand-900 hover:bg-tinta-50',
            )}
          >
            Arcada {a}
          </button>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div className="tarjeta scroll-fino overflow-x-auto">
        <table className="min-w-max border-collapse">
          <thead>{cabeceraPiezas}</thead>
          <tbody>
            {/* Vestibular */}
            <tr>
              <td colSpan={visibles.length + 1} className="bg-brand-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                Vestibular
              </td>
            </tr>
            {filaMedicion('Prof. sondaje', 'VESTIBULAR', 'profundidad')}
            {filaMedicion('Margen gingival', 'VESTIBULAR', 'margen')}
            {filaNic('VESTIBULAR')}
            {filaMarca('Placa', 'VESTIBULAR', 'placa', '#2A6B80')}
            {filaMarca('Sangrado', 'VESTIBULAR', 'sangrado', '#B94642')}
            {filaMarca('Supuración', 'VESTIBULAR', 'supuracion', '#CA933E')}

            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Gráfico
              </th>
              <td colSpan={visibles.length} className="p-0">
                <div className="border-y border-tinta-100">{grafico('VESTIBULAR')}</div>
              </td>
            </tr>

            {/* Palatino / lingual */}
            <tr>
              <td colSpan={visibles.length + 1} className="bg-brand-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                {arcada === 'superior' ? 'Palatino' : 'Lingual'}
              </td>
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Gráfico
              </th>
              <td colSpan={visibles.length} className="p-0">
                <div className="border-y border-tinta-100">{grafico('PALATINO_LINGUAL')}</div>
              </td>
            </tr>
            {filaMedicion('Prof. sondaje', 'PALATINO_LINGUAL', 'profundidad')}
            {filaMedicion('Margen gingival', 'PALATINO_LINGUAL', 'margen')}
            {filaNic('PALATINO_LINGUAL')}
            {filaMarca('Placa', 'PALATINO_LINGUAL', 'placa', '#2A6B80')}
            {filaMarca('Sangrado', 'PALATINO_LINGUAL', 'sangrado', '#B94642')}
            {filaMarca('Supuración', 'PALATINO_LINGUAL', 'supuracion', '#CA933E')}

            {/* Datos por pieza */}
            <tr className="bg-tinta-50">
              <th className="sticky left-0 z-10 bg-tinta-50 px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Movilidad
              </th>
              {visibles.map((p) => (
                <td key={p.pieza} className="border-l border-tinta-200 p-0 text-center">
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={p.movilidad ?? ''}
                    disabled={p.ausente || !puedeEditar}
                    onChange={(e) =>
                      actualizarPieza(p.pieza, {
                        movilidad: e.target.value === '' ? null : parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full border-0 bg-transparent p-0 text-center text-[11px] tabular-nums outline-none focus:bg-brand-50 disabled:opacity-30"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Furca
              </th>
              {visibles.map((p) => {
                const pieza = buscarPieza(p.pieza);
                return (
                  <td key={p.pieza} className="border-l border-tinta-200 p-0 text-center">
                    {pieza?.tieneFurca ? (
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={p.furcaVestibular ?? ''}
                        disabled={p.ausente || !puedeEditar}
                        onChange={(e) =>
                          actualizarPieza(p.pieza, {
                            furcaVestibular: e.target.value === '' ? null : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full border-0 bg-transparent p-0 text-center text-[11px] tabular-nums outline-none focus:bg-brand-50 disabled:opacity-30"
                      />
                    ) : (
                      <span className="text-[11px] text-tinta-300">·</span>
                    )}
                  </td>
                );
              })}
            </tr>

            <tr className="bg-tinta-50">
              <th className="sticky left-0 z-10 bg-tinta-50 px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Ausente
              </th>
              {visibles.map((p) => (
                <td key={p.pieza} className="border-l border-tinta-200 p-0 text-center">
                  <input
                    type="checkbox"
                    checked={p.ausente}
                    disabled={!puedeEditar}
                    onChange={(e) => actualizarPieza(p.pieza, { ausente: e.target.checked })}
                    className="h-3.5 w-3.5 border-tinta-300 text-error"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11px] font-semibold text-tinta-600">
                Notas
              </th>
              {visibles.map((p) => (
                <td key={p.pieza} className="border-l border-tinta-200 p-0 text-center">
                  <button
                    type="button"
                    onClick={() => setNotaAbierta(notaAbierta === p.pieza ? null : p.pieza)}
                    className={cn(
                      'inline-flex h-5 w-full items-center justify-center',
                      p.notas ? 'text-alerta' : 'text-tinta-300 hover:text-brand-600',
                    )}
                    aria-label={`Notas de la pieza ${p.pieza}`}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Leyenda ── */}
      <div className="flex flex-wrap gap-4 text-xs text-tinta-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-brand-600" /> placa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-error" /> sangrado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-alerta" /> supuración
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-error" /> margen gingival
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand-600" /> fondo de bolsa
        </span>
        <span className="flex items-center gap-1.5">
          <Droplet className="h-3 w-3" /> NIC = sondaje − margen
        </span>
      </div>

      {/* ── Nota de una pieza ── */}
      {notaAbierta && (
        <div className="tarjeta border-alerta-borde bg-alerta-fondo p-4">
          <p className="mb-2 font-display text-sm font-semibold text-alerta-texto">
            Notas de la pieza {notaAbierta}
          </p>
          <textarea
            rows={3}
            value={datos.find((p) => p.pieza === notaAbierta)?.notas ?? ''}
            disabled={!puedeEditar}
            onChange={(e) => actualizarPieza(notaAbierta, { notas: e.target.value || null })}
            className="campo"
            placeholder="Ej: debe realizarse tratamiento con urgencia"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setNotaAbierta(null)}
              className="text-xs text-alerta-texto underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <Campo etiqueta="Observaciones del examen">
        <textarea name="observaciones" rows={2} defaultValue={observaciones ?? ''} className="campo" />
      </Campo>

      {puedeEditar && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="border border-tinta-200 bg-white p-2 shadow">
            <BotonEnviar tamano="lg">Guardar periodontograma</BotonEnviar>
          </div>
        </div>
      )}
    </Formulario>
  );
}
