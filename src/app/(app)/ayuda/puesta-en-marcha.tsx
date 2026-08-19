import Link from 'next/link';
import { Check, Circle } from 'lucide-react';

import { Tarjeta } from '@/components/ui';

interface PasoPuesta {
  hecho: boolean;
  texto: string;
  detalle: string;
  href: string;
}

/**
 * Lista de puesta en marcha.
 *
 * Una instalación limpia arranca vacía y sin rumbo: se puede entrar a la
 * agenda y no entender por qué no ofrece ninguna hora. Esto responde esa
 * pregunta antes de que se haga, comprobando el estado **real** de la base de
 * datos en vez de mostrar una lista fija.
 *
 * Desaparece sola cuando todo está listo, para no ocupar sitio para siempre.
 */
export function ListaPuestaEnMarcha({ pasos }: { pasos: PasoPuesta[] }) {
  const pendientes = pasos.filter((p) => !p.hecho);
  if (pendientes.length === 0) return null;

  return (
    <Tarjeta
      titulo="Puesta en marcha"
      descripcion={`Faltan ${pendientes.length} de ${pasos.length} pasos para que la plataforma funcione completa.`}
      className="mb-5"
    >
      <ol className="space-y-2">
        {pasos.map((paso) => (
          <li key={paso.texto} className="flex items-start gap-3">
            {paso.hecho ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-exito" aria-label="listo" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-tinta-300" aria-label="pendiente" />
            )}
            <div className="min-w-0">
              {paso.hecho ? (
                <p className="text-sm text-tinta-400 line-through">{paso.texto}</p>
              ) : (
                <>
                  <Link href={paso.href} className="text-sm font-medium text-brand-700 hover:underline">
                    {paso.texto}
                  </Link>
                  <p className="text-xs text-tinta-500">{paso.detalle}</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}
