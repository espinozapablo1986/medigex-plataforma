import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, humanizar, isoFecha } from '@/lib/format';
import {
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EnlaceBoton,
  EstadoVacio,
  Metrica,
  Paginador,
  Tarjeta,
} from '@/components/ui';

export const metadata = { title: 'Ventas' };

const POR_PAGINA = 30;

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; profesional?: string; pagina?: string }>;
}) {
  const sesion = await requerirPermiso('ventas', 'ver');
  const { desde, hasta, estado, profesional, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);

  // Por defecto, el mes en curso.
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : inicioMes;
  const fechaHasta = hasta ? new Date(`${hasta}T23:59:59`) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

  const where = {
    fecha: { gte: fechaDesde, lte: fechaHasta },
    ...(estado ? { estado: estado as never } : {}),
    ...(profesional ? { profesionalId: profesional } : {}),
  };

  const [ventas, total, agregado, profesionales] = await Promise.all([
    prisma.venta.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, rut: true } },
        profesional: { select: { nombres: true, apellidos: true } },
        convenio: { select: { nombre: true } },
        _count: { select: { items: true, pagos: true } },
      },
    }),
    prisma.venta.count({ where }),
    prisma.venta.aggregate({
      where: { ...where, estado: { not: 'ANULADA' } },
      _sum: { total: true, neto: true, iva: true, saldo: true, pagado: true },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (desde) filtros.set('desde', desde);
  if (hasta) filtros.set('hasta', hasta);
  if (estado) filtros.set('estado', estado);
  if (profesional) filtros.set('profesional', profesional);
  const base = `/ventas${filtros.toString() ? `?${filtros}` : ''}`;

  const facturado = agregado._sum.total ?? 0;
  const cobrado = agregado._sum.pagado ?? 0;
  const porCobrar = agregado._sum.saldo ?? 0;
  const ticketMedio = total > 0 ? Math.round(facturado / total) : 0;

  return (
    <>
      <EncabezadoPagina
        ayuda="ventas"
        titulo="Ventas"
        descripcion="Prestaciones y productos facturados a los pacientes."
        acciones={puede(sesion, 'ventas', 'crear') && <EnlaceBoton href="/ventas/nueva">Nueva venta</EnlaceBoton>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Facturado" valor={clp(facturado)} detalle={`${total} documentos`} />
        <Metrica etiqueta="Cobrado" valor={clp(cobrado)} tono="positivo" />
        <Metrica etiqueta="Por cobrar" valor={clp(porCobrar)} tono={porCobrar > 0 ? 'negativo' : 'neutro'} />
        <Metrica etiqueta="Ticket medio" valor={clp(ticketMedio)} tono="marca" />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde" className="w-40">
          <input name="desde" type="date" defaultValue={desde ?? isoFecha(fechaDesde)} className="campo" />
        </Campo>
        <Campo etiqueta="Hasta" className="w-40">
          <input name="hasta" type="date" defaultValue={hasta ?? isoFecha(fechaHasta)} className="campo" />
        </Campo>
        <Campo etiqueta="Estado" className="w-40">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Pago parcial</option>
            <option value="PAGADA">Pagada</option>
            <option value="ANULADA">Anulada</option>
          </select>
        </Campo>
        <Campo etiqueta="Profesional" className="w-52">
          <select name="profesional" defaultValue={profesional ?? ''} className="campo">
            <option value="">Todos</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellidos}, {p.nombres}
              </option>
            ))}
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {ventas.length === 0 ? (
        <EstadoVacio
          titulo="Sin ventas en el período"
          descripcion="Ajusta el rango de fechas o registra una nueva venta."
          accion={puede(sesion, 'ventas', 'crear') && <EnlaceBoton href="/ventas/nueva">Nueva venta</EnlaceBoton>}
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Profesional</th>
                <th>Documento</th>
                <th className="text-right">Neto</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Total</th>
                <th className="text-right">Saldo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className={v.estado === 'ANULADA' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-tinta-500">{v.folio}</td>
                  <td className="whitespace-nowrap text-tinta-600">{fechaCorta(v.fecha)}</td>
                  <td>
                    <Link href={`/pacientes/${v.paciente.id}`} className="font-medium text-brand-700 hover:underline">
                      {v.paciente.nombres} {v.paciente.apellidoPaterno}
                    </Link>
                    {v.convenio && <p className="text-xs text-brand-600">{v.convenio.nombre}</p>}
                  </td>
                  <td className="text-xs text-tinta-600">
                    {v.profesional ? `${v.profesional.nombres} ${v.profesional.apellidos}` : '—'}
                  </td>
                  <td className="text-xs text-tinta-600">
                    {humanizar(v.tipoDocumento)}
                    {v.numeroDocumento && <p className="text-tinta-400">{v.numeroDocumento}</p>}
                  </td>
                  <td className="text-right tabular-nums text-tinta-600">{clp(v.neto)}</td>
                  <td className="text-right tabular-nums text-tinta-500">{clp(v.iva)}</td>
                  <td className="text-right font-medium tabular-nums">{clp(v.total)}</td>
                  <td className="text-right tabular-nums">
                    {v.saldo > 0 ? <span className="text-rose-600">{clp(v.saldo)}</span> : clp(0)}
                  </td>
                  <td>
                    <BadgeEstado estado={v.estado} />
                  </td>
                  <td className="text-right">
                    <EnlaceBoton href={`/ventas/${v.id}`} variante="secundario" tamano="sm">
                      Ver
                    </EnlaceBoton>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
          <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} base={base} />
        </Tarjeta>
      )}
    </>
  );
}
