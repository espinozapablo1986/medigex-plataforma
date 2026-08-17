'use client';

import { useMemo, useState } from 'react';
import { Check, Eraser, Info } from 'lucide-react';

import { cn } from '@/lib/cn';
import { abreviaturaCara, buscarPieza, filasDe, nombreCara, type Cara } from '@/lib/dental';
import { DientePieza, type MarcaCara } from '@/components/diente';
import { Campo } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { registrarEnOdontograma } from './acciones';

export interface CondicionOpcion {
  id: string;
  codigo: string;
  nombre: string;
  categoria: 'DIAGNOSTICO' | 'PROCEDIMIENTO';
  color: string;
  porCara: boolean;
  tieneServicio: boolean;
}

export interface RegistroVista {
  id: string;
  pieza: string;
  caras: string[];
  estado: 'PENDIENTE' | 'REALIZADO' | 'ANULADO';
  fecha: string;
  observaciones: string | null;
  condicion: { nombre: string; color: string; categoria: 'DIAGNOSTICO' | 'PROCEDIMIENTO' };
  profesional: string | null;
}

/**
 * Odontograma interactivo.
 *
 * El flujo es el que usa un odontólogo en el box: se elige la condición del
 * catálogo —queda como «pincel activo»— y luego se van tocando las caras de
 * las piezas afectadas. Al confirmar se registran todas de una vez, en vez de
 * abrir un formulario por cada diente.
 */
