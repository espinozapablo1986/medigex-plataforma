import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, HelpCircle, Lightbulb } from 'lucide-react';

import { puede, requerirSesion } from '@/lib/auth';
import { guiaDe } from '@/lib/ayuda';
import { Aviso, EncabezadoPagina, EnlaceBoton, Tarjeta } from '@/components/ui';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: guiaDe(slug)?.titulo ?? 'Ayuda' };
}

export default async function PaginaGuia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guia = guiaDe(slug);
  if (!guia) notFound();

  const sesion = await requerirSesion();
  const tieneAcceso = puede(sesion, guia.slug, 'ver');

  return (
    <>
      <EncabezadoPagina
        titulo={guia.titulo}
        descripcion={guia.resumen}
        volver={{ href: '/ayuda', texto: 'Ayuda' }}
        acciones={
          guia.ruta && tieneAcceso ? <EnlaceBoton href={guia.ruta}>Ir a {guia.titulo}</EnlaceBoton> : undefined
        }
      />

      {!tieneAcceso && (
        <div className="mb-5">
          <Aviso tono="alerta" titulo="Tu perfil no tiene acceso a este módulo">
            Puedes leer la guía, pero no podrás entrar. Si necesitas usarlo, pídele a un administrador que active el
            permiso en Roles y permisos.
          </Aviso>
        </div>
      )}

      <p className="mb-5 text-sm text-tinta-500">
        <span className="etiqueta inline">Quién lo usa</span> {guia.paraQuien}
      </p>

      {/* ── Paso a paso ── */}
      <Tarjeta titulo="Paso a paso" className="mb-5">
        <ol className="space-y-5">
          {guia.pasos.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-4">
              {/* El número sí es información aquí: el orden importa. */}
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center border border-brand-200 bg-brand-50 font-mono text-sm font-semibold text-brand-700"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-medium text-brand-900">{paso.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-tinta-600">{paso.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>

      {/* ── Consejos ── */}
      {guia.consejos && guia.consejos.length > 0 && (
        <Tarjeta titulo="Conviene saber" className="mb-5">
          <ul className="space-y-2.5">
            {guia.consejos.map((consejo) => (
              <li key={consejo} className="flex gap-2.5 text-sm leading-relaxed text-tinta-600">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-alerta" aria-hidden />
                <span>{consejo}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {/* ── Problemas frecuentes ── */}
      {guia.problemas && guia.problemas.length > 0 && (
        <Tarjeta titulo="Si algo no sale" className="mb-5">
          <dl className="space-y-4">
            {guia.problemas.map((p) => (
              <div key={p.problema}>
                <dt className="flex gap-2.5 font-medium text-brand-900">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-tinta-400" aria-hidden />
                  {p.problema}
                </dt>
                <dd className="ml-[26px] mt-1 text-sm leading-relaxed text-tinta-600">{p.solucion}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      )}

      {/* ── Relacionados ── */}
      {guia.relacionados && guia.relacionados.length > 0 && (
        <Tarjeta titulo="Seguir por aquí">
          <div className="flex flex-wrap gap-2">
            {guia.relacionados
              .map((s) => guiaDe(s))
              .filter((g): g is NonNullable<typeof g> => Boolean(g))
              .map((g) => (
                <Link
                  key={g.slug}
                  href={`/ayuda/${g.slug}`}
                  className="inline-flex items-center gap-1.5 border border-tinta-200 px-3 py-1.5 text-sm text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
                >
                  {g.titulo}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ))}
          </div>
        </Tarjeta>
      )}
    </>
  );
}
