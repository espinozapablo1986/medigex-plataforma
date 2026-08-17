import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, formatearRut, humanizar, isoFecha, numero, porcentaje } from '@/lib/format';
import {
  Aviso,
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
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { anularPago, anularVenta, registrarPago } from '../acciones';

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('ventas', 'ver');

  const [venta, formasPago, config] = await Promise.all([
    prisma.venta.findUnique({
      where: { id },
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, rut: true, telefonoPrincipal: true, email: true } },
        profesional: { select: { nombres: true, apellidos: true, especialidad: true } },
        convenio: { select: { nombre: true, tipo: true } },
        presupuesto: { select: { id: true, folio: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
        items: {
          include: {
            servicio: { select: { codigo: true } },
            producto: { select: { sku: true } },
            profesional: { select: { nombres: true, apellidos: true } },
          },
        },
        pagos: {
          orderBy: { fecha: 'desc' },
          include: { formaPago: true, adjuntos: { select: { id: true, nombreOriginal: true } }, registradoPor: { select: { nombres: true, apellidos: true } } },
        },
      },
    }),
    prisma.formaPago.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!venta) notFound();

  const puedeCobrar = puede(sesion, 'pagos', 'crear') && venta.saldo > 0 && venta.estado !== 'ANULADA';
  const totalComisiones = venta.items.reduce((acc, i) => acc + i.comisionMonto, 0);

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo={`Venta Nº ${venta.folio}`}
          descripcion={`${venta.paciente.nombres} ${venta.paciente.apellidoPaterno} · ${fechaCorta(venta.fecha)}`}
          volver={{ href: '/ventas', texto: 'Ventas' }}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <BadgeEstado estado={venta.estado} />

              {puedeCobrar && (
                <Modal titulo="Registrar pago" etiquetaBoton="Registrar pago" ancho="max-w-lg">
                  <Formulario accion={registrarPago} className="space-y-4">
                    <input type="hidden" name="pacienteId" value={venta.pacienteId} />
                    <input type="hidden" name="ventaId" value={venta.id} />

                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      Saldo de la venta: <strong className="tabular-nums">{clp(venta.saldo)}</strong>
                    </div>

                    <Grilla cols={2}>
                      <Campo etiqueta="Monto" requerido>
                        <input
                          name="monto"
                          type="number"
                          min={1}
                          max={venta.saldo}
                          step={1}
                          defaultValue={venta.saldo}
                          required
                          className="campo"
                        />
                      </Campo>
                      <Campo etiqueta="Forma de pago" requerido>
                        <select name="formaPagoId" required className="campo">
                          <option value="">Selecciona…</option>
                          {formasPago.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nombre}
                              {f.requiereComprobante ? ' (requiere comprobante)' : ''}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo etiqueta="Fecha">
                        <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
                      </Campo>
                      <Campo etiqueta="Nº de operación / referencia">
                        <input name="referencia" className="campo" />
                      </Campo>
                      <Campo etiqueta="Banco">
                        <input name="banco" className="campo" />
                      </Campo>
                      <Campo etiqueta="Cuotas">
                        <input name="cuotas" type="number" min={1} defaultValue={1} className="campo" />
                      </Campo>
                    </Grilla>

                    <Campo etiqueta="Comprobante de pago" ayuda="Foto o PDF del voucher, transferencia o depósito.">
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
              )}

              {puede(sesion, 'ventas', 'anular') && venta.estado !== 'ANULADA' && (
                <Modal titulo="Anular venta" etiquetaBoton="Anular" varianteBoton="peligro" ancho="max-w-md">
                  <Formulario accion={anularVenta} className="space-y-4">
                    <input type="hidden" name="id" value={venta.id} />
                    <Aviso tono="alerta">
                      Se generará una nota de crédito en la cuenta del paciente por {clp(venta.total)}. Esta acción
                      queda registrada en la auditoría.
                    </Aviso>
                    <Campo etiqueta="Motivo de la anulación" requerido>
                      <textarea name="motivo" rows={3} required className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar variante="peligro">Anular venta</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )}
            </div>
          }
        />

        {venta.estado === 'ANULADA' && (
          <div className="mb-4">
            <Aviso tono="error" titulo="Venta anulada">
              {venta.anuladaMotivo}
            </Aviso>
          </div>
        )}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica etiqueta="Total" valor={clp(venta.total)} />
          <Metrica etiqueta="Pagado" valor={clp(venta.pagado)} tono="positivo" />
          <Metrica etiqueta="Saldo" valor={clp(venta.saldo)} tono={venta.saldo > 0 ? 'negativo' : 'neutro'} />
          <Metrica
            etiqueta="Comisiones a pagar"
            valor={clp(totalComisiones)}
            detalle="Se liquidan al profesional"
            tono="marca"
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta titulo="Detalle de la venta" sinPadding>
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>Detalle</th>
                  <th>Profesional</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">P. unit.</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {venta.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-slate-800">{item.descripcion}</p>
                      <p className="text-xs text-slate-400">
                        {humanizar(item.tipo)}
                        {item.servicio && ` · ${item.servicio.codigo}`}
                        {item.producto && ` · ${item.producto.sku}`}
                        {item.piezaDental && ` · pieza ${item.piezaDental}`}
                        {item.codigoPrestacion && ` · prestación ${item.codigoPrestacion}`}
                      </p>
                    </td>
                    <td className="text-xs text-slate-600">
                      {item.profesional ? `${item.profesional.nombres} ${item.profesional.apellidos}` : '—'}
                    </td>
                    <td className="text-right tabular-nums">{numero(item.cantidad, item.cantidad % 1 === 0 ? 0 : 2)}</td>
                    <td className="text-right tabular-nums">{clp(item.precioUnitario)}</td>
                    <td className="text-right font-medium tabular-nums">{clp(item.total)}</td>
                    <td className="text-right text-xs tabular-nums text-slate-600">
                      {item.comisionMonto > 0 ? (
                        <>
                          {clp(item.comisionMonto)}
                          <p className="text-slate-400">
                            {item.comisionTipo === 'PORCENTAJE' ? porcentaje(item.comisionPorcentaje) : 'monto fijo'}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>

            <div className="flex justify-end border-t border-slate-200 p-4">
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <Fila etiqueta="Subtotal" valor={clp(venta.subtotal)} />
                {venta.descuento > 0 && <Fila etiqueta="Descuento" valor={`−${clp(venta.descuento)}`} tono="rose" />}
                <Fila etiqueta="Neto" valor={clp(venta.neto)} />
                <Fila etiqueta={`IVA (${config?.ivaPorcentaje ?? 19}%)`} valor={clp(venta.iva)} />
                {venta.montoCobertura > 0 && (
                  <>
                    <Fila etiqueta="Cubre el convenio" valor={`−${clp(venta.montoCobertura)}`} tono="emerald" />
                    <Fila etiqueta="Copago del paciente" valor={clp(venta.montoPaciente)} />
                  </>
                )}
                <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-base font-bold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{clp(venta.total)}</dd>
                </div>
              </dl>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Pagos recibidos" sinPadding>
            {venta.pagos.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Aún no se registran pagos para esta venta.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Fecha</th>
                    <th>Forma de pago</th>
                    <th>Referencia</th>
                    <th className="text-right">Monto</th>
                    <th>Comprobante</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {venta.pagos.map((pago) => (
                    <tr key={pago.id} className={pago.estado === 'ANULADO' ? 'opacity-50' : ''}>
                      <td className="text-slate-500">{pago.folio}</td>
                      <td className="text-slate-600">{fechaCorta(pago.fecha)}</td>
                      <td className="text-slate-700">
                        {pago.formaPago.nombre}
                        {pago.cuotas > 1 && <p className="text-xs text-slate-400">{pago.cuotas} cuotas</p>}
                      </td>
                      <td className="text-xs text-slate-500">
                        {pago.referencia ?? '—'}
                        {pago.banco && <p>{pago.banco}</p>}
                      </td>
                      <td className="text-right font-medium tabular-nums">{clp(pago.monto)}</td>
                      <td>
                        {pago.adjuntos.length > 0 ? (
                          <a
                            href={`/api/adjuntos/${pago.adjuntos[0].id}`}
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
                        <BadgeEstado estado={pago.estado} />
                      </td>
                      <td className="text-right">
                        {puede(sesion, 'pagos', 'anular') && pago.estado === 'CONFIRMADO' && (
                          <Modal
                            titulo="Anular pago"
                            etiquetaBoton="Anular"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                            ancho="max-w-md"
                          >
                            <Formulario accion={anularPago} className="space-y-4">
                              <input type="hidden" name="id" value={pago.id} />
                              <Campo etiqueta="Motivo de la anulación" requerido>
                                <textarea name="motivo" rows={3} required className="campo" />
                              </Campo>
                              <div className="flex justify-end">
                                <BotonEnviar variante="peligro">Anular pago</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta titulo="Datos">
            <dl className="space-y-3">
              <Definicion termino="Paciente">
                <Link href={`/pacientes/${venta.paciente.id}`} className="text-brand-700 hover:underline">
                  {venta.paciente.nombres} {venta.paciente.apellidoPaterno} {venta.paciente.apellidoMaterno ?? ''}
                </Link>
              </Definicion>
              <Definicion termino="RUT">{formatearRut(venta.paciente.rut)}</Definicion>
              <Definicion termino="Teléfono">{venta.paciente.telefonoPrincipal}</Definicion>
              <Definicion termino="Profesional">
                {venta.profesional ? `${venta.profesional.nombres} ${venta.profesional.apellidos}` : null}
              </Definicion>
              <Definicion termino="Documento">
                {humanizar(venta.tipoDocumento)}
                {venta.numeroDocumento ? ` Nº ${venta.numeroDocumento}` : ''}
              </Definicion>
              <Definicion termino="Convenio">
                {venta.convenio ? <Badge tono="azul">{venta.convenio.nombre}</Badge> : null}
              </Definicion>
              <Definicion termino="Presupuesto de origen">
                {venta.presupuesto ? (
                  <Link href={`/presupuestos/${venta.presupuesto.id}`} className="text-brand-700 hover:underline">
                    Nº {venta.presupuesto.folio}
                  </Link>
                ) : null}
              </Definicion>
              <Definicion termino="Observaciones">{venta.observaciones}</Definicion>
              <Definicion termino="Registrada por">
                {venta.creadoPor ? `${venta.creadoPor.nombres} ${venta.creadoPor.apellidos}` : null}
              </Definicion>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Acceso rápido">
            <div className="space-y-2 text-sm">
              <Link href={`/pacientes/${venta.paciente.id}/cuenta`} className="block text-brand-700 hover:underline">
                Cuenta corriente del paciente →
              </Link>
              <Link href={`/pacientes/${venta.paciente.id}/historia`} className="block text-brand-700 hover:underline">
                Historia clínica →
              </Link>
              {venta.convenio && (
                <Link href={`/informes/nuevo?paciente=${venta.paciente.id}`} className="block text-brand-700 hover:underline">
                  Emitir informe para reembolso →
                </Link>
              )}
            </div>
          </Tarjeta>
        </div>
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
