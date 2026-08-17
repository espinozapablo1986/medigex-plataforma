import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, isoFecha } from '@/lib/format';
import {
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Metrica,
  Paginador,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SelectorBuscable } from '@/components/selector';

import { registrarPago } from '../ventas/acciones';

export const metadata = { title: 'Pagos' };

const POR_PAGINA = 30;

export default async function PaginaPagos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; forma?: string; pagina?: string }>;
}) {
  const sesion = await requerirPermiso('pagos', 'ver');
  const { desde, hasta, forma, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);

  const hoy = new Date();
  const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fechaHasta = hasta ? new Date(`${hasta}T23:59:59`) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

  const where = {
    fecha: { gte: fechaDesde, lte: fechaHasta },
    ...(forma ? { formaPagoId: forma } : {}),
  };

  const [pagos, total, porForma, formasPago, pacientes] = await Promise.all([
    prisma.pago.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, rut: true } },
        formaPago: true,
        venta: { select: { id: true, folio: true } },
        adjuntos: { select: { id: true, nombreOriginal: true } },
        registradoPor: { select: { nombres: true, apellidos: true } },
      },
    }),
    prisma.pago.count({ where }),
    prisma.pago.groupBy({
      by: ['formaPagoId'],
      where: { ...where, estado: 'CONFIRMADO' },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.formaPago.findMany({ orderBy: { orden: 'asc' } }),
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, rut: true },
    }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (desde) filtros.set('desde', desde);
  if (hasta) filtros.set('hasta', hasta);
  if (forma) filtros.set('forma', forma);
  const base = `/pagos${filtros.toString() ? `?${filtros}` : ''}`;

  const totalRecaudado = porForma.reduce((acc, f) => acc + (f._sum.monto ?? 0), 0);
  const nombreForma = (id: string) => formasPago.find((f) => f.id === id)?.nombre ?? 'Otra';

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos"
        descripcion="Cobros recibidos, con su forma de pago y comprobante."
        acciones={
          puede(sesion, 'pagos', 'crear') && (
            <Modal titulo="Registrar pago libre" etiquetaBoton="Registrar pago" ancho="max-w-lg">
              <Formulario accion={registrarPago} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Pago no asociado a una venta específica (abono a cuenta). Para pagar una venta concreta, hazlo desde
                  el detalle de esa venta.
                </p>
                <Campo etiqueta="Paciente" requerido>
                  <SelectorBuscable
                    name="pacienteId"
                    opciones={pacientes.map((p) => ({
                      valor: p.id,
                      etiqueta: `${p.apellidoPaterno}, ${p.nombres}`,
                      detalle: p.rut ?? 'sin RUT',
                      buscarPor: p.rut ?? '',
                    }))}
                    placeholder="Busca por nombre o RUT…"
                    permiteVacio={false}
                    requerido
                  />
                </Campo>
                <Grilla cols={2}>
                  <Campo etiqueta="Monto" requerido>
                    <input name="monto" type="number" min={1} step={1} required className="campo" />
                  </Campo>
                  <Campo etiqueta="Forma de pago" requerido>
                    <select name="formaPagoId" required className="campo">
                      <option value="">Selecciona…</option>
                      {formasPago
                        .filter((f) => f.activo)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre}
                          </option>
                        ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Fecha">
                    <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
                  </Campo>
                  <Campo etiqueta="Referencia">
                    <input name="referencia" className="campo" />
                  </Campo>
                </Grilla>
                <Campo etiqueta="Comprobante">
                  <input name="comprobante" type="file" accept="image/*,application/pdf" className="campo" />
                </Campo>
                <Campo etiqueta="Observaciones">
                  <input name="observaciones" className="campo" />
                </Campo>
                <div className="flex justify-end">
                  <BotonEnviar>Registrar pago</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Recaudado en el período" valor={clp(totalRecaudado)} tono="positivo" />
        <Metrica etiqueta="Pagos registrados" valor={String(total)} />
        {porForma
          .sort((a, b) => (b._sum.monto ?? 0) - (a._sum.monto ?? 0))
          .slice(0, 2)
          .map((f) => (
            <Metrica
              key={f.formaPagoId}
              etiqueta={nombreForma(f.formaPagoId)}
              valor={clp(f._sum.monto ?? 0)}
              detalle={`${f._count} pago(s)`}
            />
          ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde" className="w-40">
          <input name="desde" type="date" defaultValue={desde ?? isoFecha(fechaDesde)} className="campo" />
        </Campo>
        <Campo etiqueta="Hasta" className="w-40">
          <input name="hasta" type="date" defaultValue={hasta ?? isoFecha(fechaHasta)} className="campo" />
        </Campo>
        <Campo etiqueta="Forma de pago" className="w-52">
          <select name="forma" defaultValue={forma ?? ''} className="campo">
            <option value="">Todas</option>
            {formasPago.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {pagos.length === 0 ? (
        <EstadoVacio titulo="Sin pagos en el período" descripcion="Ajusta el rango de fechas o registra un nuevo cobro." />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Forma de pago</th>
                <th>Referencia</th>
                <th>Venta</th>
                <th className="text-right">Monto</th>
                <th>Comprobante</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className={p.estado === 'ANULADO' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-slate-500">{p.folio}</td>
                  <td className="whitespace-nowrap text-slate-600">{fechaCorta(p.fecha)}</td>
                  <td>
                    <Link href={`/pacientes/${p.paciente.id}/cuenta`} className="font-medium text-brand-700 hover:underline">
                      {p.paciente.nombres} {p.paciente.apellidoPaterno}
                    </Link>
                  </td>
                  <td className="text-slate-700">{p.formaPago.nombre}</td>
                  <td className="text-xs text-slate-500">
                    {p.referencia ?? '—'}
                    {p.banco && <p>{p.banco}</p>}
                  </td>
                  <td className="text-xs">
                    {p.venta ? (
                      <Link href={`/ventas/${p.venta.id}`} className="text-brand-700 hover:underline">
                        Nº {p.venta.folio}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Abono a cuenta</span>
                    )}
                  </td>
                  <td className="text-right font-medium tabular-nums">{clp(p.monto)}</td>
                  <td>
                    {p.adjuntos.length > 0 ? (
                      <a
                        href={`/api/adjuntos/${p.adjuntos[0].id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-700 hover:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    <BadgeEstado estado={p.estado} />
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
