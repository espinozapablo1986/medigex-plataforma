'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';

interface Resultado {
  tipo: string;
  titulo: string;
  subtitulo?: string;
  href: string;
}
interface Grupo {
  tipo: string;
  resultados: Resultado[];
}

/**
 * Buscador global con atajo de teclado.
 *
 * Antes había que entrar al módulo antes de poder buscar: para ver la ficha
 * de alguien había que ir a Pacientes, esperar la tabla y recién ahí escribir.
 * Esto busca desde cualquier pantalla, sin cambiar de página.
 *
 * El listado se recorre con las flechas y se abre con Enter, porque en
 * recepción se escribe mirando al paciente, no a la pantalla.
 */
export function BuscadorGlobal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd + K abre; Escape cierra. Se registra una sola vez.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((a) => !a);
      }
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  useEffect(() => {
    if (abierto) campo.current?.focus();
    else {
      setConsulta('');
      setGrupos([]);
      setActivo(0);
    }
  }, [abierto]);

  // Se espera a que deje de escribir: una consulta por tecla saturaría la base.
  useEffect(() => {
    if (consulta.trim().length < 2) {
      setGrupos([]);
      return;
    }
    const cancelar = new AbortController();
    const temporizador = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(consulta)}`, {
          signal: cancelar.signal,
        });
        if (r.ok) {
          const datos = await r.json();
          setGrupos(datos.grupos ?? []);
          setActivo(0);
        }
      } catch {
        // Petición cancelada por una tecla posterior: no es un error.
      } finally {
        setCargando(false);
      }
    }, 220);

    return () => {
      clearTimeout(temporizador);
      cancelar.abort();
    };
  }, [consulta]);

  const planos = grupos.flatMap((g) => g.resultados);

  function navegar(destino: string) {
    setAbierto(false);
    router.push(destino);
  }

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, planos.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const elegido = planos[activo];
      if (elegido) navegar(elegido.href);
      else if (consulta.trim()) navegar(`/buscar?q=${encodeURIComponent(consulta)}`);
    }
  }

  let indice = -1;

  return (
    <>
      {/* Disparador: en la barra superior de la aplicación. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-2 border border-tinta-200 bg-white px-3 py-2 text-sm text-tinta-400 transition hover:border-brand-400 sm:w-72"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Buscar en todo…</span>
        <kbd className="hidden shrink-0 border border-tinta-200 px-1.5 py-0.5 font-mono text-[10px] text-tinta-400 sm:inline">
          ⌘K
        </kbd>
      </button>

      {!abierto ? null : (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-brand-900/40 p-4 pt-[10vh]"
          onClick={() => setAbierto(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl border border-tinta-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en toda la plataforma"
          >
            <div className="flex items-center gap-2 border-b border-tinta-200 px-4">
              <Search className="h-4 w-4 shrink-0 text-tinta-400" aria-hidden />
              <input
                ref={campo}
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={alTeclear}
                placeholder="Paciente, RUT, N.° de ficha, servicio, folio…"
                className="w-full bg-transparent py-3 text-base text-brand-900 outline-none placeholder:text-tinta-400"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {consulta.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-sm text-tinta-400">
                  Escribe al menos dos letras. Busca pacientes, profesionales, servicios, contactos, folios y guías
                  de ayuda.
                </p>
              ) : cargando && planos.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-tinta-400">Buscando…</p>
              ) : planos.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-tinta-400">
                  Nada coincide con «{consulta}».
                </p>
              ) : (
                grupos.map((grupo) => (
                  <div key={grupo.tipo} className="border-b border-tinta-100 last:border-0">
                    <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-tinta-400">
                      {grupo.tipo}
                    </p>
                    <ul>
                      {grupo.resultados.map((r) => {
                        indice += 1;
                        const esteIndice = indice;
                        return (
                          <li key={r.href + r.titulo}>
                            <button
                              type="button"
                              onMouseEnter={() => setActivo(esteIndice)}
                              onClick={() => navegar(r.href)}
                              className={cn(
                                'flex w-full flex-col items-start px-4 py-2 text-left transition',
                                esteIndice === activo ? 'bg-brand-50' : 'hover:bg-tinta-50',
                              )}
                            >
                              <span className="text-sm font-medium text-brand-900">{r.titulo}</span>
                              {r.subtitulo && (
                                <span className="text-xs text-tinta-500">{r.subtitulo}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-tinta-200 px-4 py-2 text-[11px] text-tinta-400">
              <span>↑↓ para moverte · Enter para abrir · Esc para cerrar</span>
              {consulta.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => navegar(`/buscar?q=${encodeURIComponent(consulta)}`)}
                  className="text-brand-600 hover:underline"
                >
                  Ver todos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
