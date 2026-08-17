'use client';

import { cn } from '@/lib/cn';

interface CupoSerializado {
  inicio: string;
  fin: string;
  disponible: boolean;
  motivo?: string;
}

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Muestra los cupos del profesional en el día elegido. Al pulsar uno libre
 * rellena el campo de fecha y hora del formulario.
 */
export function SelectorCupos({
  cupos,
  hayProfesional,
  fecha,
}: {
  cupos: CupoSerializado[];
  hayProfesional: boolean;
  fecha: string;
}) {
  const elegir = (iso: string) => {
    const campo = document.getElementById('campo-inicio') as HTMLInputElement | null;
    if (!campo) return;
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    campo.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const libres = cupos.filter((c) => c.disponible).length;

  return (
    <aside className="tarjeta h-fit">
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Cupos disponibles</h2>
        <p className="text-xs text-slate-500">
          {hayProfesional ? `${libres} de ${cupos.length} libres el ${fecha}` : 'Elige un profesional para ver sus cupos'}
        </p>
      </header>

      <div className="p-4">
        {!hayProfesional ? (
          <p className="text-sm text-slate-500">
            Selecciona un profesional y vuelve a cargar la página con la fecha deseada para ver sus horas libres.
          </p>
        ) : cupos.length === 0 ? (
          <p className="text-sm text-slate-500">
            El profesional no tiene disponibilidad configurada para este día de la semana.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {cupos.map((c) => (
              <button
                key={c.inicio}
                type="button"
                disabled={!c.disponible}
                title={c.motivo}
                onClick={() => elegir(c.inicio)}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums transition',
                  c.disponible
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through',
                )}
              >
                {hhmm(c.inicio)}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
