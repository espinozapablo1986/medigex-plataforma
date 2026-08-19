import { Download } from 'lucide-react';

import { requerirPermiso } from '@/lib/auth';
import { COLUMNAS_PRODUCTOS, INSTRUCCIONES_PRODUCTOS } from '@/lib/inventario-importacion';
import { ContenedorTabla, EncabezadoPagina, Tarjeta } from '@/components/ui';

import { FormularioImportacion } from './formulario';

export const metadata = { title: 'Carga masiva de productos' };

export default async function PaginaImportar() {
  await requerirPermiso('inventario', 'crear');

  return (
    <>
      <EncabezadoPagina
        titulo="Carga masiva de productos"
        ayuda="inventario"
        volver={{ href: '/inventario', texto: 'Inventario' }}
        descripcion="Da de alta o actualiza muchos productos de una vez desde una planilla."
        acciones={
          <a
            href="/api/inventario/plantilla?tipo=productos"
            className="inline-flex items-center gap-1.5 border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            <Download className="h-4 w-4" />
            Descargar plantilla
          </a>
        }
      />

      <Tarjeta titulo="Cómo funciona" className="mb-5">
        <ol className="space-y-2 text-sm text-tinta-600">
          {INSTRUCCIONES_PRODUCTOS.map((linea, i) => (
            <li key={linea} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center border border-brand-200 bg-brand-50 font-mono text-[11px] font-semibold text-brand-700"
              >
                {i + 1}
              </span>
              <span>{linea}</span>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta titulo="Subir la planilla" className="mb-5">
        <FormularioImportacion />
      </Tarjeta>

      <Tarjeta titulo="Columnas de la plantilla" sinPadding>
        <ContenedorTabla>
          <thead>
            <tr>
              <th>Columna</th>
              <th>Qué se espera</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNAS_PRODUCTOS.map((c) => (
              <tr key={c.clave}>
                <td className="whitespace-nowrap font-medium text-brand-900">
                  {c.titulo}
                  {c.obligatoria && <span className="ml-1 text-error" title="Obligatoria">*</span>}
                </td>
                <td className="text-sm text-tinta-600">{c.ayuda}</td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      </Tarjeta>
    </>
  );
}
