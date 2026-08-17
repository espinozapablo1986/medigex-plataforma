import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, humanizar, numero } from '@/lib/format';
import {
  Aviso,
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import {
  alternarActivoProducto,
  crearCategoriaProducto,
  crearProducto,
  editarProducto,
  eliminarProducto,
  registrarMovimiento,
} from './acciones';

export const metadata = { title: 'Inventario' };

const UNIDADES = [
  { valor: 'UNIDAD', texto: 'Unidad' },
  { valor: 'CAJA', texto: 'Caja' },
  { valor: 'PAQUETE', texto: 'Paquete' },
  { valor: 'ML', texto: 'Mililitro' },
  { valor: 'LITRO', texto: 'Litro' },
  { valor: 'GRAMO', texto: 'Gramo' },
  { valor: 'KILO', texto: 'Kilo' },
  { valor: 'METRO', texto: 'Metro' },
  { valor: 'PAR', texto: 'Par' },
  { valor: 'SET', texto: 'Set' },
];

export default async function PaginaInventario({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; alerta?: string; inactivos?: string }>;
}) {
  const sesion = await requerirPermiso('inventario', 'ver');
  const { q, categoria, alerta, inactivos } = await searchParams;

  const [productos, categorias, proveedores] = await Promise.all([
    prisma.producto.findMany({
      where: {
        ...(inactivos === '1' ? {} : { activo: true }),
        ...(categoria ? { categoriaId: categoria } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' as const } },
                { sku: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: {
        categoria: { select: { nombre: true } },
        proveedor: { select: { razonSocial: true } },
        _count: { select: { insumoDe: true } },
      },
    }),
    prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: 'asc' } }),
  ]);

  const bajoStock = productos.filter((p) => p.stockActual <= p.stockMinimo && p.stockMinimo > 0);
  const negativos = productos.filter((p) => p.stockActual < 0);
  const visibles = alerta === '1' ? bajoStock : productos;

  const valorInventario = productos.reduce((acc, p) => acc + Math.round(p.stockActual * p.costoPromedio), 0);

  const puedeCrear = puede(sesion, 'inventario', 'crear');
  const puedeEditar = puede(sesion, 'inventario', 'editar');
  const puedeEliminar = puede(sesion, 'inventario', 'eliminar');

  const camposProducto = (p?: (typeof productos)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="SKU" requerido>
          <input name="sku" defaultValue={p?.sku} required className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={p?.nombre} required className="campo" />
        </Campo>
        <Campo etiqueta="Categoría">
          <select name="categoriaId" defaultValue={p?.categoriaId ?? ''} className="campo">
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Proveedor habitual">
          <select name="proveedorId" defaultValue={p?.proveedorId ?? ''} className="campo">
            <option value="">Sin proveedor</option>
            {proveedores.map((prov) => (
              <option key={prov.id} value={prov.id}>
                {prov.razonSocial}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Unidad de medida">
          <select name="unidadMedida" defaultValue={p?.unidadMedida ?? 'UNIDAD'} className="campo">
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ubicación en bodega">
          <input name="ubicacion" defaultValue={p?.ubicacion ?? ''} placeholder="Estante A2" className="campo" />
        </Campo>
        <Campo etiqueta="Stock mínimo" ayuda="Genera alerta cuando el stock baja de este valor.">
          <input name="stockMinimo" type="number" min={0} step={0.01} defaultValue={p?.stockMinimo ?? 0} className="campo" />
        </Campo>
        <Campo etiqueta="Stock máximo">
          <input name="stockMaximo" type="number" min={0} step={0.01} defaultValue={p?.stockMaximo ?? 0} className="campo" />
        </Campo>
        <Campo etiqueta="Precio de venta (CLP)">
          <input name="precioVenta" type="number" min={0} step={100} defaultValue={p?.precioVenta ?? 0} className="campo" />
        </Campo>
        {!p && (
          <>
            <Campo etiqueta="Stock inicial">
              <input name="stockInicial" type="number" min={0} step={0.01} defaultValue={0} className="campo" />
            </Campo>
            <Campo etiqueta="Costo unitario inicial (CLP)">
              <input name="costoPromedio" type="number" min={0} step={1} defaultValue={0} className="campo" />
            </Campo>
          </>
        )}
      </Grilla>

      <Campo etiqueta="Descripción" className="mt-4">
        <textarea name="descripcion" rows={2} defaultValue={p?.descripcion ?? ''} className="campo" />
      </Campo>

      <fieldset className="mt-4 space-y-2">
        <legend className="etiqueta">Opciones</legend>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input type="checkbox" name="esInsumo" defaultChecked={p?.esInsumo ?? true} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Es insumo clínico (se puede asociar a servicios y se descuenta al atender)
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input type="checkbox" name="esVendible" defaultChecked={p?.esVendible ?? false} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Se puede vender directamente al paciente
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input type="checkbox" name="afectoIva" defaultChecked={p?.afectoIva ?? true} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Afecto a IVA
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input type="checkbox" name="controlaLote" defaultChecked={p?.controlaLote ?? false} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Controla lote y fecha de vencimiento
        </label>
      </fieldset>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Consumibles e insumos clínicos, con control de stock y movimientos."
        acciones={
          puedeCrear && (
            <>
              <Modal titulo="Nueva categoría" etiquetaBoton="Nueva categoría" varianteBoton="secundario" ancho="max-w-md">
                <Formulario accion={crearCategoriaProducto} className="space-y-4" reiniciarAlEnviar>
                  <Campo etiqueta="Nombre" requerido>
                    <input name="nombre" required className="campo" placeholder="Ej: Material de obturación" />
                  </Campo>
                  <Campo etiqueta="Descripción">
                    <input name="descripcion" className="campo" />
                  </Campo>
                  <div className="flex justify-end">
                    <BotonEnviar>Crear categoría</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>

              <Modal titulo="Nuevo producto" etiquetaBoton="Nuevo producto">
                <Formulario accion={crearProducto} className="space-y-4">
                  {camposProducto()}
                  <div className="flex justify-end">
                    <BotonEnviar>Crear producto</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            </>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Productos activos" valor={String(productos.filter((p) => p.activo).length)} />
        <Metrica etiqueta="Valor del inventario" valor={clp(valorInventario)} detalle="Stock × costo promedio" />
        <Metrica
          etiqueta="Bajo stock mínimo"
          valor={String(bajoStock.length)}
          tono={bajoStock.length > 0 ? 'alerta' : 'positivo'}
        />
        <Metrica
          etiqueta="Con stock negativo"
          valor={String(negativos.length)}
          tono={negativos.length > 0 ? 'negativo' : 'positivo'}
          detalle={negativos.length > 0 ? 'Regularizar con un ajuste' : undefined}
        />
      </div>

      {negativos.length > 0 && (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="Hay productos con stock negativo">
            Se consumieron insumos sin stock registrado en el sistema:{' '}
            {negativos.map((p) => p.nombre).join(', ')}. Regulariza con un movimiento de tipo «Ajuste».
          </Aviso>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" className="w-56">
          <input name="q" defaultValue={q ?? ''} placeholder="Nombre o SKU" className="campo" />
        </Campo>
        <Campo etiqueta="Categoría" className="w-52">
          <select name="categoria" defaultValue={categoria ?? ''} className="campo">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex h-10 items-center gap-2 text-sm text-tinta-600">
          <input type="checkbox" name="alerta" value="1" defaultChecked={alerta === '1'} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Sólo bajo stock
        </label>
        <label className="flex h-10 items-center gap-2 text-sm text-tinta-600">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={inactivos === '1'} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Incluir inactivos
        </label>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {visibles.length === 0 ? (
        <EstadoVacio
          titulo="Sin productos"
          descripcion="Carga tus insumos y consumibles para llevar control de stock y costos."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right">Costo prom.</th>
                <th className="text-right">Valorizado</th>
                <th>Marcas</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const critico = p.stockMinimo > 0 && p.stockActual <= p.stockMinimo;
                return (
                  <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                    <td className="font-mono text-xs text-tinta-500">{p.sku}</td>
                    <td>
                      <Link href={`/inventario/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.nombre}
                      </Link>
                      {p.ubicacion && <p className="text-xs text-tinta-400">{p.ubicacion}</p>}
                    </td>
                    <td className="text-xs text-tinta-600">{p.categoria?.nombre ?? '—'}</td>
                    <td className="text-right font-medium tabular-nums">
                      <span className={p.stockActual < 0 ? 'text-rose-600' : critico ? 'text-amber-600' : ''}>
                        {numero(p.stockActual, p.stockActual % 1 === 0 ? 0 : 2)}
                      </span>
                      <span className="ml-1 text-xs text-tinta-400">{humanizar(p.unidadMedida).toLowerCase()}</span>
                    </td>
                    <td className="text-right tabular-nums text-tinta-500">{numero(p.stockMinimo, 0)}</td>
                    <td className="text-right tabular-nums text-tinta-600">{clp(p.costoPromedio)}</td>
                    <td className="text-right tabular-nums text-tinta-700">
                      {clp(Math.round(p.stockActual * p.costoPromedio))}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {critico && <Badge tono="ambar">bajo stock</Badge>}
                        {p.esVendible && <Badge tono="verde">vendible</Badge>}
                        {p._count.insumoDe > 0 && <Badge tono="azul">{p._count.insumoDe} servicio(s)</Badge>}
                        {!p.activo && <Badge tono="rojo">inactivo</Badge>}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {puedeEditar && (
                          <>
                            <Modal
                              titulo={`Movimiento de stock — ${p.nombre}`}
                              etiquetaBoton="Movimiento"
                              tamanoBoton="sm"
                              ancho="max-w-lg"
                            >
                              <Formulario accion={registrarMovimiento} className="space-y-4">
                                <input type="hidden" name="productoId" value={p.id} />
                                <div className="rounded-lg bg-tinta-50 px-3 py-2 text-sm">
                                  Stock actual: <strong>{numero(p.stockActual, 2)}</strong>{' '}
                                  {humanizar(p.unidadMedida).toLowerCase()}
                                </div>
                                <Grilla cols={2}>
                                  <Campo etiqueta="Tipo" requerido>
                                    <select name="tipo" required className="campo">
                                      <option value="ENTRADA">Entrada (compra)</option>
                                      <option value="SALIDA">Salida</option>
                                      <option value="MERMA">Merma / pérdida</option>
                                      <option value="DEVOLUCION">Devolución a bodega</option>
                                      <option value="AJUSTE">Ajuste (dejar stock en…)</option>
                                    </select>
                                  </Campo>
                                  <Campo etiqueta="Cantidad" requerido>
                                    <input name="cantidad" type="number" step={0.01} required className="campo" />
                                  </Campo>
                                  <Campo etiqueta="Costo unitario (CLP)" ayuda="Sólo en entradas; recalcula el costo promedio.">
                                    <input name="costoUnitario" type="number" min={0} step={1} className="campo" />
                                  </Campo>
                                  {p.controlaLote && (
                                    <>
                                      <Campo etiqueta="Lote">
                                        <input name="lote" className="campo" />
                                      </Campo>
                                      <Campo etiqueta="Fecha de vencimiento">
                                        <input name="fechaVencimiento" type="date" className="campo" />
                                      </Campo>
                                    </>
                                  )}
                                </Grilla>
                                <Campo etiqueta="Motivo">
                                  <input name="motivo" className="campo" placeholder="Compra a proveedor, ajuste de inventario…" />
                                </Campo>
                                <div className="flex justify-end">
                                  <BotonEnviar>Registrar movimiento</BotonEnviar>
                                </div>
                              </Formulario>
                            </Modal>

                            <Modal
                              titulo={`Editar ${p.nombre}`}
                              etiquetaBoton="Editar"
                              varianteBoton="secundario"
                              tamanoBoton="sm"
                            >
                              <Formulario accion={editarProducto} className="space-y-4">
                                <input type="hidden" name="id" value={p.id} />
                                {camposProducto(p)}
                                <div className="flex justify-end">
                                  <BotonEnviar>Guardar</BotonEnviar>
                                </div>
                              </Formulario>
                            </Modal>

                            <BotonEliminar
                              accion={alternarActivoProducto}
                              id={p.id}
                              texto={p.activo ? 'Desactivar' : 'Activar'}
                              mensaje={`¿Confirmas ${p.activo ? 'desactivar' : 'activar'} "${p.nombre}"?`}
                            />
                          </>
                        )}
                        {puedeEliminar && <BotonEliminar accion={eliminarProducto} id={p.id} variante="peligro" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
