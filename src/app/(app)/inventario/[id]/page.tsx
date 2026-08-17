import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, fechaHora, humanizar, numero } from '@/lib/format';
import {
  Badge,
  ContenedorTabla,
  Definicion,
  EncabezadoPagina,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';

const TONOS: Record<string, 'verde' | 'rojo' | 'ambar' | 'gris' | 'azul'> = {
  ENTRADA: 'verde',
  INVENTARIO_INICIAL: 'verde',
  DEVOLUCION: 'verde',
  SALIDA: 'rojo',
  VENTA: 'rojo',
  CONSUMO_SERVICIO: 'ambar',
  MERMA: 'rojo',
  AJUSTE: 'azul',
};

export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requerirPermiso('inventario', 'ver');

  const producto = await prisma.producto.findUnique({
    where: { id },
    include: {
      categoria: true,
      proveedor: true,
      insumoDe: { include: { servicio: { select: { id: true, nombre: true, codigo: true } } } },
      movimientos: {
        orderBy: { fecha: 'desc' },
        take: 100,
        include: { usuario: { select: { nombres: true, apellidos: true } } },
      },
    },
  });
  if (!producto) notFound();

  const entradas = producto.movimientos
    .filter((m) => ['ENTRADA', 'DEVOLUCION', 'INVENTARIO_INICIAL'].includes(m.tipo))
    .reduce((acc, m) => acc + m.cantidad, 0);
  const salidas = producto.movimientos
    .filter((m) => ['SALIDA', 'VENTA', 'CONSUMO_SERVICIO', 'MERMA'].includes(m.tipo))
    .reduce((acc, m) => acc + m.cantidad, 0);

  const critico = producto.stockMinimo > 0 && producto.stockActual <= producto.stockMinimo;

  return (
    <>
      <EncabezadoPagina
        titulo={producto.nombre}
        descripcion={`SKU ${producto.sku}${producto.categoria ? ` · ${producto.categoria.nombre}` : ''}`}
        volver={{ href: '/inventario', texto: 'Inventario' }}
        acciones={
          <div className="flex gap-1.5">
            {critico && <Badge tono="ambar">bajo stock mínimo</Badge>}
            {producto.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Stock actual"
          valor={`${numero(producto.stockActual, 2)} ${humanizar(producto.unidadMedida).toLowerCase()}`}
          tono={producto.stockActual < 0 ? 'negativo' : critico ? 'alerta' : 'positivo'}
        />
        <Metrica etiqueta="Costo promedio" valor={clp(producto.costoPromedio)} />
        <Metrica
          etiqueta="Valorizado"
          valor={clp(Math.round(producto.stockActual * producto.costoPromedio))}
        />
        <Metrica
          etiqueta="Movimiento (últimos 100)"
          valor={`+${numero(entradas, 0)} / −${numero(salidas, 0)}`}
          detalle="entradas / salidas"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta titulo="Cartola de movimientos" sinPadding>
            {producto.movimientos.length === 0 ? (
              <div className="p-4">
                <EstadoVacio titulo="Sin movimientos" descripcion="Aún no se registran entradas ni salidas." />
              </div>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Stock antes</th>
                    <th className="text-right">Stock después</th>
                    <th className="text-right">Costo unit.</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {producto.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs text-slate-600">{fechaHora(m.fecha)}</td>
                      <td>
                        <Badge tono={TONOS[m.tipo] ?? 'gris'}>{humanizar(m.tipo)}</Badge>
                      </td>
                      <td className="text-right font-medium tabular-nums">{numero(m.cantidad, 2)}</td>
                      <td className="text-right tabular-nums text-slate-500">{numero(m.stockAnterior, 2)}</td>
                      <td className="text-right tabular-nums text-slate-700">{numero(m.stockResultante, 2)}</td>
                      <td className="text-right tabular-nums text-slate-500">{clp(m.costoUnitario)}</td>
                      <td className="text-xs text-slate-500">
                        {m.motivo ?? '—'}
                        {m.lote && <p>Lote {m.lote}</p>}
                        {m.fechaVencimiento && <p>Vence {fechaCorta(m.fechaVencimiento)}</p>}
                      </td>
                      <td className="text-xs text-slate-500">
                        {m.usuario ? `${m.usuario.nombres} ${m.usuario.apellidos}` : 'sistema'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta titulo="Ficha del producto">
            <dl className="space-y-3">
              <Definicion termino="SKU">{producto.sku}</Definicion>
              <Definicion termino="Descripción">{producto.descripcion}</Definicion>
              <Definicion termino="Categoría">{producto.categoria?.nombre}</Definicion>
              <Definicion termino="Proveedor habitual">{producto.proveedor?.razonSocial}</Definicion>
              <Definicion termino="Unidad">{humanizar(producto.unidadMedida)}</Definicion>
              <Definicion termino="Ubicación">{producto.ubicacion}</Definicion>
              <Definicion termino="Stock mínimo">{numero(producto.stockMinimo, 2)}</Definicion>
              <Definicion termino="Stock máximo">{numero(producto.stockMaximo, 2)}</Definicion>
              <Definicion termino="Precio de venta">
                {producto.esVendible ? clp(producto.precioVenta) : 'No se vende directamente'}
              </Definicion>
              <Definicion termino="IVA">{producto.afectoIva ? 'Afecto' : 'Exento'}</Definicion>
              <Definicion termino="Control de lote">{producto.controlaLote ? 'Sí' : 'No'}</Definicion>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Servicios que lo consumen">
            {producto.insumoDe.length === 0 ? (
              <p className="text-sm text-slate-500">
                No está asociado a ningún servicio. Puedes asociarlo desde la ficha del servicio.
              </p>
            ) : (
              <ul className="space-y-2">
                {producto.insumoDe.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/servicios/${i.servicio.id}`} className="text-brand-700 hover:underline">
                      {i.servicio.nombre}
                    </Link>
                    <span className="tabular-nums text-slate-500">{numero(i.cantidad, 2)} por vez</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
