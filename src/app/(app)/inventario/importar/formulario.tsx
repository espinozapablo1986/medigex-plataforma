'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { Aviso, Badge, ContenedorTabla } from '@/components/ui';
import { BotonEnviar } from '@/components/formulario';

import { aplicarProductos, previsualizarProductos } from './acciones';

/**
 * Importación de productos en dos pasos: revisar y luego aplicar.
 *
 * El paso intermedio existe porque una planilla mal armada puede reescribir
 * cientos de productos en silencio. Aquí se ve exactamente qué se va a crear,
 * qué se va a actualizar y qué filas se descartan, antes de tocar nada.
 */
export function FormularioImportacion() {
  const [previa, previsualizar] = useActionState(previsualizarProductos, null);
  const [aplicado, aplicar] = useActionState(aplicarProductos, null);

  if (aplicado?.ok && aplicado.resumen) {
    return (
      <Aviso tono="exito" titulo="Carga aplicada">
        Se crearon {aplicado.resumen.creados} productos y se actualizaron {aplicado.resumen.actualizados}.{' '}
        <Link href="/inventario" className="underline">
          Ver el inventario
        </Link>
        .
      </Aviso>
    );
  }

  const nuevos = previa?.ok ? previa.validas.filter((v) => v.accion === 'crear').length : 0;
  const cambios = previa?.ok ? previa.validas.filter((v) => v.accion === 'actualizar').length : 0;

  return (
    <div className="space-y-4">
      <form action={previsualizar} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label className="etiqueta" htmlFor="archivo-productos">
            Planilla (.xlsx o .csv)
          </label>
          <input
            id="archivo-productos"
            type="file"
            name="archivo"
            accept=".xlsx,.csv"
            required
            className="campo file:mr-3 file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:text-white"
          />
        </div>
        <BotonEnviar variante="secundario">Revisar planilla</BotonEnviar>
      </form>

      {previa && !previa.ok && <Aviso tono="error">{previa.error}</Aviso>}

      {previa?.ok && (
        <div className="space-y-3">
          {previa.truncado && (
            <Aviso tono="alerta" titulo="La planilla es más larga de lo admitido">
              Se leyeron las primeras 2000 filas. Divide el archivo y sube el resto en una segunda carga.
            </Aviso>
          )}

          {previa.errores.length > 0 && (
            <Aviso tono="alerta" titulo={`${previa.errores.length} filas con problemas`}>
              <ul className="mt-1 space-y-0.5">
                {previa.errores.slice(0, 10).map((e) => (
                  <li key={e.fila}>
                    Fila {e.fila}: {e.detalle}
                  </li>
                ))}
              </ul>
              {previa.errores.length > 10 && <p className="mt-1">…y {previa.errores.length - 10} más.</p>}
              <p className="mt-2">Esas filas se omiten; las demás se pueden aplicar igual.</p>
            </Aviso>
          )}

          {previa.validas.length === 0 ? (
            <Aviso tono="error">Ninguna fila quedó utilizable. Corrige la planilla y vuelve a subirla.</Aviso>
          ) : (
            <>
              <p className="text-sm text-tinta-600">
                <strong>{nuevos}</strong> productos nuevos y <strong>{cambios}</strong> actualizaciones.
              </p>

              <div className="max-h-96 overflow-y-auto border border-tinta-200">
                <ContenedorTabla>
                  <thead>
                    <tr>
                      <th>Qué pasa</th>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th className="text-right">Mínimo</th>
                      <th className="text-right">Costo</th>
                      <th className="text-right">Stock inicial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.validas.map((v) => (
                      <tr key={v.sku}>
                        <td>
                          <Badge tono={v.accion === 'crear' ? 'verde' : 'azul'}>
                            {v.accion === 'crear' ? 'nuevo' : 'actualiza'}
                          </Badge>
                        </td>
                        <td className="dato text-xs">{v.sku}</td>
                        <td className="text-brand-900">{v.nombre}</td>
                        <td className="text-xs text-tinta-600">{v.categoria ?? '—'}</td>
                        <td className="text-right tabular-nums text-tinta-600">{v.stockMinimo}</td>
                        <td className="text-right tabular-nums text-tinta-600">{v.costo}</td>
                        <td className="text-right tabular-nums text-tinta-600">
                          {v.accion === 'actualizar' ? (
                            <span className="text-tinta-300" title="El stock de un producto existente no se reescribe">
                              —
                            </span>
                          ) : (
                            (v.stockInicial ?? 0)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ContenedorTabla>
              </div>

              <Aviso tono="info">
                En los productos que ya existen sólo se actualizan sus datos, nunca el stock: las existencias se
                corrigen con un conteo físico, que deja registro de la diferencia.
              </Aviso>

              <form action={aplicar} className="flex justify-end">
                <input type="hidden" name="carga" value={previa.carga} />
                <BotonEnviar>Aplicar {previa.validas.length} filas</BotonEnviar>
              </form>
            </>
          )}
        </div>
      )}

      {aplicado && !aplicado.ok && <Aviso tono="error">{aplicado.error}</Aviso>}
    </div>
  );
}
