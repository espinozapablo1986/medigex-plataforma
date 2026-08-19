import Link from 'next/link';
import { Search } from 'lucide-react';

import { requerirSesion } from '@/lib/auth';
import { buscarGlobal } from '@/lib/busqueda';
import { Campo, EncabezadoPagina, EstadoVacio, Tarjeta, clasesBoton } from '@/components/ui';

export const metadata = { title: 'Buscar' };

/**
 * Resultados completos. Existe además del buscador rápido para que la
 * búsqueda sea enlazable y funcione sin JavaScript.
 */
export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const sesion = await requerirSesion();
  const consulta = (q ?? '').trim();
  const grupos = consulta.length >= 2 ? await buscarGlobal(consulta, sesion) : [];
  const total = grupos.reduce((suma, g) => suma + g.resultados.length, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Buscar"
        descripcion="Pacientes, profesionales, servicios, contactos, folios y guías de ayuda."
      />

      <Tarjeta className="mb-5">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Campo etiqueta="Qué buscas">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-400" />
                <input
                  name="q"
                  defaultValue={consulta}
                  autoFocus
                  placeholder="Nombre, RUT, N.° de ficha, teléfono, folio…"
                  className="campo pl-9"
                />
              </div>
            </Campo>
          </div>
          <button type="submit" className={clasesBoton('primario')}>
            Buscar
          </button>
        </form>
      </Tarjeta>

      {consulta.length < 2 ? (
        <EstadoVacio
          titulo="Escribe qué necesitas encontrar"
          descripcion="Con dos letras basta. También puedes abrir este buscador desde cualquier pantalla con Ctrl o ⌘ + K."
        />
      ) : total === 0 ? (
        <EstadoVacio
          titulo={`Nada coincide con «${consulta}»`}
          descripcion="Prueba con el apellido, el RUT sin puntos o el número de ficha."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-tinta-600">
            {total} {total === 1 ? 'resultado' : 'resultados'} para «{consulta}».
          </p>
          {grupos.map((grupo) => (
            <section key={grupo.tipo} className="mb-5">
              <h2 className="mb-2 font-display text-h3 text-brand-900">{grupo.tipo}</h2>
              <Tarjeta sinPadding>
                <ul className="divide-y divide-tinta-100">
                  {grupo.resultados.map((r) => (
                    <li key={r.href + r.titulo}>
                      <Link href={r.href} className="block px-4 py-3 transition hover:bg-tinta-50">
                        <p className="text-sm font-medium text-brand-900">{r.titulo}</p>
                        {r.subtitulo && <p className="text-xs text-tinta-500">{r.subtitulo}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            </section>
          ))}
        </>
      )}
    </>
  );
}
