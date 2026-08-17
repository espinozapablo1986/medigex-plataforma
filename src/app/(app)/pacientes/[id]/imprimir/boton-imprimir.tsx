'use client';

import { Printer } from 'lucide-react';

/** Abre el diálogo de impresión del navegador, que también permite «Guardar como PDF». */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
    >
      <Printer className="h-4 w-4" />
      Imprimir o guardar PDF
    </button>
  );
}
