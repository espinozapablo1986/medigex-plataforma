import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { calcularEdad, clp, fechaCorta, formatearRut, humanizar, numero, porcentaje } from '@/lib/format';
import {
  Aviso,
  Badge,
  BadgeEstado,
  ContenedorTabla,
  Definicion,
  EncabezadoPagina,
  EnlaceBoton,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar } from '@/components/formulario';

import { cambiarEstadoPresupuesto, eliminarPresupuesto } from '../acciones';

export default async function DetallePresupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('presupuestos', 'ver');

  const [presupuesto, config] = await Promise.all([
    prisma.presupuesto.findUnique({
      where: { id },
      include: {
        paciente: { include: { convenio: { select: { nombre: true } }, prevision: { select: { nombre: true } } } },
        profesional: { select: { nombres: true, apellidos: true, especialidad: true, registroSuperintendencia: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
        items: { orderBy: { orden: 'asc' }, include: { servicio: true, producto: true } },
        ventas: { select: { id: true, folio: true, total: true, estado: true } },
      },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!presupuesto) notFound();

  const paciente = presupuesto.paciente;
  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);
  const puedeEditar = puede(sesion, 'presupuestos', 'editar') && presupuesto.estado !== 'FACTURADO';
  const puedeAprobar = puede(sesion, 'presupuestos', 'aprobar');
  const vencido = presupuesto.validoHasta && presupuesto.validoHasta < new Date() && presupuesto.estado === 'ENVIADO';

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo={`Presupuesto Nº ${presupuesto.folio}`}
          descripcion={`${paciente.nombres} ${paciente.apellidoPaterno} · ${fechaCorta(presupuesto.fecha)}`}
          volver={{ href: '/presupuestos', texto: 'Presupuestos' }}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <BadgeEstado estado={presupuesto.estado} />

              {puedeEditar && (
                <EnlaceBoton href={`/presupuestos/${id}/editar`} variante="secundario" tamano="sm">
                  Editar
                </EnlaceBoton>
              )}

              {presupuesto.estado === 'BORRADOR' && puedeEditar && (
                <form action={cambiarEstadoPresupuesto}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="estado" value="ENVIADO" />
                  <button type="submit" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Marcar como enviado
                  </button>
                </form>
              )}

              {['ENVIADO', 'BORRADOR'].includes(presupuesto.estado) && puedeAprobar && (
                <>
                  <form action={cambiarEstadoPresupuesto}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="estado" value="ACEPTADO" />
                    <button type="submit" className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                      Aceptar
                    </button>
                  </form>
                  <form action={cambiarEstadoPresupuesto}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="estado" value="RECHAZADO" />
                    <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Rechazar
                    </button>
                  </form>
                </>
              )}

              {presupuesto.estado === 'ACEPTADO' && puede(sesion, 'ventas', 'crear') && (
                <EnlaceBoton href={`/ventas/nueva?presupuesto=${id}`}>Convertir en venta</EnlaceBoton>
              )}

              {puede(sesion, 'presupuestos', 'eliminar') && presupuesto.ventas.length === 0 && (
                <BotonEliminar accion={eliminarPresupuesto} id={id} variante="peligro" />
              )}
            </div>
          }
        />

        {vencido && (
          <div className="mb-4">
            <Aviso tono="alerta" titulo="Presupuesto vencido">
              La validez terminó el {fechaCorta(presupuesto.validoHasta)}. Confirma los precios antes de aceptarlo.
            </Aviso>
          </div>
        )}

        {presupuesto.ventas.length > 0 && (
          <div className="mb-4">
            <Aviso tono="exito" titulo="Presupuesto facturado">
              {presupuesto.ventas.map((v) => (
                <Link key={v.id} href={`/ventas/${v.id}`} className="underline">
                  Venta Nº {v.folio} por {clp(v.total)}
                </Link>
              ))}
            </Aviso>
          </div>
        )}

        {presupuesto.motivoRechazo && (
          <div className="mb-4">
            <Aviso tono="error" titulo="Motivo del rechazo">
              {presupuesto.motivoRechazo}
            </Aviso>
          </div>
        )}
      </div>

      {/* ── Documento imprimible ── */}
      <div className="tarjeta mx-auto max-w-4xl p-8">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{config?.nombreClinica ?? 'MEDIGEX'}</h2>
            {config?.rut && <p className="text-sm text-slate-600">RUT {formatearRut(config.rut)}</p>}
            {config?.giro && <p className="text-sm text-slate-600">{config.giro}</p>}
            <p className="text-sm text-slate-600">
              {[config?.direccion, config?.comuna, config?.ciudad].filter(Boolean).join(', ')}
            </p>
            {config?.telefono && <p className="text-sm text-slate-600">{config.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Presupuesto</p>
            <p className="text-2xl font-bold text-slate-900">Nº {presupuesto.folio}</p>
            <p className="text-sm text-slate-600">{fechaCorta(presupuesto.fecha)}</p>
            {presupuesto.validoHasta && (
              <p className="text-xs text-slate-500">Válido hasta {fechaCorta(presupuesto.validoHasta)}</p>
            )}
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</p>
            <p className="font-medium text-slate-900">
              {paciente.nombres} {paciente.apellidoPaterno} {paciente.apellidoMaterno ?? ''}
            </p>
            <p className="text-sm text-slate-600">{formatearRut(paciente.rut) || paciente.pasaporte}</p>
            {edad !== null && <p className="text-sm text-slate-600">{edad} años</p>}
            <p className="text-sm text-slate-600">{paciente.telefonoPrincipal}</p>
            {paciente.email && <p className="text-sm text-slate-600">{paciente.email}</p>}
            <p className="text-sm text-slate-600">
              {paciente.prevision?.nombre ?? 'Sin previsión'}
              {paciente.convenio ? ` · Convenio ${paciente.convenio.nombre}` : ''}
            </p>
          </div>
          {presupuesto.profesional && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Profesional</p>
              <p className="font-medium text-slate-900">
                {presupuesto.profesional.nombres} {presupuesto.profesional.apellidos}
              </p>
              <p className="text-sm text-slate-600">{presupuesto.profesional.especialidad}</p>
              {presupuesto.profesional.registroSuperintendencia && (
                <p className="text-sm text-slate-600">Reg. {presupuesto.profesional.registroSuperintendencia}</p>
              )}
            </div>
          )}
        </section>

        <ContenedorTabla>
          <thead>
            <tr>
              <th>Detalle</th>
              <th>Pieza</th>
              <th className="text-right">Cant.</th>
              <th className="text-right">P. unitario</th>
              <th className="text-right">Dcto.</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-medium text-slate-800">{item.descripcion}</p>
                  <p className="text-xs text-slate-400">
                    {humanizar(item.tipo)}
                    {item.servicio && ` · ${item.servicio.codigo}`}
                    {item.producto && ` · ${item.producto.sku}`}
                    {!item.afectoIva && ' · exento de IVA'}
                  </p>
                </td>
                <td className="text-slate-600">{item.piezaDental ?? '—'}</td>
                <td className="text-right tabular-nums">{numero(item.cantidad, item.cantidad % 1 === 0 ? 0 : 2)}</td>
                <td className="text-right tabular-nums">{clp(item.precioUnitario)}</td>
                <td className="text-right tabular-nums text-rose-600">
                  {item.descuento > 0 ? `−${clp(item.descuento)}` : '—'}
                </td>
                <td className="text-right font-medium tabular-nums">{clp(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Total etiqueta="Subtotal" valor={clp(presupuesto.subtotal)} />
            {presupuesto.descuentoMonto > 0 && (
              <Total
                etiqueta={`Descuento${presupuesto.descuentoPorcentaje > 0 ? ` (${porcentaje(presupuesto.descuentoPorcentaje, 0)})` : ''}`}
                valor={`−${clp(presupuesto.descuentoMonto)}`}
                tono="rose"
              />
            )}
            <Total etiqueta="Neto" valor={clp(presupuesto.neto)} />
            <Total etiqueta={`IVA (${config?.ivaPorcentaje ?? 19}%)`} valor={clp(presupuesto.iva)} />
            <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{clp(presupuesto.total)}</dd>
            </div>
          </dl>
        </div>

        {presupuesto.observaciones && (
          <section className="mt-6 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{presupuesto.observaciones}</p>
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          <p>
            Emitido por {presupuesto.creadoPor ? `${presupuesto.creadoPor.nombres} ${presupuesto.creadoPor.apellidos}` : 'el sistema'}
            {' · '}
            {fechaCorta(presupuesto.createdAt)}
          </p>
          <p className="mt-1">
            Este presupuesto es una estimación. Los valores pueden variar si cambia el plan de tratamiento.
          </p>
        </footer>
      </div>

      <div className="no-imprimir mt-4 flex justify-center gap-2">
        <Link
          href={`/presupuestos/${id}?imprimir=1`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Vista de impresión
        </Link>
        <Badge tono="gris">Usa Ctrl/Cmd + P para imprimir o guardar como PDF</Badge>
      </div>
    </>
  );
}

function Total({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'rose' }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{etiqueta}</dt>
      <dd className={`tabular-nums ${tono === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>{valor}</dd>
    </div>
  );
}
