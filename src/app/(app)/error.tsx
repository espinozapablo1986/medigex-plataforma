'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { clasesBoton } from '@/components/ui';

/**
 * Red de seguridad para las acciones que devuelven void (los botones de
 * eliminar, activar o "Ver como"): al no tener formulario con estado, un
 * error suyo llegaría como pantalla en blanco. Aquí al menos se lee el
 * motivo —por ejemplo el bloqueo de escritura durante la vista previa— y se
 * puede volver atrás.
 */
export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg border border-tinta-200 bg-white p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-alerta" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-tinta-900">No se pudo completar la operación</h1>
      <p className="mt-2 text-sm text-tinta-600">{error.message || 'Ocurrió un error inesperado.'}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={reset} className={clasesBoton('secundario')}>
          Reintentar
        </button>
        <Link href="/" className={clasesBoton('primario')}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
