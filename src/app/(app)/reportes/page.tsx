import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, humanizar, isoFecha, numero, porcentaje } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { GraficoBarrasHorizontal, GraficoTorta } from '@/components/graficos';

export const metadata = { title: 'Reportes' };

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requerirPermiso('reportes', 'ver');
  const { desde, hasta } = await searchParams;

  const hoy = new Date();
  const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fechaHasta = hasta
    ? new Date(`${hasta}T23:59:59`)
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

  const rangoVenta = { fecha: { gte: fechaDesde, lte: fechaHasta }, estado: { not: 'ANULADA' as const } };

  const [
    ventas,
    itemsVenta,
    servicios,
    profesionales,
    categorias,
    citas,
    pacientesNuevos,
    porFormaPago,
    formasPago,
    boxes,
    pacientesDerivados,
  ] = await Promise.all([
    prisma.venta.aggregate({ where: rangoVenta, _sum: { total: true, neto: true, iva: true }, _count: true }),
    prisma.ventaItem.findMany({
      where: { venta: rangoVenta },
      include: {
        servicio: { select: { id: true, nombre: true, categoriaId: true } },
        producto: { select: { id: true, nombre: true } },
        profesional: { select: { id: true, nombres: true, apellidos: true, especialidad: true } },
      },
    }),
    prisma.servicio.findMany({ select: { id: true, nombre: true, categoriaId: true, precio: true } }),
    prisma.profesional.findMany({
      where: { activo: true },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
    prisma.categoriaServicio.findMany({ select: { id: true, nombre: true } }),
    prisma.cita.groupBy({
      by: ['estado'],
      where: { inicio: { gte: fechaDesde, lte: fechaHasta } },
      _count: true,
    }),
    prisma.paciente.count({ where: { createdAt: { gte: fechaDesde, lte: fechaHasta } } }),
    prisma.pago.groupBy({
      by: ['formaPagoId'],
      where: { fecha: { gte: fechaDesde, lte: fechaHasta }, estado: 'CONFIRMADO' },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.formaPago.findMany({ select: { id: true, nombre: true } }),
    prisma.cita.groupBy({
      by: ['boxId'],
      where: { inicio: { gte: fechaDesde, lte: fechaHasta }, estado: { notIn: ['CANCELADA', 'NO_ASISTIO'] } },
      _count: true,
    }),
    prisma.paciente.count({
      where: { createdAt: { gte: fechaDesde, lte: fechaHasta }, vieneDeOtroCentro: true },
    }),
  ]);

  const totalVendido = ventas._sum.total ?? 0;
  const ticketMedio = ventas._count > 0 ? Math.round(totalVendido / ventas._count) : 0;

  // ── Servicios más vendidos ──
  const porServicio = new Map<string, { nombre: string; cantidad: number; monto: number }>();
  for (const item of itemsVenta) {
    if (item.tipo !== 'SERVICIO') continue;
    const clave = item.servicioId ?? item.descripcion;
    const previo = porServicio.get(clave) ?? { nombre: item.servicio?.nombre ?? item.descripcion, cantidad: 0, monto: 0 };
    porServicio.set(clave, {
      nombre: previo.nombre,
      cantidad: previo.cantidad + item.cantidad,
      monto: previo.monto + item.total,
    });
  }
  const rankingServicios = [...porServicio.values()].sort((a, b) => b.monto - a.monto);

  // ── Productos más vendidos ──
  const porProducto = new Map<string, { nombre: string; cantidad: number; monto: number }>();
  for (const item of itemsVenta) {
    if (item.tipo !== 'PRODUCTO') continue;
    const clave = item.productoId ?? item.descripcion;
    const previo = porProducto.get(clave) ?? { nombre: item.producto?.nombre ?? item.descripcion, cantidad: 0, monto: 0 };
    porProducto.set(clave, {
      nombre: previo.nombre,
      cantidad: previo.cantidad + item.cantidad,
      monto: previo.monto + item.total,
    });
  }
  const rankingProductos = [...porProducto.values()].sort((a, b) => b.monto - a.monto);

  // ── Ranking de profesionales ──
  const porProfesional = new Map<
    string,
    { nombre: string; especialidad: string; prestaciones: number; monto: number; comision: number }
  >();
  for (const item of itemsVenta) {
    if (!item.profesionalId || !item.profesional) continue;
    const previo = porProfesional.get(item.profesionalId) ?? {
      nombre: `${item.profesional.apellidos}, ${item.profesional.nombres}`,
      especialidad: item.profesional.especialidad,
      prestaciones: 0,
      monto: 0,
      comision: 0,
    };
    porProfesional.set(item.profesionalId, {
      ...previo,
      prestaciones: previo.prestaciones + 1,
      monto: previo.monto + item.total,
      comision: previo.comision + item.comisionMonto,
    });
  }
  const rankingProfesionales = [...porProfesional.values()].sort((a, b) => b.monto - a.monto);

  // ── Ventas por categoría de servicio ──
  const porCategoria = new Map<string, number>();
  for (const item of itemsVenta) {
    if (item.tipo !== 'SERVICIO') continue;
    const categoriaId = item.servicio?.categoriaId ?? null;
    const nombre = categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Sin categoría';
    porCategoria.set(nombre, (porCategoria.get(nombre) ?? 0) + item.total);
  }
  const datosCategoria = [...porCategoria.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);

  // ── Ocupación de boxes ──
  const boxesInfo = await prisma.box.findMany({ select: { id: true, codigo: true, nombre: true, tipo: true } });
  const ocupacionBoxes = boxes
    .map((b) => ({
      nombre: boxesInfo.find((x) => x.id === b.boxId)?.codigo ?? 'Sin box',
      valor: b._count,
    }))
    .sort((a, b) => b.valor - a.valor);

  // ── Estados de citas ──
  const totalCitas = citas.reduce((acc, c) => acc + c._count, 0);
  const noAsistio = citas.find((c) => c.estado === 'NO_ASISTIO')?._count ?? 0;
  const canceladas = citas.find((c) => c.estado === 'CANCELADA')?._count ?? 0;
  const tasaInasistencia = totalCitas > 0 ? Math.round(((noAsistio + canceladas) / totalCitas) * 100) : 0;

  const nombreForma = (id: string) => formasPago.find((f) => f.id === id)?.nombre ?? 'Otra';

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion={`Período del ${fechaCorta(fechaDesde)} al ${fechaCorta(fechaHasta)}`}
      />

      <form className="mb-5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde" className="w-40">
          <input name="desde" type="date" defaultValue={isoFecha(fechaDesde)} className="campo" />
        </Campo>
        <Campo etiqueta="Hasta" className="w-40">
          <input name="hasta" type="date" defaultValue={isoFecha(fechaHasta)} className="campo" />
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Aplicar
        </button>
      </form>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Total vendido" valor={clp(totalVendido)} detalle={`${ventas._count} ventas`} tono="positivo" />
        <Metrica etiqueta="Ticket medio" valor={clp(ticketMedio)} tono="marca" />
        <Metrica etiqueta="Pacientes nuevos" valor={String(pacientesNuevos)} detalle={`${pacientesDerivados} derivados de otro centro`} />
        <Metrica
          etiqueta="Inasistencias"
          valor={`${tasaInasistencia}%`}
          detalle={`${noAsistio} no asistió · ${canceladas} canceladas`}
          tono={tasaInasistencia > 15 ? 'negativo' : 'neutro'}
        />
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta titulo="Servicios más vendidos" descripcion="Por monto facturado en el período">
            <GraficoBarrasHorizontal datos={rankingServicios.slice(0, 10).map((s) => ({ nombre: s.nombre, valor: s.monto }))} />
          </Tarjeta>

          <Tarjeta titulo="Ventas por categoría de servicio">
            <GraficoTorta datos={datosCategoria.slice(0, 8)} />
          </Tarjeta>
        </div>

        <Tarjeta titulo="Detalle de servicios vendidos" sinPadding>
          {rankingServicios.length === 0 ? (
            <div className="p-4">
              <EstadoVacio titulo="Sin ventas de servicios en el período" />
            </div>
          ) : (
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Servicio</th>
                  <th className="text-right">Veces realizado</th>
                  <th className="text-right">Total facturado</th>
                  <th className="text-right">Ticket medio</th>
                  <th className="text-right">% del total</th>
                </tr>
              </thead>
              <tbody>
                {rankingServicios.map((s, i) => (
                  <tr key={s.nombre}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-800">{s.nombre}</td>
                    <td className="text-right tabular-nums">{numero(s.cantidad, 0)}</td>
                    <td className="text-right font-medium tabular-nums">{clp(s.monto)}</td>
                    <td className="text-right tabular-nums text-slate-600">
                      {clp(s.cantidad > 0 ? Math.round(s.monto / s.cantidad) : 0)}
                    </td>
                    <td className="text-right tabular-nums text-slate-500">
                      {totalVendido > 0 ? porcentaje((s.monto / totalVendido) * 100, 1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
        </Tarjeta>

        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta titulo="Ranking de profesionales" descripcion="Por monto producido">
            <GraficoBarrasHorizontal
              datos={rankingProfesionales.slice(0, 10).map((p) => ({ nombre: p.nombre, valor: p.monto }))}
              color="#8b5cf6"
            />
          </Tarjeta>

          <Tarjeta titulo="Ocupación de boxes" descripcion="Citas realizadas por box">
            <GraficoBarrasHorizontal datos={ocupacionBoxes.slice(0, 10)} color="#06b6d4" formatoMoneda={false} />
          </Tarjeta>
        </div>

        <Tarjeta titulo="Producción por profesional" sinPadding>
          {rankingProfesionales.length === 0 ? (
            <div className="p-4">
              <EstadoVacio titulo="Sin prestaciones asignadas a profesionales en el período" />
            </div>
          ) : (
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Profesional</th>
                  <th>Especialidad</th>
                  <th className="text-right">Prestaciones</th>
                  <th className="text-right">Producido</th>
                  <th className="text-right">Ticket medio</th>
                  <th className="text-right">Honorarios</th>
                  <th className="text-right">Margen del centro</th>
                </tr>
              </thead>
              <tbody>
                {rankingProfesionales.map((p, i) => (
                  <tr key={p.nombre}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-800">{p.nombre}</td>
                    <td className="text-xs text-slate-600">{p.especialidad}</td>
                    <td className="text-right tabular-nums">{p.prestaciones}</td>
                    <td className="text-right font-medium tabular-nums">{clp(p.monto)}</td>
                    <td className="text-right tabular-nums text-slate-600">
                      {clp(p.prestaciones > 0 ? Math.round(p.monto / p.prestaciones) : 0)}
                    </td>
                    <td className="text-right tabular-nums text-amber-600">{clp(p.comision)}</td>
                    <td className="text-right tabular-nums text-emerald-600">{clp(p.monto - p.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
        </Tarjeta>

        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta titulo="Recaudación por forma de pago" sinPadding>
            {porFormaPago.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin pagos en el período.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Forma de pago</th>
                    <th className="text-right">Operaciones</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {porFormaPago
                    .sort((a, b) => (b._sum.monto ?? 0) - (a._sum.monto ?? 0))
                    .map((f) => (
                      <tr key={f.formaPagoId}>
                        <td className="font-medium text-slate-800">{nombreForma(f.formaPagoId)}</td>
                        <td className="text-right tabular-nums text-slate-600">{f._count}</td>
                        <td className="text-right font-medium tabular-nums">{clp(f._sum.monto ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>

          <Tarjeta titulo="Estados de la agenda" sinPadding>
            {citas.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin citas en el período.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th className="text-right">Citas</th>
                    <th className="text-right">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {citas
                    .sort((a, b) => b._count - a._count)
                    .map((c) => (
                      <tr key={c.estado}>
                        <td>
                          <Badge tono="gris">{humanizar(c.estado)}</Badge>
                        </td>
                        <td className="text-right tabular-nums">{c._count}</td>
                        <td className="text-right tabular-nums text-slate-500">
                          {porcentaje((c._count / totalCitas) * 100, 1)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>
        </div>

        {rankingProductos.length > 0 && (
          <Tarjeta titulo="Productos más vendidos" sinPadding>
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Total facturado</th>
                </tr>
              </thead>
              <tbody>
                {rankingProductos.map((p, i) => (
                  <tr key={p.nombre}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-800">{p.nombre}</td>
                    <td className="text-right tabular-nums">{numero(p.cantidad, 0)}</td>
                    <td className="text-right font-medium tabular-nums">{clp(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
