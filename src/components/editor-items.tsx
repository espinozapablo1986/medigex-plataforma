'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface OpcionServicio {
  id: string;
  nombre: string;
  precio: number;
  afectoIva: boolean;
  duracionMinutos: number;
}

export interface OpcionProducto {
  id: string;
  nombre: string;
  sku: string;
  precioVenta: number;
  afectoIva: boolean;
  stockActual: number;
}

export interface OpcionProfesional {
  id: string;
  nombre: string;
}

export interface LineaItem {
  tipo: 'SERVICIO' | 'PRODUCTO' | 'OTRO';
  servicioId: string | null;
  productoId: string | null;
  profesionalId: string | null;
  descripcion: string;
  piezaDental: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  afectoIva: boolean;
}

function clp(monto: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
    Math.round(monto || 0),
  );
}

function lineaVacia(): LineaItem {
  return {
    tipo: 'SERVICIO',
    servicioId: null,
    productoId: null,
    profesionalId: null,
    descripcion: '',
    piezaDental: '',
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
    afectoIva: true,
  };
}

/**
 * Editor de líneas compartido por presupuestos y ventas.
 *
 * Las líneas viajan al servidor serializadas en un campo oculto `items`,
 * y el servidor recalcula todos los totales antes de guardar: lo que se
 * muestra aquí es sólo una previsualización.
 */
