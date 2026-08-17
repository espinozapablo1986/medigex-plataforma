'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { clasesBoton, type VarianteBoton } from './ui';
import type { Resultado } from '@/lib/resultado';

// ─────────────────────────────────────────────────────────────
//  Botón de envío con estado de carga
// ─────────────────────────────────────────────────────────────

export function BotonEnviar({
  children = 'Guardar',
  variante = 'primario',
  tamano = 'md',
  className,
  nombre,
  valor,
}: {
  children?: React.ReactNode;
  variante?: VarianteBoton;
  tamano?: 'sm' | 'md' | 'lg';
  className?: string;
  nombre?: string;
  valor?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={nombre}
      value={valor}
      disabled={pending}
      className={cn(clasesBoton(variante, tamano), className)}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  Formulario con manejo de errores de server action
// ─────────────────────────────────────────────────────────────

export function Formulario({
  accion,
  children,
  className,
  onExito,
  reiniciarAlEnviar,
}: {
  accion: (estadoPrevio: Resultado | null, fd: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  className?: string;
  onExito?: () => void;
  reiniciarAlEnviar?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      if (reiniciarAlEnviar) ref.current?.reset();
      onExito?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form ref={ref} action={ejecutar} className={className}>
      {estado && !estado.ok && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {estado.error}
        </div>
      )}
      {estado?.ok && estado.mensaje && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {estado.mensaje}
        </div>
      )}
      {children}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Eliminar con confirmación
// ─────────────────────────────────────────────────────────────

export function BotonEliminar({
  accion,
  id,
  mensaje = '¿Confirmas que quieres eliminar este registro? Esta acción no se puede deshacer.',
  texto = 'Eliminar',
  tamano = 'sm',
  variante = 'secundario',
}: {
  accion: (fd: FormData) => Promise<void>;
  id: string;
  mensaje?: string;
  texto?: string;
  tamano?: 'sm' | 'md';
  variante?: VarianteBoton;
}) {
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <BotonEnviar variante={variante} tamano={tamano}>
        {texto}
      </BotonEnviar>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modal / panel lateral
// ─────────────────────────────────────────────────────────────

export function Modal({
  titulo,
  etiquetaBoton,
  children,
  varianteBoton = 'primario',
  tamanoBoton = 'md',
  ancho = 'max-w-2xl',
}: {
  titulo: string;
  etiquetaBoton: React.ReactNode;
  children: React.ReactNode | ((cerrar: () => void) => React.ReactNode);
  varianteBoton?: VarianteBoton;
  tamanoBoton?: 'sm' | 'md';
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [abierto]);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={clasesBoton(varianteBoton, tamanoBoton)}>
        {etiquetaBoton}
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta-900/50 p-4 sm:p-8">
          <div className={cn('w-full rounded-xl bg-white shadow-xl', ancho)}>
            <header className="flex items-center justify-between border-b border-tinta-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-tinta-900">{titulo}</h2>
              <button onClick={cerrar} className="rounded p-1 text-tinta-400 hover:bg-tinta-100 hover:text-tinta-700">
                ✕
              </button>
            </header>
            <div className="p-5">{typeof children === 'function' ? children(cerrar) : children}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Filtros que se auto-envían
// ─────────────────────────────────────────────────────────────

export function AutoEnviar({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      onChange={(e) => {
        const objetivo = e.target as HTMLElement;
        if (objetivo.tagName === 'SELECT' || (objetivo as HTMLInputElement).type === 'date') {
          ref.current?.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}
