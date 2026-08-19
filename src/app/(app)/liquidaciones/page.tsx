import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, humanizar, isoFecha, porcentaje } from '@/lib/format';
import {
  Aviso,
  Badge,
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { generarLiquidacion } from './acciones';

export const metadata = { title: 'Liquidaciones' };

export default async function PaginaLiquidaciones({
  searchParams,
}: {
  searchParams: Promise<{ profesional?: string; estado?: string }>;
}) {
  const sesion = await requerirPermiso('liquidaciones', 'ver');
  const { profesional, estado } = await searchParams;

  const where = {
    ...(profesional ? { profesionalId: profesional } : {}),
    ...(estado ? { estado: estado as never } : {}),
  };

  const [liquidaciones, profesionales, agregado, pendientesPorLiquidar] = await Promise.all([
    prisma.liquidacion.findMany({
      where,
      orderBy: { periodoDesde: 'desc' },
      include: {
        profesional: { select: { id: true, nombres: true, apellidos: true, especialidad: true, modeloPago: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      include: {
        arriendos: { where: { activo: true }, include: { box: { select: { codigo: true } } } },
      },
    }),
    prisma.liquidacion.aggregate({
      where: { ...where, estado: { not: 'ANULADA' } },
      _sum: { totalComision: true, totalArriendo: true, totalAPagar: true },
    }),
    // Prestaciones ya vendidas que aún no entran en ninguna liquidación
    prisma.ventaItem.groupBy({
      by: ['profesionalId'],
      where: { liquidacionId: null, comisionMonto: { gt: 0 }, venta: { estado: { not: 'ANULADA' } } },
      _sum: { comisionMonto: true, total: true },
      _count: true,
    }),
  ]);

  const puedeCrear = puede(sesion, 'liquidaciones', 'crear');

  const hoy = new Date();
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

  const nombreProfesional = (id: string | null) => {
    const p = profesionales.find((x) => x.id === id);
    return p ? `${p.apellidos}, ${p.nombres}` : 'Sin asignar';
  };

  const totalPendiente = pendientesPorLiquidar.reduce((acc, p) => acc + (p._sum.comisionMonto ?? 0), 0);

  return (
    <>
      <EncabezadoPagina
        ayuda="liquidaciones"
        titulo="Liquidaciones de profesionales"
        descripcion="Honorarios calculados por porcentaje o monto fijo por prestación, menos el arriendo de box."
        acciones={
          puedeCrear && (
            <Modal titulo="Generar liquidación" etiquetaBoton="Generar liquidación" ancho="max-w-2xl">
              <Formulario accion={generarLiquidacion} className="space-y-4">
                <Aviso tono="info">
                  Se tomarán todas las prestaciones del profesional en el período que aún no hayan sido liquidadas, y
                  se calculará el honorario de cada una según su regla (porcentaje o monto fijo).
                </Aviso>

                <Campo etiqueta="Profesional" requerido>
                  <select name="profesionalId" required className="campo">
                    <option value="">Selecciona…</option>
                    {profesionales.map((p) => {
                      const pendiente = pendientesPorLiquidar.find((x) => x.profesionalId === p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.apellidos}, {p.nombres} — {humanizar(p.modeloPago)}
                          {pendiente ? ` (${pendiente._count} prestación(es) pendiente(s))` : ''}
                        </option>
                      );
                    })}
                  </select>
                </Campo>

                <Grilla cols={2}>
                  <Campo etiqueta="Período desde" requerido>
                    <input name="periodoDesde" type="date" defaultValue={isoFecha(inicioMesAnterior)} required className="campo" />
                  </Campo>
                  <Campo etiqueta="Período hasta" requerido>
                    <input name="periodoHasta" type="date" defaultValue={isoFecha(finMesAnterior)} required className="campo" />
                  </Campo>
                </Grilla>

                <fieldset className="space-y-2 rounded-lg border border-tinta-200 bg-tinta-50 p-4">
                  <label className="flex items-center gap-2 text-sm text-tinta-700">
                    <input type="checkbox" name="incluirArriendo" defaultChecked className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
                    Descontar el arriendo de box del período
                  </label>
                  <label className="flex items-center gap-2 text-sm text-tinta-700">
                    <input type="checkbox" name="soloPagadas" className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
                    Considerar sólo las ventas ya pagadas por el paciente
                  </label>
                </fieldset>

                <Grilla cols={2}>
                  <Campo etiqueta="Bono adicional (CLP)">
                    <input name="bono" type="number" min={0} step={1000} defaultValue={0} className="campo" />
                  </Campo>
                  <Campo etiqueta="Concepto del bono">
                    <input name="bonoDescripcion" className="campo" placeholder="Bono de productividad" />
                  </Campo>
                  <Campo etiqueta="Otros descuentos (CLP)">
                    <input name="descuento" type="number" min={0} step={1000} defaultValue={0} className="campo" />
                  </Campo>
                  <Campo etiqueta="Concepto del descuento">
                    <input name="descuentoDescripcion" className="campo" placeholder="Insumos personales" />
                  </Campo>
                </Grilla>

                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>

                <div className="flex justify-end">
                  <BotonEnviar>Generar liquidación</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Honorarios liquidados" valor={clp(agregado._sum.totalComision ?? 0)} />
        <Metrica etiqueta="Arriendos cobrados" valor={clp(agregado._sum.totalArriendo ?? 0)} tono="positivo" />
        <Metrica etiqueta="Neto a pagar" valor={clp(agregado._sum.totalAPagar ?? 0)} tono="marca" />
        <Metrica
          etiqueta="Pendiente de liquidar"
          valor={clp(totalPendiente)}
          detalle="Prestaciones sin liquidación"
          tono={totalPendiente > 0 ? 'alerta' : 'neutro'}
        />
      </div>

      {pendientesPorLiquidar.length > 0 && (
        <Tarjeta titulo="Prestaciones pendientes de liquidar" className="mb-5" sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Profesional</th>
                <th className="text-right">Prestaciones</th>
                <th className="text-right">Producido</th>
                <th className="text-right">Honorario acumulado</th>
              </tr>
            </thead>
            <tbody>
              {pendientesPorLiquidar
                .sort((a, b) => (b._sum.comisionMonto ?? 0) - (a._sum.comisionMonto ?? 0))
                .map((p) => (
                  <tr key={p.profesionalId ?? 'sin'}>
                    <td className="font-medium text-tinta-800">{nombreProfesional(p.profesionalId)}</td>
                    <td className="text-right tabular-nums text-tinta-600">{p._count}</td>
                    <td className="text-right tabular-nums text-tinta-600">{clp(p._sum.total ?? 0)}</td>
                    <td className="text-right font-medium tabular-nums text-amber-600">
                      {clp(p._sum.comisionMonto ?? 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Profesional" className="w-56">
          <select name="profesional" defaultValue={profesional ?? ''} className="campo">
            <option value="">Todos</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellidos}, {p.nombres}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado" className="w-44">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="APROBADA">Aprobada</option>
            <option value="PAGADA">Pagada</option>
            <option value="ANULADA">Anulada</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {liquidaciones.length === 0 ? (
        <EstadoVacio
          titulo="Sin liquidaciones"
          descripcion="Genera la primera liquidación para calcular automáticamente los honorarios del período."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Profesional</th>
                <th>Período</th>
                <th className="text-right">Producido</th>
                <th className="text-right">Honorarios</th>
                <th className="text-right">Arriendo</th>
                <th className="text-right">Neto a pagar</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => (
                <tr key={l.id} className={l.estado === 'ANULADA' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-tinta-500">{l.folio}</td>
                  <td>
                    <Link href={`/profesionales/${l.profesional.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.profesional.apellidos}, {l.profesional.nombres}
                    </Link>
                    <p className="text-xs text-tinta-400">{l.profesional.especialidad}</p>
                  </td>
                  <td className="whitespace-nowrap text-xs text-tinta-600">
                    {fechaCorta(l.periodoDesde)} → {fechaCorta(l.periodoHasta)}
                  </td>
                  <td className="text-right tabular-nums text-tinta-600">{clp(l.totalProducido)}</td>
                  <td className="text-right tabular-nums text-emerald-600">{clp(l.totalComision)}</td>
                  <td className="text-right tabular-nums text-rose-600">
                    {l.totalArriendo > 0 ? `−${clp(l.totalArriendo)}` : '—'}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    <span className={l.totalAPagar < 0 ? 'text-rose-600' : ''}>{clp(l.totalAPagar)}</span>
                  </td>
                  <td>
                    <BadgeEstado estado={l.estado} />
                  </td>
                  <td className="text-right">
                    <Link href={`/liquidaciones/${l.id}`} className="text-sm text-brand-700 hover:underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}

      <Tarjeta titulo="Contratos de arriendo vigentes" className="mt-5" sinPadding>
        <ContenedorTabla>
          <thead>
            <tr>
              <th>Profesional</th>
              <th>Modelo de pago</th>
              <th>Comisión general</th>
              <th>Box arrendado</th>
              <th className="text-right">Monto</th>
              <th>Periodicidad</th>
            </tr>
          </thead>
          <tbody>
            {profesionales.map((p) => (
              <tr key={p.id}>
                <td className="font-medium text-tinta-800">
                  {p.apellidos}, {p.nombres}
                </td>
                <td>
                  <Badge tono="azul">{humanizar(p.modeloPago)}</Badge>
                </td>
                <td className="text-tinta-600">
                  {p.comisionTipo === 'PORCENTAJE'
                    ? porcentaje(p.comisionPorcentaje)
                    : `${clp(p.comisionMontoFijo)} por prestación`}
                </td>
                <td className="text-xs text-tinta-600">
                  {p.arriendos.length === 0 ? '—' : p.arriendos.map((a) => a.box.codigo).join(', ')}
                </td>
                <td className="text-right tabular-nums">
                  {p.arriendos.length === 0 ? '—' : clp(p.arriendos.reduce((acc, a) => acc + a.monto, 0))}
                </td>
                <td className="text-xs text-tinta-600">
                  {p.arriendos.length === 0 ? '—' : humanizar(p.arriendos[0].periodicidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      </Tarjeta>
    </>
  );
}