export function EditorItems({
  servicios,
  productos,
  profesionales,
  ivaPorcentaje,
  lineasIniciales,
  mostrarProfesional = true,
  mostrarPiezaDental = true,
}: {
  servicios: OpcionServicio[];
  productos: OpcionProducto[];
  profesionales?: OpcionProfesional[];
  ivaPorcentaje: number;
  lineasIniciales?: LineaItem[];
  mostrarProfesional?: boolean;
  mostrarPiezaDental?: boolean;
}) {
  const [lineas, setLineas] = useState<LineaItem[]>(lineasIniciales?.length ? lineasIniciales : [lineaVacia()]);
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);

  const actualizar = (indice: number, cambios: Partial<LineaItem>) => {
    setLineas((previo) => previo.map((l, i) => (i === indice ? { ...l, ...cambios } : l)));
  };

  const elegirServicio = (indice: number, servicioId: string) => {
    const servicio = servicios.find((s) => s.id === servicioId);
    actualizar(indice, {
      tipo: 'SERVICIO',
      servicioId: servicioId || null,
      productoId: null,
      descripcion: servicio?.nombre ?? '',
      precioUnitario: servicio?.precio ?? 0,
      afectoIva: servicio?.afectoIva ?? true,
    });
  };

  const elegirProducto = (indice: number, productoId: string) => {
    const producto = productos.find((p) => p.id === productoId);
    actualizar(indice, {
      tipo: 'PRODUCTO',
      productoId: productoId || null,
      servicioId: null,
      descripcion: producto?.nombre ?? '',
      precioUnitario: producto?.precioVenta ?? 0,
      afectoIva: producto?.afectoIva ?? true,
    });
  };

  const totales = useMemo(() => {
    const subtotal = lineas.reduce(
      (acc, l) => acc + Math.max(0, Math.round(l.cantidad * l.precioUnitario) - Math.round(l.descuento)),
      0,
    );
    const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);
    const total = Math.max(0, subtotal - descuentoMonto);

    const brutoAfecto = lineas
      .filter((l) => l.afectoIva)
      .reduce((acc, l) => acc + Math.max(0, Math.round(l.cantidad * l.precioUnitario) - Math.round(l.descuento)), 0);
    const proporcion = subtotal > 0 ? brutoAfecto / subtotal : 0;
    const totalAfecto = Math.round(total * proporcion);
    const tasa = ivaPorcentaje / 100;
    const netoAfecto = tasa > 0 ? Math.round(totalAfecto / (1 + tasa)) : totalAfecto;
    const iva = totalAfecto - netoAfecto;

    return { subtotal, descuentoMonto, iva, neto: total - iva, total };
  }, [lineas, descuentoPorcentaje, ivaPorcentaje]);

  const lineasValidas = lineas.filter((l) => l.descripcion.trim() !== '' && l.precioUnitario >= 0);

  return (
    <div className="space-y-4">
      <input type="hidden" name="items" value={JSON.stringify(lineasValidas)} />
      <input type="hidden" name="descuentoPorcentaje" value={descuentoPorcentaje} />

      <div className="scroll-fino overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Ítem</th>
              {mostrarPiezaDental && <th className="w-20 px-2 py-2 text-left font-semibold">Pieza</th>}
              {mostrarProfesional && profesionales && (
                <th className="w-44 px-2 py-2 text-left font-semibold">Profesional</th>
              )}
              <th className="w-20 px-2 py-2 text-right font-semibold">Cant.</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">P. unitario</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">Dcto.</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea, indice) => (
              <tr key={indice} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <select
                        value={linea.tipo}
                        onChange={(e) => actualizar(indice, { tipo: e.target.value as LineaItem['tipo'] })}
                        className="campo w-28 shrink-0 py-1 text-xs"
                      >
                        <option value="SERVICIO">Servicio</option>
                        <option value="PRODUCTO">Producto</option>
                        <option value="OTRO">Otro</option>
                      </select>

                      {linea.tipo === 'SERVICIO' && (
                        <select
                          value={linea.servicioId ?? ''}
                          onChange={(e) => elegirServicio(indice, e.target.value)}
                          className="campo flex-1 py-1 text-xs"
                        >
                          <option value="">Selecciona un servicio…</option>
                          {servicios.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre} — {clp(s.precio)}
                            </option>
                          ))}
                        </select>
                      )}

                      {linea.tipo === 'PRODUCTO' && (
                        <select
                          value={linea.productoId ?? ''}
                          onChange={(e) => elegirProducto(indice, e.target.value)}
                          className="campo flex-1 py-1 text-xs"
                        >
                          <option value="">Selecciona un producto…</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.sku}) — stock {p.stockActual}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <input
                      value={linea.descripcion}
                      onChange={(e) => actualizar(indice, { descripcion: e.target.value })}
                      placeholder="Descripción que verá el paciente"
                      className="campo py-1 text-xs"
                    />

                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={linea.afectoIva}
                        onChange={(e) => actualizar(indice, { afectoIva: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                      />
                      Afecto a IVA
                    </label>
                  </div>
                </td>

                {mostrarPiezaDental && (
                  <td className="px-2 py-2 align-top">
                    <input
                      value={linea.piezaDental}
                      onChange={(e) => actualizar(indice, { piezaDental: e.target.value })}
                      placeholder="1.6"
                      className="campo py-1 text-xs"
                    />
                  </td>
                )}

                {mostrarProfesional && profesionales && (
                  <td className="px-2 py-2 align-top">
                    <select
                      value={linea.profesionalId ?? ''}
                      onChange={(e) => actualizar(indice, { profesionalId: e.target.value || null })}
                      className="campo py-1 text-xs"
                    >
                      <option value="">Sin asignar</option>
                      {profesionales.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                )}

                <td className="px-2 py-2 align-top">
                  <input
                    type="number"
                    min={0.01}
                    step={1}
                    value={linea.cantidad}
                    onChange={(e) => actualizar(indice, { cantidad: parseFloat(e.target.value) || 0 })}
                    className="campo py-1 text-right text-xs"
                  />
                </td>

                <td className="px-2 py-2 align-top">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={linea.precioUnitario}
                    onChange={(e) => actualizar(indice, { precioUnitario: parseInt(e.target.value, 10) || 0 })}
                    className="campo py-1 text-right text-xs"
                  />
                </td>

                <td className="px-2 py-2 align-top">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={linea.descuento}
                    onChange={(e) => actualizar(indice, { descuento: parseInt(e.target.value, 10) || 0 })}
                    className="campo py-1 text-right text-xs"
                  />
                </td>

                <td className="px-2 py-2 text-right align-top font-medium tabular-nums text-slate-800">
                  {clp(Math.max(0, linea.cantidad * linea.precioUnitario - linea.descuento))}
                </td>

                <td className="px-2 py-2 text-right align-top">
                  <button
                    type="button"
                    onClick={() => setLineas((p) => (p.length === 1 ? [lineaVacia()] : p.filter((_, i) => i !== indice)))}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setLineas((p) => [...p, lineaVacia()])}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600"
        >
          + Agregar línea
        </button>

        <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Fila etiqueta="Subtotal" valor={clp(totales.subtotal)} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              Descuento global
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={descuentoPorcentaje}
                onChange={(e) => setDescuentoPorcentaje(parseFloat(e.target.value) || 0)}
                className="campo w-16 py-1 text-right text-xs"
              />
              %
            </label>
            <span className="tabular-nums text-rose-600">−{clp(totales.descuentoMonto)}</span>
          </div>
          <Fila etiqueta="Neto" valor={clp(totales.neto)} />
          <Fila etiqueta={`IVA (${ivaPorcentaje}%)`} valor={clp(totales.iva)} />
          <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{clp(totales.total)}</span>
          </div>
          {lineasValidas.length === 0 && (
            <p className="text-xs text-amber-600">Agrega al menos una línea con descripción para poder guardar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={cn('flex items-center justify-between text-sm text-slate-600')}>
      <span>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
