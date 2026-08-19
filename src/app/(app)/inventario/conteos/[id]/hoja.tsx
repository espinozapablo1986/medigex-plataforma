'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Campo } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';

import { guardarConteo } from '../acciones';

export interface ItemHoja {
  id: string;
  sku: string;
  nombre: string;
  unidad: string;
  ubicacion: string | null;
  stockTeorico: number;
  stockContado: number | null;
  observaciones: string | null;
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Hoja de recuento.
 *
 * La existencia teórica va **oculta por omisión**: ver la cifra esperada
 * mientras se cuenta empuja a confirmarla en vez de contar, que es el error
 * clásico de los inventarios. Se puede revelar con un botón, para revisar las
 * diferencias antes de cerrar.
 *
 * Todo se envía junto al guardar. Un conteo de bodega son cientos de
 * posiciones y guardarlas de a una dejaría el recuento a medias ante
 * cualquier corte de conexión.
 */
export function HojaConteo({
  conteoId,
  items,
  puedeEditar,
}: {
  conteoId: string;
  items: ItemHoja[];
  puedeEditar: boolean;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.stockContado === null ? '' : String(i.stockContado)])),
  );
  const [notas, setNotas] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.observaciones ?? ''])),
  );
  const [verTeorico, setVerTeorico] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const visibles = useMemo(() => {
    const terminos = normalizar(filtro).split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (soloPendientes && valores[i.id]?.trim() !== '') return false;
      if (terminos.length === 0) return true;
      const heno = normalizar(`${i.sku} ${i.nombre} ${i.ubicacion ?? ''}`);
      return terminos.every((t) => heno.includes(t));
    });
  }, [items, filtro, soloPendientes, valores]);

  const contados = items.filter((i) => valores[i.id]?.trim() !== '').length;

  // Se envía todo, no sólo lo visible: filtrar es una ayuda para recorrer la
  // bodega, no una selección de lo que se guarda.
  const carga = JSON.stringify(
    items.map((i) => {
      const crudo = valores[i.id]?.trim() ?? '';
      const n = crudo === '' ? null : Number(crudo.replace(',', '.'));
      return {
        itemId: i.id,
        contado: n === null || Number.isNaN(n) ? null : n,
        observaciones: notas[i.id]?.trim() || null,
      };
    }),
  );

  return (
    <Formulario accion={guardarConteo} className="space-y-4">
      <input type="hidden" name="conteoId" value={conteoId} />
      <input type="hidden" name="lineas" value={carga} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Campo etiqueta="Buscar en la hoja">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-400" />
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="SKU, nombre o ubicación"
                className="campo pl-9"
              />
            </div>
          </Campo>
        </div>

        <label className="flex h-10 items-center gap-2 text-sm text-tinta-600">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="h-4 w-4"
          />
          Sólo lo que falta contar
        </label>

        <button
          type="button"
          onClick={() => setVerTeorico((v) => !v)}
          className="flex h-10 items-center gap-1.5 border border-tinta-300 bg-white px-3 text-sm text-tinta-700 hover:bg-tinta-50"
          title="Ver la existencia teórica sesga el recuento; úsalo para revisar, no para contar."
        >
          {verTeorico ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {verTeorico ? 'Ocultar' : 'Ver'} existencia del sistema
        </button>
      </div>

      <p className="text-sm text-tinta-600">
        {contados} de {items.length} posiciones contadas
        {visibles.length !== items.length && ` · ${visibles.length} en pantalla`}
      </p>

      <div className="scroll-fino overflow-x-auto border border-tinta-200 bg-white">
        <table className="tabla-tarjetas w-full text-sm">
          <thead className="bg-tinta-50">
            <tr>
              <th className="px-3 py-2 text-left font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                Producto
              </th>
              <th className="px-3 py-2 text-left font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                Ubicación
              </th>
              {verTeorico && (
                <th className="px-3 py-2 text-right font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                  Sistema
                </th>
              )}
              <th className="px-3 py-2 text-right font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                Contado
              </th>
              {verTeorico && (
                <th className="px-3 py-2 text-right font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                  Diferencia
                </th>
              )}
              <th className="px-3 py-2 text-left font-sans text-[11px] font-semibold uppercase tracking-wider text-tinta-600">
                Observaciones
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((i) => {
              const crudo = valores[i.id]?.trim() ?? '';
              const n = crudo === '' ? null : Number(crudo.replace(',', '.'));
              const dif = n === null || Number.isNaN(n) ? null : n - i.stockTeorico;

              return (
                <tr key={i.id} className="border-b border-tinta-100 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-brand-900">{i.nombre}</p>
                    <p className="dato text-xs">{i.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-tinta-500">{i.ubicacion ?? '—'}</td>
                  {verTeorico && (
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-500">{i.stockTeorico}</td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valores[i.id] ?? ''}
                      onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                      disabled={!puedeEditar}
                      placeholder="—"
                      aria-label={`Cantidad contada de ${i.nombre}`}
                      className={cn(
                        'w-24 border px-2 py-1 text-right tabular-nums',
                        crudo === '' ? 'border-tinta-200 bg-tinta-50' : 'border-brand-300 bg-white',
                      )}
                    />
                    <span className="ml-1 text-[11px] text-tinta-400">{i.unidad.toLowerCase()}</span>
                  </td>
                  {verTeorico && (
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        dif === null ? 'text-tinta-300' : dif === 0 ? 'text-tinta-400' : dif > 0 ? 'text-exito' : 'text-error',
                      )}
                    >
                      {dif === null ? '—' : dif > 0 ? `+${dif}` : dif}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={notas[i.id] ?? ''}
                      onChange={(e) => setNotas((v) => ({ ...v, [i.id]: e.target.value }))}
                      disabled={!puedeEditar}
                      aria-label={`Observaciones de ${i.nombre}`}
                      className="w-full border border-tinta-200 px-2 py-1 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 && (
        <p className="py-6 text-center text-sm text-tinta-400">Ninguna posición coincide con el filtro.</p>
      )}

      {puedeEditar && (
        <div className="sticky bottom-0 flex justify-end border-t border-tinta-200 bg-marfil/95 py-3 backdrop-blur">
          <BotonEnviar>Guardar conteo</BotonEnviar>
        </div>
      )}
    </Formulario>
  );
}
