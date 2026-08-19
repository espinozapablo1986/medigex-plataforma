import Link from 'next/link';
import { Search } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { puede, requerirSesion } from '@/lib/auth';
import { AREAS, GUIAS, buscarGuias } from '@/lib/ayuda';
import { Aviso, Campo, EncabezadoPagina, EstadoVacio, Tarjeta, clasesBoton } from '@/components/ui';

import { ListaPuestaEnMarcha } from './puesta-en-marcha';

export const metadata = { title: 'Ayuda' };

export default async function PaginaAyuda({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const sesion = await requerirSesion();

  // Sólo se ofrecen las guías de módulos que la persona puede abrir: enseñar a
  // usar algo a lo que no tiene acceso sólo genera frustración.
  const visibles = GUIAS.filter((g) => puede(sesion, g.slug, 'ver'));
  const resultados = buscarGuias(q ?? '', visibles);
  const esAdministrador = puede(sesion, 'configuracion', 'editar');

  // El estado de la puesta en marcha se consulta de verdad, no se supone.
  const [profesionales, servicios, boxes, formasPago, condicionesEnlazadas, config] = esAdministrador
    ? await Promise.all([
        prisma.profesional.count({ where: { activo: true } }),
        prisma.servicio.count({ where: { activo: true } }),
        prisma.box.count({ where: { activo: true } }),
        prisma.formaPago.count({ where: { activo: true } }),
        prisma.condicionDental.count({ where: { servicioId: { not: null } } }),
        prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
      ])
    : [0, 0, 0, 0, 0, null];

  return (
    <>
      <EncabezadoPagina
        titulo="Ayuda"
        descripcion="Cómo se usa cada módulo, paso a paso. Empieza por lo que necesites hacer hoy."
      />

      {esAdministrador && (
        <ListaPuestaEnMarcha
          pasos={[
            {
              hecho: Boolean(config?.nombreClinica),
              texto: 'Completar los datos de la clínica',
              detalle: 'Salen impresos en recetas, presupuestos e informes.',
              href: '/configuracion',
            },
            {
              hecho: profesionales > 0,
              texto: 'Cargar los profesionales y su horario',
              detalle: 'Sin bloques de disponibilidad, la agenda no ofrece horas.',
              href: '/profesionales',
            },
            {
              hecho: servicios > 0,
              texto: 'Cargar el tarifario de servicios',
              detalle: 'Con duración y precio: es lo que usa la agenda y lo que se cobra.',
              href: '/servicios',
            },
            {
              hecho: boxes > 0,
              texto: 'Dar de alta los boxes',
              detalle: 'Indicando cuál tiene equipo de rayos X.',
              href: '/boxes',
            },
            {
              hecho: formasPago > 0,
              texto: 'Definir las formas de pago',
              detalle: 'Con sus exigencias de comprobante.',
              href: '/configuracion',
            },
            {
              hecho: condicionesEnlazadas > 0,
              texto: 'Enlazar las condiciones dentales con servicios',
              detalle: 'Sin esto, el odontograma registra pero no puede presupuestar.',
              href: '/configuracion',
            },
          ]}
        />
      )}

      {/* Buscador: formulario GET, para que el resultado sea enlazable. */}
      <Tarjeta className="mb-5">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Campo etiqueta="¿Qué necesitas hacer?">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-400" />
                <input
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder="agendar una hora, cobrar, marcar una caries…"
                  className="campo pl-9"
                />
              </div>
            </Campo>
          </div>
          <button type="submit" className={clasesBoton('primario')}>
            Buscar
          </button>
          {q && (
            <Link href="/ayuda" className="text-sm text-tinta-500 hover:text-brand-600">
              Limpiar
            </Link>
          )}
        </form>
      </Tarjeta>

      {q && (
        <p className="mb-4 text-sm text-tinta-600">
          {resultados.length === 0
            ? 'Ningún tema coincide.'
            : `${resultados.length} ${resultados.length === 1 ? 'tema encontrado' : 'temas encontrados'} para «${q}».`}
        </p>
      )}

      {resultados.length === 0 ? (
        <EstadoVacio
          titulo="No encontramos ese tema"
          descripcion="Prueba con otras palabras, o revisa las guías por área quitando el filtro."
        />
      ) : (
        AREAS.map((area) => {
          const delArea = resultados.filter((g) => g.area === area);
          if (delArea.length === 0) return null;

          return (
            <section key={area} className="mb-6">
              <h2 className="mb-3 font-display text-h3 text-brand-900">{area}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {delArea.map((guia) => (
                  <Link
                    key={guia.slug}
                    href={`/ayuda/${guia.slug}`}
                    className="tarjeta block p-4 transition hover:border-brand-400 hover:shadow-md"
                  >
                    <p className="font-medium text-brand-900">{guia.titulo}</p>
                    <p className="mt-1 text-sm text-tinta-600">{guia.resumen}</p>
                    <p className="mt-2 text-xs text-tinta-400">{guia.pasos.length} pasos · {guia.paraQuien}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}

      {visibles.length < GUIAS.length && (
        <Aviso tono="info" titulo="Hay guías que no se muestran">
          Sólo aparecen los módulos a los que tu perfil tiene acceso. Si necesitas uno que no ves, pídeselo a un
          administrador.
        </Aviso>
      )}
    </>
  );
}
