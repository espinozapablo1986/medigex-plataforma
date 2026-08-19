'use client';

import { useActionState } from 'react';

import { Aviso, ContenedorTabla } from '@/components/ui';
import { BotonEnviar } from '@/components/formulario';

import { aplicarConteo, previsualizarConteo } from '../../importar/acciones';

/**
 * Carga de un conteo desde planilla, en dos pasos.
 *
 * Primero se muestran las diferencias que traería el archivo, y sólo al
 * confirmar se guardan. Aplicar de una vez lo que trae un Excel es la forma
 * más rápida de descuadrar un inventario por una columna corrida.
 */
export function SubirConteo({ conteoId }: { conteoId: string }) {
  const [previa, previsualizar] = useActionState(previsualizarConteo, null);
  const [aplicado, aplicar] = useActionState(aplicarConteo, null);

  if (aplicado?.ok && aplicado.resumen) {
    return (
      <Aviso tono="exito" titulo="Planilla cargada">
        Se registraron {aplicado.resumen.lineas} cantidades. Revísalas en la hoja de abajo antes de cerrar el conteo.
      </Aviso>
    );
  }

  return (
    <div className="space-y-4">
      <form action={previsualizar} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="conteoId" value={conteoId} />
        <div className="min-w-[16rem] flex-1">
          <label className="etiqueta" htmlFor="archivo-conteo">
            Planilla con las cantidades
          </label>
          <input
            id="archivo-conteo"
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
          {previa.errores.length > 0 && (
            <Aviso tono="alerta" titulo={`${previa.errores.length} filas con problemas`}>
              <ul className="mt-1 space-y-0.5">
                {previa.errores.slice(0, 8).map((e) => (
                  <li key={e.fila}>
                    Fila {e.fila}: {e.detalle}
                  </li>
                ))}
              </ul>
              {previa.errores.length > 8 && <p className="mt-1">…y {previa.errores.length - 8} más.</p>}
              <p className="mt-2">Esas filas se omiten. El resto se puede cargar igual.</p>
            </Aviso>
          )}

          {previa.validas.length === 0 ? (
            <Aviso tono="error">Ninguna fila se pudo leer. Corrige la planilla y vuelve a subirla.</Aviso>
          ) : (
            <>
              <p className="text-sm text-tinta-600">
                {previa.validas.length} cantidades listas para cargar ·{' '}
                {previa.validas.filter((v) => v.diferencia !== 0).length} con diferencia respecto al sistema.
              </p>

              <div className="max-h-80 overflow-y-auto border border-tinta-200">
                <ContenedorTabla>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="text-right">Sistema</th>
                      <th className="text-right">Contado</th>
                      <th className="text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.validas.map((v) => (
                      <tr key={v.itemId}>
                        <td>
                          <p className="font-medium text-brand-900">{v.nombre}</p>
                          <p className="dato text-xs">{v.sku}</p>
                        </td>
                        <td className="text-right tabular-nums text-tinta-500">{v.stockTeorico}</td>
                        <td className="text-right tabular-nums">{v.contado}</td>
                        <td
                          className={`text-right font-medium tabular-nums ${
                            v.diferencia === 0 ? 'text-tinta-400' : v.diferencia > 0 ? 'text-exito' : 'text-error'
                          }`}
                        >
                          {v.diferencia > 0 ? `+${v.diferencia}` : v.diferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ContenedorTabla>
              </div>

              <form action={aplicar} className="flex justify-end">
                <input type="hidden" name="conteoId" value={conteoId} />
                <input type="hidden" name="carga" value={previa.carga} />
                <BotonEnviar>Cargar {previa.validas.length} cantidades</BotonEnviar>
              </form>

              <p className="text-xs text-tinta-500">
                Esto sólo llena la hoja de conteo. El stock no cambia hasta que alguien con permiso cierre el conteo.
              </p>
            </>
          )}
        </div>
      )}

      {aplicado && !aplicado.ok && <Aviso tono="error">{aplicado.error}</Aviso>}
    </div>
  );
}
