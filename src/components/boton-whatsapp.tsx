import { MessageCircle } from 'lucide-react';

import { enlaceWhatsapp } from '@/lib/whatsapp';
import { cn } from '@/lib/cn';

/**
 * Abre WhatsApp con el mensaje escrito, para que una persona lo revise y lo
 * envíe. Si el teléfono registrado no sirve, no se dibuja el botón: es
 * preferible que no esté a que lleve a una conversación en blanco.
 */
export function BotonWhatsapp({
  telefono,
  mensaje,
  etiqueta,
  className,
}: {
  telefono: string | null | undefined;
  mensaje: string;
  /** Si se omite, queda como botón de sólo icono. */
  etiqueta?: string;
  className?: string;
}) {
  const enlace = enlaceWhatsapp(telefono, mensaje);
  if (!enlace) return null;

  return (
    <a
      href={enlace}
      target="_blank"
      rel="noreferrer"
      title={etiqueta ?? 'Escribir por WhatsApp'}
      aria-label={etiqueta ?? 'Escribir por WhatsApp'}
      className={cn(
        'inline-flex items-center gap-1.5 border border-exito-borde bg-exito-fondo px-2.5 py-1.5',
        'text-sm font-medium text-exito-texto transition hover:brightness-95',
        className,
      )}
    >
      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
      {etiqueta}
    </a>
  );
}
