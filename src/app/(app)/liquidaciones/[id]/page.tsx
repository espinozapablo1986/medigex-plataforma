import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, formatearRut, humanizar } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  Campo,
  ContenedorTabla,
  Definicion,
  EncabezadoPagina,
  Grilla,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { agregarAjuste, cambiarEstadoLiquidacion, eliminarLiquidacion } from '../acciones';

const TONO_ITEM: Record<string, 'verde' | 'rojo' | 'azul' | 'gris'> = {
  COMISION: 'verde',
  BONO: 'verde',
  ARRIENDO_BOX: 'rojo',
  DESCUENTO: 'rojo',
  AJUSTE: 'azul',
};

export default async function DetalleLiquidacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('liquidaciones', 'ver');

  const [liquidacion, formasPago, config] = await Promise.all([
    prisma.liquidacion.findUnique({
      where: { id },
      include: {
        profesional: {
          include: { arriendos: { where: { activo: true }, include: { box: { select: { codigo: true, nombre: true } } } } },
        },
        formaPago: true,
        creadoPor: { select: { nombres: true, apellidos: true } },
        items: { orderBy: { tipo: 'asc' } },
      },
    }),
    prisma.formaPago.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!liquidacion) notFound();

  const puedeEditar = puede(sesion, 'liquidaciones', 'editar') && liquidacion.estado === 'BORRADOR';
  const puedeAprobar = puede(sesion, 'liquidaciones', 'aprobar');

  const comisiones = liquidacion.items.filter((i) => i.tipo === 'COMISION');
  const otros = liquidacion.items.filter((i) => i.tipo !== 'COMISION');

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo={`Liquidación Nº ${liquidacion.folio}`}
          descripcion={`${liquidacion.profesional.nombres} ${liquidacion.profesional.apellidos} · ${fechaCorta(liquidacion.periodoDesde)} al ${fechaCorta(liquidacion.periodoHasta)}`}
          volver={{ href: '/liquidaciones', texto: 'Liquidaciones' }}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <BadgeEstado estado={liquidacion.estado} />

              {puedeEditar && (
                <Modal titulo="Agregar ajuste" etiquetaBoton="Agregar ajuste" varianteBoton="secundario" tamanoBoton="sm" ancho="max-w-md">
                  <Formulario accion={agregarAjuste} className="space-y-4">
                    <input type="hidden" name="liquidacionId" value={id} />
                    <Campo etiqueta="Tipo" requerido>
                      <select name="tipo" required className="campo">
                        <option value="BONO">Bono (suma)</option>
                        <option value="DESCUENTO">Descuento (resta)</option>
                        <option value="AJUSTE">Ajuste (suma)</option>
                      </select>
                    </Campo>
                    <Campo etiqueta="Descripción" requerido>
                      <input name="descripcion" required className="campo" />
                    </Campo>
                    <Campo etiqueta="Monto (CLP)" requerido>
                      <input name="monto" type="number" min={1} step={1000} required className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar>Agregar</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )}

              {liquidacion.estado === 'BORRADOR' && puedeAprobar && (
                <form action={cambiarEstadoLiquidacion}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="estado" value="APROBADA" />
                  <button type="submit" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Aprobar
                  </button>
                </form>
              )}

              {liquidacion.estado === 'APROBADA' && puedeAprobar && (
                <Modal titulo="Registrar pago de la liquidación" etiquetaBoton="Marcar como pagada" ancho="max-w-md">
                  <form action={cambiarEstadoLiquidacion} className="space-y-4">
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="estado" value="PAGADA" />
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      Monto a pagar: <strong className="tabular-nums">{clp(liquidacion.totalAPagar)}</strong>
                    </div>
                    <Campo etiqueta="Forma de pago">
                      <select name="formaPagoId" className="campo">
                        <option value="">Sin especificar</option>
                        {formasPago.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <div className="flex justify-end">
                      <button type="submit" className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                        Confirmar pago
                      </button>
                    </div>
                  </form>
                </Modal>
              )}

              {puede(sesion, 'liquidaciones', 'eliminar') && liquidacion.estado !== 'PAGADA' && (
                <BotonEliminar
                  accion={eliminarLiquidacion}
                  id={id}
                  variante="peligro"
                  mensaje="Se eliminará la liquidación y las prestaciones volverán a quedar disponibles para liquidar. ¿Continuar?"
                />
              )}
            </div>
          }
        />

        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica etiqueta="Producido" valor={clp(liquidacion.totalProducido)} detalle={`${comisiones.length} prestaciones`} />
          <Metrica etiqueta="Honorarios" valor={clp(liquidacion.totalComision)} tono="positivo" />
          <Metrica
            etiqueta="Arriendo de box"
            valor={liquidacion.totalArriendo > 0 ? `−${clp(liquidacion.totalArriendo)}` : clp(0)}
            tono={liquidacion.totalArriendo > 0 ? 'negativo' : 'neutro'}
          />
          <Metrica
            etiqueta="Neto a pagar"
            valor={clp(liquidacion.totalAPagar)}
            tono={liquidacion.totalAPagar < 0 ? 'negativo' : 'marca'}
            detalle={liquidacion.totalAPagar < 0 ? 'El profesional debe al centro' : undefined}
          />
        </div>
      </div>

      <div className="tarjeta mx-auto max-w-4xl p-8">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{config?.nombreClinica ?? 'MEDIGEX'}</h2>
            {config?.rut && <p className="text-sm text-slate-600">RUT {formatearRut(config.rut)}</p>}
            <p className="text-sm text-slate-600">
              {[config?.direccion, config?.comuna].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Liquidación de honorarios</p>
            <p className="text-2xl font-bold text-slate-900">Nº {liquidacion.folio}</p>
            <p className="text-sm text-slate-600">
              {fechaCorta(liquidacion.periodoDesde)} — {fechaCorta(liquidacion.periodoHasta)}
            </p>
          </div>
        </header>

        <section className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Profesional</p>
          <p className="font-medium text-slate-900">
            {liquidacion.profesional.nombres} {liquidacion.profesional.apellidos}
          </p>
          <p className="text-sm text-slate-600">{formatearRut(liquidacion.profesional.rut)}</p>
          <p className="text-sm text-slate-600">{liquidacion.profesional.especialidad}</p>
          <p className="text-sm text-slate-600">
            {humanizar(liquidacion.profesional.modeloPago)} ·{' '}
            {liquidacion.profesional.comisionTipo === 'PORCENTAJE'
              ? `${liquidacion.profesional.comisionPorcentaje}% general`
              : `${clp(liquidacion.profesional.comisionMontoFijo)} fijo por prestación`}
          </p>
        </section>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Prestaciones realizadas</h3>
        {comisiones.length === 0 ? (
          <p className="mb-6 text-sm text-slate-500">Sin prestaciones en el período.</p>
        ) : (
          <div className="mb-6">
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>Detalle</th>
                  <th className="text-right">Honorario</th>
                </tr>
              </thead>
              <tbody>
                {comisiones.map((item) => (
                  <tr key={item.id}>
                    <td className="text-slate-700">{item.descripcion}</td>
                    <td className="text-right font-medium tabular-nums text-emerald-700">{clp(item.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          </div>
        )}

        {otros.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Descuentos y otros conceptos</h3>
            <div className="mb-6">
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {otros.map((item) => (
                    <tr key={item.id}>
                      <td className="text-slate-700">{item.descripcion}</td>
                      <td>
                        <Badge tono={TONO_ITEM[item.tipo] ?? 'gris'}>{humanizar(item.tipo)}</Badge>
                      </td>
                      <td className={`text-right font-medium tabular-nums ${item.monto < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {item.monto < 0 ? `−${clp(Math.abs(item.monto))}` : clp(item.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <dl className="w-full max-w-sm space-y-1.5 text-sm">
            <Fila etiqueta="Total producido" valor={clp(liquidacion.totalProducido)} />
            <Fila etiqueta="Honorarios del profesional" valor={clp(liquidacion.totalComision)} tono="emerald" />
            {liquidacion.totalBonos > 0 && <Fila etiqueta="Bonos" valor={clp(liquidacion.totalBonos)} tono="emerald" />}
            {liquidacion.totalArriendo > 0 && (
              <Fila etiqueta="Arriendo de box" valor={`−${clp(liquidacion.totalArriendo)}`} tono="rose" />
            )}
            {liquidacion.totalOtrosDescuentos > 0 && (
              <Fila etiqueta="Otros descuentos" valor={`−${clp(liquidacion.totalOtrosDescuentos)}`} tono="rose" />
            )}
            <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-lg font-bold">
              <dt>Total a pagar</dt>
              <dd className="tabular-nums">{clp(liquidacion.totalAPagar)}</dd>
            </div>
          </dl>
        </div>

        {liquidacion.observaciones && (
          <section className="mt-6 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{liquidacion.observaciones}</p>
          </section>
        )}

        <footer className="mt-10 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-2">
          <div className="text-center">
            <div className="mb-1 border-t border-slate-400 pt-1 text-sm text-slate-600">
              {liquidacion.profesional.nombres} {liquidacion.profesional.apellidos}
            </div>
            <p className="text-xs text-slate-400">Recibí conforme</p>
          </div>
          <div className="text-center">
            <div className="mb-1 border-t border-slate-400 pt-1 text-sm text-slate-600">
              {config?.nombreClinica ?? 'MEDIGEX'}
            </div>
            <p className="text-xs text-slate-400">Administración</p>
          </div>
        </footer>

        <p className="mt-6 text-xs text-slate-400">
          Generada por{' '}
          {liquidacion.creadoPor ? `${liquidacion.creadoPor.nombres} ${liquidacion.creadoPor.apellidos}` : 'el sistema'}
          {' · '}
          {fechaCorta(liquidacion.createdAt)}
          {liquidacion.fechaPago && ` · Pagada el ${fechaCorta(liquidacion.fechaPago)}`}
          {liquidacion.formaPago && ` vía ${liquidacion.formaPago.nombre}`}
        </p>
      </div>
    </>
  );
}

function Fila({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'rose' | 'emerald' }) {
  const color = tono === 'rose' ? 'text-rose-600' : tono === 'emerald' ? 'text-emerald-600' : 'text-slate-800';
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{etiqueta}</dt>
      <dd className={`tabular-nums ${color}`}>{valor}</dd>
    </div>
  );
}
