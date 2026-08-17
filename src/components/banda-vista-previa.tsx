import { Eye, LogOut } from 'lucide-react';

import { GuardiaSoloLectura } from './guardia-solo-lectura';

/**
 * Banda permanente que avisa de que lo que se está viendo no es la sesión
 * propia. Va fija abajo y en color de alerta porque el riesgo real es
 * olvidarse de que sigue activa: sin ella, un administrador podría leer mal
 * un panel recortado y creer que faltan datos.
 */
export function BandaVistaPrevia({
  observadoNombre,
  observadoEmail,
  rolNombre,
  administradorNombre,
}: {
  observadoNombre: string;
  observadoEmail: string;
  rolNombre: string;
  administradorNombre: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-alerta-borde bg-alerta-fondo print:hidden">
      <GuardiaSoloLectura observadoNombre={observadoNombre} />

      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Eye className="h-5 w-5 shrink-0 text-alerta-texto" aria-hidden />

        <div className="min-w-0 flex-1 text-sm leading-snug text-alerta-texto">
          <p>
            Estás viendo la plataforma como{' '}
            <strong className="font-semibold">{observadoNombre}</strong>{' '}
            <span className="whitespace-nowrap">({rolNombre})</span>
          </p>
          <p className="text-xs opacity-80">
            Sólo lectura · no se puede guardar nada · sesión real de {administradorNombre} · {observadoEmail}
          </p>
        </div>

        {/* Formulario nativo a una ruta suelta: funciona aunque el rol
            observado no tenga acceso a ningún módulo. */}
        <form action="/api/vista-previa/salir" method="post" className="shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 border border-alerta-texto bg-alerta-texto px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <LogOut className="h-4 w-4" />
            Salir de la vista previa
          </button>
        </form>
      </div>
    </div>
  );
}
