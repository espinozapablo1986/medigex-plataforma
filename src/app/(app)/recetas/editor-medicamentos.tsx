'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export interface Medicamento {
  medicamento: string;
  principioActivo: string;
  presentacion: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  cantidad: string;
  indicaciones: string;
}

const VIAS = ['Oral', 'Sublingual', 'Tópica', 'Intramuscular', 'Endovenosa', 'Inhalatoria', 'Oftálmica', 'Ótica', 'Rectal'];

function vacio(): Medicamento {
  return {
    medicamento: '',
    principioActivo: '',
    presentacion: '',
    dosis: '',
    via: 'Oral',
    frecuencia: '',
    duracion: '',
    cantidad: '',
    indicaciones: '',
  };
}

/** Editor de los medicamentos de una receta; viajan como JSON al servidor. */
export function EditorMedicamentos() {
  const [items, setItems] = useState<Medicamento[]>([vacio()]);

  const actualizar = (indice: number, cambios: Partial<Medicamento>) =>
    setItems((previo) => previo.map((m, i) => (i === indice ? { ...m, ...cambios } : m)));

  const validos = items.filter((m) => m.medicamento.trim() !== '');

  return (
    <div className="space-y-4">
      <input type="hidden" name="medicamentos" value={JSON.stringify(validos)} />

      {items.map((item, indice) => (
        <fieldset key={indice} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Medicamento {indice + 1}
            </legend>
            <button
              type="button"
              onClick={() => setItems((p) => (p.length === 1 ? [vacio()] : p.filter((_, i) => i !== indice)))}
              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Quitar medicamento"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="etiqueta">
                Medicamento<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <input
                value={item.medicamento}
                onChange={(e) => actualizar(indice, { medicamento: e.target.value })}
                placeholder="Amoxicilina 500 mg"
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Principio activo</span>
              <input
                value={item.principioActivo}
                onChange={(e) => actualizar(indice, { principioActivo: e.target.value })}
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Presentación</span>
              <input
                value={item.presentacion}
                onChange={(e) => actualizar(indice, { presentacion: e.target.value })}
                placeholder="Comprimidos recubiertos"
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Cantidad a dispensar</span>
              <input
                value={item.cantidad}
                onChange={(e) => actualizar(indice, { cantidad: e.target.value })}
                placeholder="21 comprimidos"
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Dosis</span>
              <input
                value={item.dosis}
                onChange={(e) => actualizar(indice, { dosis: e.target.value })}
                placeholder="1 comprimido"
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Vía de administración</span>
              <select value={item.via} onChange={(e) => actualizar(indice, { via: e.target.value })} className="campo">
                {VIAS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="etiqueta">Frecuencia</span>
              <input
                value={item.frecuencia}
                onChange={(e) => actualizar(indice, { frecuencia: e.target.value })}
                placeholder="Cada 8 horas"
                className="campo"
              />
            </label>

            <label className="block">
              <span className="etiqueta">Duración</span>
              <input
                value={item.duracion}
                onChange={(e) => actualizar(indice, { duracion: e.target.value })}
                placeholder="Por 7 días"
                className="campo"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="etiqueta">Indicaciones específicas</span>
              <input
                value={item.indicaciones}
                onChange={(e) => actualizar(indice, { indicaciones: e.target.value })}
                placeholder="Tomar después de las comidas"
                className="campo"
              />
            </label>
          </div>
        </fieldset>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setItems((p) => [...p, vacio()])}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600"
        >
          + Agregar medicamento
        </button>
        {validos.length === 0 && (
          <p className="text-xs text-amber-600">Indica al menos un medicamento para poder emitir la receta.</p>
        )}
      </div>
    </div>
  );
}
