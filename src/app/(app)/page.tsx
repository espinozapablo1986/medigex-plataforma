import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirSesion } from '@/lib/auth';
import { finDelDia, inicioDelDia } from '@/lib/agenda';
import { clp, fechaCorta, hora, humanizar, numero } from '@/lib/format';
import {
  Aviso,
  Badge,
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EnlaceBoton,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { GraficoIngresosGastos, GraficoTorta } from '@/components/graficos';

export const metadata = { title: 'Dashboard' };

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}) {
  const sesion = await requerirSesion();
  const { mes: mesTexto, anio: anioTexto } = await searchParams;

  const hoy = new Date();
  const mes = mesTexto ? parseInt(mesTexto, 10) : hoy.getMonth();
  const anio = anioTexto ? parseInt(anioTexto, 10) : hoy.getFullYear();

  const inicioMes = new Date(anio, mes, 1);
  const finMes = new Date(anio, mes + 1, 0, 23, 59, 59, 999);

  const verFinanzas = puede(sesion, 'dashboard', 'ver');
  const verAgenda = puede(sesion, 'agenda', 'ver');

  // ── Agenda de hoy ──
  const desdeHoy = inicioDelDia(hoy);
  const hastaHoy = finDelDia(hoy);

  const [citasHoy, ventasMes, gastosMes, pagosMes, saldosPendientes, stockCritico, ultimos6Meses] = await Promise.all([
    verAgenda
      ? prisma.cita.findMany({
          where: {
            inicio: { gte: desdeHoy, lte: hastaHoy },
            ...(sesion.profesionalId && sesion.rolSlug === 'profesional'
              ? { profesionalId: sesion.profesionalId }
              : {}),
          },
          orderBy: { inicio: 'asc' },
          include: {
            paciente: { select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true } },
            profesional: { select: { nombres: true, apellidos: true, colorAgenda: true } },
            servicios: { orderBy: { orden: 'asc' }, include: { servicio: { select: { nombre: true } } } },
            box: { select: { codigo: true } },
          },
        })
      : Promise.resolve([]),

    prisma.venta.aggregate({
      where: { fecha: { gte: inicioMes, lte: finMes }, estado: { not: 'ANULADA' } },
      _sum: { total: true, neto: true, iva: true, saldo: true },
      _count: true,
    }),

    prisma.gasto.aggregate({
      where: { fecha: { gte: inicioMes, lte: finMes }, estado: { not: 'ANULADO' } },
      _sum: { total: true, neto: true, iva: true },
      _count: true,
    }),

    prisma.pago.aggregate({
      where: { fecha: { gte: inicioMes, lte: finMes }, estado: 'CONFIRMADO' },
      _sum: { monto: true },
    }),

    prisma.venta.aggregate({
      where: { saldo: { gt: 0 }, estado: { notIn: ['ANULADA', 'PAGADA'] } },
      _sum: { saldo: true },
      _count: true,
    }),

    prisma.producto.findMany({
      where: { activo: true, stockMinimo: { gt: 0 } },
      select: { id: true, nombre: true, sku: true, stockActual: true, stockMinimo: true, unidadMedida: true },
    }),

    // Serie de los últimos 6 meses para el gráfico
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(anio, mes - (5 - i), 1);
        const desde = new Date(d.getFullYear(), d.getMonth(), 1);
        const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        return Promise.all([
          prisma.venta.aggregate({
            where: { fecha: { gte: desde, lte: hasta }, estado: { not: 'ANULADA' } },
            _sum: { total: true },
          }),
          prisma.gasto.aggregate({
            where: { fecha: { gte: desde, lte: hasta }, estado: { not: 'ANULADO' } },
            _sum: { total: true },
          }),
        ]).then(([v, g]) => ({
          periodo: `${MESES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
          ingresos: v._sum.total ?? 0,
          gastos: g._sum.total ?? 0,
          resultado: (v._sum.total ?? 0) - (g._sum.total ?? 0),
        }));
      }),
    ),
  ]);

  const ingresos = ventasMes._sum.total ?? 0;
  const gastos = gastosMes._sum.total ?? 0;
  const ivaDebito = ventasMes._sum.iva ?? 0;
  const ivaCredito = gastosMes._sum.iva ?? 0;
  const ivaAPagar = ivaDebito - ivaCredito;
  const resultado = ingresos - gastos;

  const bajoStock = stockCritico.filter((p) => p.stockActual <= p.stockMinimo);

  // Distribución de gastos por categoría, para el gráfico de torta.
  const gastosPorCategoria = verFinanzas
    ? await prisma.gasto.groupBy({
        by: ['categoriaId'],
        where: { fecha: { gte: inicioMes, lte: finMes }, estado: { not: 'ANULADO' } },
        _sum: { total: true },
      })
    : [];

  const categorias = await prisma.categoriaGasto.findMany({ select: { id: true, nombre: true } });
  const datosTorta = gastosPorCategoria
    .map((g) => ({
      nombre: categorias.find((c) => c.id === g.categoriaId)?.nombre ?? 'Sin categoría',
      valor: g._sum.total ?? 0,
    }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const atendidasHoy = citasHoy.filter((c) => c.estado === 'ATENDIDA').length;

  return (
    <>
      <EncabezadoPagina
        titulo={`Hola, ${sesion.nombres}`}
        descripcion={`${MESES[mes]} ${anio} · ${sesion.rolNombre}`}
        acciones={
          <form className="flex items-end gap-2">
            <Campo etiqueta="Mes" className="w-36">
              <select name="mes" defaultValue={String(mes)} className="campo">
                {MESES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Año" className="w-24">
              <input name="anio" type="number" min={2020} max={2100} defaultValue={anio} className="campo" />
            </Campo>
            <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Ver
            </button>
          </form>
        }
      />

      {verFinanzas && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica
              etiqueta="Ingresos del mes"
              valor={clp(ingresos)}
              detalle={`${ventasMes._count} ventas · cobrado ${clp(pagosMes._sum.monto ?? 0)}`}
              tono="positivo"
            />
            <Metrica etiqueta="Gastos del mes" valor={clp(gastos)} detalle={`${gastosMes._count} documentos`} tono="negativo" />
            <Metrica
              etiqueta="Resultado operacional"
              valor={clp(resultado)}
              detalle={ingresos > 0 ? `Margen ${Math.round((resultado / ingresos) * 100)}%` : undefined}
              tono={resultado >= 0 ? 'positivo' : 'negativo'}
            />
            <Metrica
              etiqueta="Por cobrar a pacientes"
              valor={clp(saldosPendientes._sum.saldo ?? 0)}
              detalle={`${saldosPendientes._count} ventas con saldo`}
              tono={(saldosPendientes._sum.saldo ?? 0) > 0 ? 'alerta' : 'neutro'}
            />
          </div>

          {/* ── Estimación de IVA (F29) ── */}
          <Tarjeta
            titulo="Estimación de IVA del período"
            descripcion="Débito fiscal de las ventas menos crédito fiscal de las compras con factura."
            className="mb-5"
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">IVA débito (ventas)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{clp(ivaDebito)}</p>
                <p className="text-xs text-slate-500">Neto {clp(ventasMes._sum.neto ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">IVA crédito (compras)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">−{clp(ivaCredito)}</p>
                <p className="text-xs text-slate-500">Neto {clp(gastosMes._sum.neto ?? 0)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {ivaAPagar >= 0 ? 'IVA a pagar (estimado)' : 'Remanente de crédito fiscal'}
                </p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${ivaAPagar >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  {clp(Math.abs(ivaAPagar))}
                </p>
                <p className="text-xs text-slate-500">
                  Estimación referencial para el F29 de {MESES[mes]}. No reemplaza la declaración formal ante el SII.
                </p>
              </div>
            </div>
          </Tarjeta>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Tarjeta titulo="Ingresos y gastos" descripcion="Últimos 6 meses" className="lg:col-span-2">
              <GraficoIngresosGastos datos={ultimos6Meses} />
            </Tarjeta>
            <Tarjeta titulo="Gastos por categoría" descripcion={`${MESES[mes]} ${anio}`}>
              <GraficoTorta datos={datosTorta.slice(0, 8)} />
            </Tarjeta>
          </div>
        </>
      )}

      {bajoStock.length > 0 && puede(sesion, 'inventario', 'ver') && (
        <div className="mb-5">
          <Aviso tono="alerta" titulo={`${bajoStock.length} producto(s) bajo el stock mínimo`}>
            <div className="mt-1 flex flex-wrap gap-2">
              {bajoStock.slice(0, 8).map((p) => (
                <Link
                  key={p.id}
                  href={`/inventario/${p.id}`}
                  className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs hover:bg-amber-50"
                >
                  {p.nombre}: {numero(p.stockActual, 0)} / {numero(p.stockMinimo, 0)}
                </Link>
              ))}
              {bajoStock.length > 8 && (
                <Link href="/inventario?alerta=1" className="text-xs underline">
                  ver los {bajoStock.length}
                </Link>
              )}
            </div>
          </Aviso>
        </div>
      )}

      {verAgenda && (
        <Tarjeta
          titulo="Agenda de hoy"
          descripcion={`${citasHoy.length} hora(s) · ${atendidasHoy} atendida(s)`}
          sinPadding
          acciones={
            <EnlaceBoton href="/agenda" variante="secundario" tamano="sm">
              Ver agenda completa
            </EnlaceBoton>
          }
        >
          {citasHoy.length === 0 ? (
            <div className="p-4">
              <EstadoVacio
                titulo="No hay horas agendadas para hoy"
                descripcion="Cuando se agenden horas para el día de hoy, aparecerán aquí."
                accion={
                  puede(sesion, 'agenda', 'crear') && <EnlaceBoton href="/agenda/nueva">Agendar hora</EnlaceBoton>
                }
              />
            </div>
          ) : (
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Profesional</th>
                  <th>Servicio</th>
                  <th>Box</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {citasHoy.map((cita) => (
                  <tr key={cita.id}>
                    <td className="whitespace-nowrap font-medium tabular-nums text-slate-700">
                      {hora(cita.inicio)}–{hora(cita.fin)}
                    </td>
                    <td>
                      <Link href={`/pacientes/${cita.paciente.id}`} className="font-medium text-brand-700 hover:underline">
                        {cita.paciente.nombres} {cita.paciente.apellidoPaterno}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cita.profesional.colorAgenda }} />
                        {cita.profesional.nombres} {cita.profesional.apellidos}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600">
                      {cita.servicios.length > 0 ? cita.servicios.map((s) => s.servicio.nombre).join(', ') : '—'}
                      {cita.usaRayosX && <Badge tono="morado">RX</Badge>}
                    </td>
                    <td className="text-xs text-slate-600">{cita.box?.codigo ?? '—'}</td>
                    <td className="text-xs text-slate-500">{cita.paciente.telefonoPrincipal}</td>
                    <td>
                      <BadgeEstado estado={cita.estado} />
                    </td>
                    <td className="text-right">
                      {cita.estado !== 'ATENDIDA' && cita.estado !== 'CANCELADA' && (
                        <Link href={`/agenda/${cita.id}/atender`} className="text-sm text-brand-700 hover:underline">
                          Atender
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
        </Tarjeta>
      )}

      {!verFinanzas && !verAgenda && (
        <EstadoVacio
          titulo="Tu perfil no tiene módulos con vista de inicio"
          descripcion="Usa el menú lateral para acceder a las secciones habilitadas para tu rol."
        />
      )}
    </>
  );
}
