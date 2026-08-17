'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface Opcion {
  valor: string;
  etiqueta: string;
  /** Segunda línea: RUT, especialidad, precio… */
  detalle?: string;
  /** Texto extra por el que se puede buscar sin mostrarlo. */
  buscarPor?: string;
  deshabilitada?: boolean;
}

/** Quita tildes y pasa a minúsculas, para que "jose" encuentre "José". */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function filtrar(opciones: Opcion[], consulta: string) {
  const q = normalizar(consulta.trim());
  if (!q) return opciones;

  // Cada palabra debe aparecer en algún lado: "car rey" encuentra "Carolina Reyes".
  const palabras = q.split(/\s+/);
  return opciones.filter((o) => {
    const heno = normalizar(`${o.etiqueta} ${o.detalle ?? ''} ${o.buscarPor ?? ''}`);
    return palabras.every((p) => heno.includes(p));
  });
}

// ═══════════════════════════════════════════════════════════════
//  Selección simple
// ═══════════════════════════════════════════════════════════════

/**
 * Lista desplegable en la que además se puede escribir para filtrar.
 *
 * Envía el valor elegido en un campo oculto con el `name` indicado, así que
 * se usa igual que un `<select>` dentro de cualquier formulario.
 */
export function SelectorBuscable({
  name,
  opciones,
  valorInicial,
  placeholder = 'Escribe para buscar…',
  requerido,
  deshabilitado,
  permiteVacio = true,
  textoVacio = 'Sin selección',
  onCambio,
  className,
}: {
  name: string;
  opciones: Opcion[];
  valorInicial?: string | null;
  placeholder?: string;
  requerido?: boolean;
  deshabilitado?: boolean;
  permiteVacio?: boolean;
  textoVacio?: string;
  onCambio?: (valor: string, opcion?: Opcion) => void;
  className?: string;
}) {
  const [valor, setValor] = useState(valorInicial ?? '');
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resaltado, setResaltado] = useState(0);

  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const seleccionada = opciones.find((o) => o.valor === valor);
  const filtradas = useMemo(() => filtrar(opciones, consulta), [opciones, consulta]);

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const alHacerClic = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alHacerClic);
    return () => document.removeEventListener('mousedown', alHacerClic);
  }, [abierto]);

  useEffect(() => {
    if (abierto) {
      setConsulta('');
      setResaltado(0);
      // El foco tiene que esperar a que el panel exista en el DOM.
      requestAnimationFrame(() => entrada.current?.focus());
    }
  }, [abierto]);

  const elegir = (opcion: Opcion | null) => {
    const nuevo = opcion?.valor ?? '';
    setValor(nuevo);
    setAbierto(false);
    onCambio?.(nuevo, opcion ?? undefined);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opcion = filtradas[resaltado];
      if (opcion && !opcion.deshabilitada) elegir(opcion);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
    }
  };

  return (
    <div ref={contenedor} className={cn('relative', className)}>
      {/* El valor real que viaja en el formulario */}
      <input type="hidden" name={name} value={valor} />
      {requerido && (
        // Campo espejo para que el navegador exija la selección igual que un select.
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={valor}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 border-0 p-0 opacity-0"
        />
      )}

      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => setAbierto((a) => !a)}
        className={cn(
          'campo flex items-center justify-between gap-2 text-left',
          !seleccionada && 'text-slate-400',
        )}
      >
        <span className="truncate">
          {seleccionada ? (
            <>
              {seleccionada.etiqueta}
              {seleccionada.detalle && (
                <span className="ml-1.5 text-xs text-slate-400">{seleccionada.detalle}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={entrada}
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setResaltado(0);
              }}
              onKeyDown={alTeclear}
              placeholder="Escribe para filtrar…"
              className="w-full border-0 p-0 text-sm outline-none placeholder:text-slate-400"
            />
            {consulta && (
              <button type="button" onClick={() => setConsulta('')} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul className="scroll-fino max-h-64 overflow-y-auto py-1">
            {permiteVacio && !consulta && (
              <li>
                <button
                  type="button"
                  onClick={() => elegir(null)}
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50"
                >
                  {textoVacio}
                </button>
              </li>
            )}

            {filtradas.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                Sin resultados para “{consulta}”
              </li>
            ) : (
              filtradas.map((opcion, indice) => (
                <li key={opcion.valor}>
                  <button
                    type="button"
                    disabled={opcion.deshabilitada}
                    onClick={() => elegir(opcion)}
                    onMouseEnter={() => setResaltado(indice)}
                    className={cn(
                      'flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-sm',
                      indice === resaltado ? 'bg-brand-50' : 'hover:bg-slate-50',
                      opcion.deshabilitada && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">{opcion.etiqueta}</span>
                      {opcion.detalle && (
                        <span className="block truncate text-xs text-slate-400">{opcion.detalle}</span>
                      )}
                    </span>
                    {opcion.valor === valor && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                  </button>
                </li>
              ))
            )}
          </ul>

          {opciones.length > 12 && (
            <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">
              {filtradas.length} de {opciones.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Selección múltiple
// ═══════════════════════════════════════════════════════════════

/**
 * Igual que el anterior, pero acumula varias opciones. Envía un campo oculto
 * por cada valor elegido, de modo que el servidor los lee con `getAll(name)`.
 */
export function SelectorMultiple({
  name,
  opciones,
  valoresIniciales,
  placeholder = 'Agregar…',
  onCambio,
  className,
}: {
  name: string;
  opciones: Opcion[];
  valoresIniciales?: string[];
  placeholder?: string;
  onCambio?: (valores: string[]) => void;
  className?: string;
}) {
  const [valores, setValores] = useState<string[]>(valoresIniciales ?? []);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');

  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const disponibles = useMemo(
    () => filtrar(opciones.filter((o) => !valores.includes(o.valor)), consulta),
    [opciones, valores, consulta],
  );

  useEffect(() => {
    if (!abierto) return;
    const alHacerClic = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alHacerClic);
    return () => document.removeEventListener('mousedown', alHacerClic);
  }, [abierto]);

  useEffect(() => {
    if (abierto) requestAnimationFrame(() => entrada.current?.focus());
  }, [abierto]);

  const actualizar = (siguientes: string[]) => {
    setValores(siguientes);
    onCambio?.(siguientes);
  };

  const agregar = (valor: string) => {
    actualizar([...valores, valor]);
    setConsulta('');
  };

  const quitar = (valor: string) => actualizar(valores.filter((v) => v !== valor));

  const elegidas = valores
    .map((v) => opciones.find((o) => o.valor === v))
    .filter((o): o is Opcion => Boolean(o));

  return (
    <div ref={contenedor} className={cn('relative', className)}>
      {valores.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <div className="campo flex min-h-[2.6rem] flex-wrap items-center gap-1.5 py-1.5">
        {elegidas.map((opcion) => (
          <span
            key={opcion.valor}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
          >
            {opcion.etiqueta}
            <button
              type="button"
              onClick={() => quitar(opcion.valor)}
              className="rounded text-brand-400 hover:bg-brand-100 hover:text-brand-700"
              aria-label={`Quitar ${opcion.etiqueta}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          className="text-sm text-slate-400 hover:text-brand-600"
        >
          {elegidas.length === 0 ? placeholder : '+ agregar'}
        </button>
      </div>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={entrada}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (disponibles[0]) agregar(disponibles[0].valor);
                } else if (e.key === 'Escape') {
                  setAbierto(false);
                }
              }}
              placeholder="Escribe para filtrar…"
              className="w-full border-0 p-0 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <ul className="scroll-fino max-h-64 overflow-y-auto py-1">
            {disponibles.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                {consulta ? `Sin resultados para “${consulta}”` : 'No queda nada por agregar'}
              </li>
            ) : (
              disponibles.map((opcion) => (
                <li key={opcion.valor}>
                  <button
                    type="button"
                    onClick={() => agregar(opcion.valor)}
                    className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-800">{opcion.etiqueta}</span>
                    {opcion.detalle && <span className="truncate text-xs text-slate-400">{opcion.detalle}</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