export function EsquemaOdontograma({
  pacienteId,
  denticion,
  condiciones,
  registros,
  atenciones,
  puedeEditar,
}: {
  pacienteId: string;
  denticion: 'PERMANENTE' | 'TEMPORAL';
  condiciones: CondicionOpcion[];
  registros: RegistroVista[];
  atenciones: { id: string; etiqueta: string }[];
  puedeEditar: boolean;
}) {
  const [condicionActiva, setCondicionActiva] = useState<CondicionOpcion | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, Cara[]>>({});
  const [verDiagnosticos, setVerDiagnosticos] = useState(true);
  const [verProcedimientos, setVerProcedimientos] = useState(true);
  const [verPendientes, setVerPendientes] = useState(true);
  const [piezaDetalle, setPiezaDetalle] = useState<string | null>(null);

  const { superior, inferior } = filasDe(denticion);

  /**
   * Color de cada cara según lo ya registrado. Gana el registro más reciente,
   * porque una obturación posterior tapa la caries que la motivó.
   */
  const marcas = useMemo(() => {
    const mapa: Record<string, Partial<Record<Cara, MarcaCara>>> = {};
    const porPieza: Record<string, MarcaCara | undefined> = {};

    const visibles = registros
      .filter((r) => r.estado !== 'ANULADO')
      .filter((r) => (r.estado === 'PENDIENTE' ? verPendientes : true))
      .filter((r) =>
        r.condicion.categoria === 'DIAGNOSTICO' ? verDiagnosticos : verProcedimientos,
      )
      // De más antiguo a más reciente: así el último sobrescribe.
      .slice()
      .reverse();

    for (const r of visibles) {
      const marca: MarcaCara = {
        color: r.condicion.color,
        pendiente: r.estado === 'PENDIENTE',
        titulo: `${r.condicion.nombre}${r.estado === 'PENDIENTE' ? ' (pendiente)' : ''} · ${r.fecha}`,
      };

      if (r.caras.includes('PIEZA_COMPLETA')) {
        porPieza[r.pieza] = marca;
        continue;
      }
      mapa[r.pieza] ??= {};
      for (const cara of r.caras) mapa[r.pieza][cara as Cara] = marca;
    }

    return { porCara: mapa, porPieza };
  }, [registros, verDiagnosticos, verProcedimientos, verPendientes]);

  const totalSeleccionado = Object.values(seleccion).reduce((acc, caras) => acc + caras.length, 0);
  const piezasSeleccionadas = Object.keys(seleccion).filter((p) => seleccion[p].length > 0);

  const alTocarCara = (pieza: string, cara: Cara) => {
    if (!puedeEditar) return;
    if (!condicionActiva) {
      setPiezaDetalle(pieza);
      return;
    }
    if (!condicionActiva.porCara) return;

    setSeleccion((previo) => {
      const actuales = previo[pieza] ?? [];
      const siguiente = actuales.includes(cara)
        ? actuales.filter((c) => c !== cara)
        : [...actuales, cara];
      return { ...previo, [pieza]: siguiente };
    });
  };

  const alTocarPieza = (pieza: string) => {
    if (!puedeEditar) {
      setPiezaDetalle(pieza);
      return;
    }
    if (!condicionActiva) {
      setPiezaDetalle(pieza);
      return;
    }
    if (condicionActiva.porCara) {
      setPiezaDetalle(pieza);
      return;
    }
    // Condición que cubre la pieza entera: se marca de una.
    setSeleccion((previo) => {
      const yaEsta = (previo[pieza] ?? []).includes('PIEZA_COMPLETA');
      return { ...previo, [pieza]: yaEsta ? [] : (['PIEZA_COMPLETA'] as Cara[]) };
    });
  };

  const limpiar = () => setSeleccion({});

  const registrosDePieza = piezaDetalle
    ? registros.filter((r) => r.pieza === piezaDetalle && r.estado !== 'ANULADO')
    : [];

  const fila = (piezas: ReturnType<typeof filasDe>['superior']) => (
    <div className="flex justify-center gap-0.5">
      {piezas.map((pieza, indice) => (
        <div
          key={pieza.codigo}
          // Separación al centro, donde cambia de cuadrante
          className={cn(indice === piezas.length / 2 && 'ml-4')}
        >
          <DientePieza
            pieza={pieza}
            marcas={marcas.porCara[pieza.codigo] ?? {}}
            marcaPieza={marcas.porPieza[pieza.codigo]}
            seleccionadas={seleccion[pieza.codigo] ?? []}
            onCara={(cara) => alTocarCara(pieza.codigo, cara)}
            onPieza={() => alTocarPieza(pieza.codigo)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Catálogo de condiciones ── */}
      {puedeEditar && (
        <div className="tarjeta p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-tinta-600">
              {condicionActiva ? 'Marcando:' : 'Elige qué vas a marcar'}
            </p>
            {condicionActiva && (
              <button
                type="button"
                onClick={() => {
                  setCondicionActiva(null);
                  limpiar();
                }}
                className="inline-flex items-center gap-1 text-xs text-tinta-500 hover:text-error"
              >
                <Eraser className="h-3.5 w-3.5" />
                Salir del modo marcado
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {condiciones.map((c) => {
              const activa = condicionActiva?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCondicionActiva(activa ? null : c);
                    limpiar();
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium transition',
                    activa
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-tinta-300 bg-white text-brand-900 hover:bg-tinta-50',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.nombre}
                  {!c.porCara && <span className="text-[10px] opacity-60">pieza</span>}
                </button>
              );
            })}
          </div>

          {condicionActiva && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-tinta-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {condicionActiva.porCara
                ? 'Toca las caras afectadas en el esquema. Puedes marcar varias piezas antes de confirmar.'
                : 'Toca las piezas afectadas. Esta condición cubre el diente completo.'}
            </p>
          )}
        </div>
      )}

      {/* ── Filtros de visualización ── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-tinta-600">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={verDiagnosticos}
            onChange={(e) => setVerDiagnosticos(e.target.checked)}
            className="h-3.5 w-3.5 border-tinta-300 text-brand-600"
          />
          Diagnósticos
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={verProcedimientos}
            onChange={(e) => setVerProcedimientos(e.target.checked)}
            className="h-3.5 w-3.5 border-tinta-300 text-brand-600"
          />
          Procedimientos
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={verPendientes}
            onChange={(e) => setVerPendientes(e.target.checked)}
            className="h-3.5 w-3.5 border-tinta-300 text-brand-600"
          />
          Pendientes <span className="text-tinta-400">(en trama)</span>
        </label>
      </div>

      {/* ── Esquema ── */}
      <div className="tarjeta scroll-fino overflow-x-auto p-4">
        <div className="min-w-max space-y-3">
          {fila(superior)}
          <div className="mx-auto h-px w-full max-w-3xl bg-tinta-200" />
          {fila(inferior)}
        </div>
      </div>

      {/* ── Confirmación del lote marcado ── */}
      {puedeEditar && condicionActiva && totalSeleccionado > 0 && (
        <Formulario accion={registrarEnOdontograma} className="tarjeta border-brand-600 p-4">
          <input type="hidden" name="pacienteId" value={pacienteId} />
          <input type="hidden" name="condicionId" value={condicionActiva.id} />
          <input type="hidden" name="denticion" value={denticion} />
          {piezasSeleccionadas.map((p) => (
            <input key={p} type="hidden" name="piezas" value={p} />
          ))}
          {/* Las caras se aplican por igual a todas las piezas marcadas. */}
          {[...new Set(piezasSeleccionadas.flatMap((p) => seleccion[p]))].map((c) => (
            <input key={c} type="hidden" name="caras" value={c} />
          ))}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: condicionActiva.color }}
            />
            <p className="text-sm font-semibold text-brand-900">{condicionActiva.nombre}</p>
            <p className="text-sm text-tinta-600">
              en {piezasSeleccionadas.length} pieza(s):{' '}
              {piezasSeleccionadas.map((p) => {
                const caras = seleccion[p];
                const pieza = buscarPieza(p);
                return (
                  <span key={p} className="mr-2 font-mono text-xs">
                    {p}
                    {caras[0] !== 'PIEZA_COMPLETA' && (
                      <span className="text-tinta-400">
                        {' '}
                        {caras.map((c) => abreviaturaCara(c, pieza)).join('')}
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Estado">
              <select name="estado" defaultValue="REALIZADO" className="campo">
                <option value="REALIZADO">Realizado</option>
                <option value="PENDIENTE">Pendiente por hacer</option>
              </select>
            </Campo>
            <Campo etiqueta="Asociar a atención">
              <select name="atencionId" className="campo">
                <option value="">Sin asociar</option>
                {atenciones.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Observaciones">
              <input name="observaciones" className="campo" />
            </Campo>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={limpiar}
              className="border border-tinta-300 bg-white px-3.5 py-2 text-sm font-medium text-brand-900 hover:bg-tinta-50"
            >
              Descartar
            </button>
            <BotonEnviar>
              <Check className="h-4 w-4" />
              Registrar
            </BotonEnviar>
          </div>
        </Formulario>
      )}

      {/* ── Detalle de una pieza ── */}
      {piezaDetalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/60 p-4 sm:p-8">
          <div className="w-full max-w-2xl bg-white shadow">
            <header className="flex items-center justify-between border-b border-tinta-200 px-5 py-3">
              <h2 className="font-display text-sm font-semibold text-brand-900">
                Pieza {piezaDetalle}
                <span className="ml-2 font-sans text-xs font-normal text-tinta-500">
                  {buscarPieza(piezaDetalle)?.tipo}
                  {buscarPieza(piezaDetalle)?.arcada === 'superior' ? ' superior' : ' inferior'}
                </span>
              </h2>
              <button
                onClick={() => setPiezaDetalle(null)}
                className="p-1 text-tinta-400 hover:bg-tinta-100 hover:text-brand-900"
              >
                ✕
              </button>
            </header>

            <div className="p-5">
              {registrosDePieza.length === 0 ? (
                <p className="text-sm text-tinta-500">Esta pieza no tiene registros.</p>
              ) : (
                <ul className="space-y-2.5">
                  {registrosDePieza.map((r) => {
                    const pieza = buscarPieza(r.pieza);
                    return (
                      <li key={r.id} className="flex items-start gap-2.5 border-l-2 pl-3" style={{ borderColor: r.condicion.color }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-brand-900">
                            {r.condicion.nombre}
                            {r.estado === 'PENDIENTE' && (
                              <span className="ml-2 bg-alerta-fondo px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-alerta-texto">
                                pendiente
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-tinta-500">
                            {r.caras.includes('PIEZA_COMPLETA')
                              ? 'Pieza completa'
                              : r.caras.map((c) => nombreCara(c as Cara, pieza)).join(', ')}
                            {' · '}
                            {r.fecha}
                            {r.profesional && ` · ${r.profesional}`}
                          </p>
                          {r.observaciones && <p className="mt-0.5 text-xs text-tinta-600">{r.observaciones}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
