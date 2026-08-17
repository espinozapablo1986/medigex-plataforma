'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

interface ModuloDef {
  slug: string;
  nombre: string;
  grupo: string;
  descripcion: string;
  acciones: string[];
}

/**
 * Matriz módulo × acción. Cada casilla marcada se envía como
 * `permiso=<modulo>.<accion>`, y la server action reconstruye la tabla completa.
 */
export function MatrizPermisos({
  grupos,
  modulos,
  acciones,
  etiquetas,
  activos,
  soloLectura,
}: {
  grupos: string[];
  modulos: ModuloDef[];
  acciones: string[];
  etiquetas: Record<string, string>;
  activos: string[];
  soloLectura?: boolean;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(activos));

  const alternar = (clave: string) => {
    if (soloLectura) return;
    setMarcados((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  };

  const alternarFila = (modulo: ModuloDef) => {
    if (soloLectura) return;
    const claves = modulo.acciones.map((a) => `${modulo.slug}.${a}`);
    const todasMarcadas = claves.every((c) => marcados.has(c));
    setMarcados((previo) => {
      const siguiente = new Set(previo);
      claves.forEach((c) => (todasMarcadas ? siguiente.delete(c) : siguiente.add(c)));
      return siguiente;
    });
  };

  const alternarGrupo = (grupo: string) => {
    if (soloLectura) return;
    const delGrupo = modulos.filter((m) => m.grupo === grupo);
    const claves = delGrupo.flatMap((m) => m.acciones.map((a) => `${m.slug}.${a}`));
    const todasMarcadas = claves.every((c) => marcados.has(c));
    setMarcados((previo) => {
      const siguiente = new Set(previo);
      claves.forEach((c) => (todasMarcadas ? siguiente.delete(c) : siguiente.add(c)));
      return siguiente;
    });
  };

  return (
    <div className="space-y-5">
      {/* Los checkboxes reales viajan ocultos para poder controlar el estado */}
      {[...marcados].map((clave) => (
        <input key={clave} type="hidden" name="permiso" value={clave} />
      ))}

      {grupos.map((grupo) => {
        const delGrupo = modulos.filter((m) => m.grupo === grupo);
        if (delGrupo.length === 0) return null;

        return (
          <section key={grupo} className="tarjeta overflow-hidden">
            <header className="flex items-center justify-between border-b border-tinta-200 bg-tinta-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-tinta-900">{grupo}</h3>
              {!soloLectura && (
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Alternar todo el grupo
                </button>
              )}
            </header>

            <div className="scroll-fino overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tinta-200 text-xs uppercase tracking-wide text-tinta-500">
                    <th className="px-4 py-2 text-left font-semibold">Módulo</th>
                    {acciones.map((accion) => (
                      <th key={accion} className="w-20 px-2 py-2 text-center font-semibold">
                        {etiquetas[accion] ?? accion}
                      </th>
                    ))}
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {delGrupo.map((modulo) => (
                    <tr key={modulo.slug} className="border-b border-tinta-100 last:border-0 hover:bg-tinta-50/60">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-tinta-800">{modulo.nombre}</p>
                        <p className="text-xs text-tinta-400">{modulo.descripcion}</p>
                      </td>

                      {acciones.map((accion) => {
                        const aplica = modulo.acciones.includes(accion);
                        const clave = `${modulo.slug}.${accion}`;
                        if (!aplica) {
                          return (
                            <td key={accion} className="px-2 py-2.5 text-center text-tinta-200">
                              ·
                            </td>
                          );
                        }
                        return (
                          <td key={accion} className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={marcados.has(clave)}
                              onChange={() => alternar(clave)}
                              disabled={soloLectura}
                              aria-label={`${etiquetas[accion] ?? accion} en ${modulo.nombre}`}
                              className={cn(
                                'h-4 w-4 rounded border-tinta-300 text-brand-600',
                                'focus:ring-2 focus:ring-brand-500/30',
                                soloLectura && 'cursor-not-allowed opacity-60',
                              )}
                            />
                          </td>
                        );
                      })}

                      <td className="px-2 py-2.5 text-right">
                        {!soloLectura && (
                          <button
                            type="button"
                            onClick={() => alternarFila(modulo)}
                            className="text-xs text-tinta-400 hover:text-brand-600"
                          >
                            todo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
