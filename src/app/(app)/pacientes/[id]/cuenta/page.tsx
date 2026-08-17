import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { cargarPacienteConCabecera } from '@/lib/paciente';
import { clp, fechaCorta, humanizar } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  ContenedorTabla,
  EnlaceBoton,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';

import { CabeceraPaciente } from '../cabecera';

export default async function CuentaPaciente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('pacientes', 'ver');
  const { paciente, saldo, contadores } = await cargarPacienteConCabecera(id);

  const [movimientos, ventas, pagos] = await Promise.all([
    prisma.movimientoCuenta.findMany({
      where: { pacienteId: id },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        venta: { select: { id: true, folio: true } },
        pago: { select: { id: true, folio: true, formaPago: { select: { nombre: true } } } },
      },
    }),
    prisma.venta.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      include: { _count: { select: { items: true } } },
    }),
    prisma.pago.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: 'desc' },
      include: { formaPago: true, adjuntos: { select: { id: true, nombreOriginal: true } } },
    }),
  ]);

  const totalFacturado = ventas.filter((v) => v.estado !== 'ANULADA').reduce((acc, v) => acc + v.total, 0);
  const totalPagado = pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((acc, p) => acc + p.monto, 0);
  const puedeVerPagos = puede(sesion, 'pagos', 'ver');

  return (
    <>
      <CabeceraPaciente
        paciente={paciente}
        saldo={saldo}
        activo={`/pacientes/${id}/cuenta`}
        puedeEditar={puede(sesion, 'pacientes', 'editar')}
        contadores={contadores}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metrica etiqueta="Total facturado" valor={clp(totalFacturado)} />
        <Metrica etiqueta="Total pagado" valor={clp(totalPagado)} tono="positivo" />
        <Metrica
          etiqueta={saldo < 0 ? 'Saldo a favor' : 'Saldo pendiente'}
          valor={clp(Math.abs(saldo))}
          tono={saldo > 0 ? 'negativo' : saldo < 0 ? 'positivo' : 'neutro'}
          detalle={saldo > 0 ? 'El paciente debe este monto' : saldo < 0 ? 'A favor del paciente' : 'Cuenta al día'}
        />
      </div>

      <div className="space-y-5">
        <Tarjeta
          titulo="Cartola de movimientos"
          descripcion="Cargos por prestaciones y abonos por pagos, en orden cronológico inverso."
          sinPadding
          acciones={
            puede(sesion, 'ventas', 'crear') && (
              <EnlaceBoton href={`/ventas/nueva?paciente=${id}`} variante="secundario" tamano="sm">
                Nueva venta
              </EnlaceBoton>
            )
          }
        >
          {movimientos.length === 0 ? (
            <div className="p-4">
              <EstadoVacio titulo="Sin movimientos" descripcion="La cuenta del paciente aún no registra cargos ni abonos." />
            </div>
          ) : (
            <ContenedorTabla>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Documento</th>
                  <th className="text-right">Cargo</th>
                  <th className="text-right">Abono</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-slate-600">{fechaCorta(m.fecha)}</td>
                    <td>
                      <Badge tono={m.tipo === 'CARGO' ? 'ambar' : m.tipo === 'ABONO' ? 'verde' : 'gris'}>
                        {humanizar(m.tipo)}
                      </Badge>
                    </td>
                    <td className="text-slate-700">{m.descripcion}</td>
                    <td className="text-xs">
                      {m.venta && (
                        <Link href={`/ventas/${m.venta.id}`} className="text-brand-700 hover:underline">
                          Venta Nº {m.venta.folio}
                        </Link>
                      )}
                      {m.pago && (
                        <span className="text-slate-500">
                          Pago Nº {m.pago.folio} · {m.pago.formaPago.nombre}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-rose-600">{m.monto > 0 ? clp(m.monto) : ''}</td>
                    <td className="text-right tabular-nums text-emerald-600">
                      {m.monto < 0 ? clp(Math.abs(m.monto)) : ''}
                    </td>
                    <td className="text-right font-medium tabular-nums">{clp(m.saldoResultante)}</td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
        </Tarjeta>

        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta titulo="Ventas" sinPadding>
            {ventas.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin ventas registradas.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Fecha</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Saldo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/ventas/${v.id}`} className="text-brand-700 hover:underline">
                          {v.folio}
                        </Link>
                      </td>
                      <td className="text-slate-600">{fechaCorta(v.fecha)}</td>
                      <td className="text-right font-medium tabular-nums">{clp(v.total)}</td>
                      <td className="text-right tabular-nums">
                        {v.saldo > 0 ? <span className="text-rose-600">{clp(v.saldo)}</span> : clp(0)}
                      </td>
                      <td>
                        <BadgeEstado estado={v.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>

          {puedeVerPagos && (
            <Tarjeta titulo="Pagos recibidos" sinPadding>
              {pagos.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Sin pagos registrados.</p>
              ) : (
                <ContenedorTabla>
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Fecha</th>
                      <th>Forma de pago</th>
                      <th className="text-right">Monto</th>
                      <th>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((p) => (
                      <tr key={p.id} className={p.estado === 'ANULADO' ? 'opacity-50 line-through' : ''}>
                        <td className="text-slate-600">{p.folio}</td>
                        <td className="text-slate-600">{fechaCorta(p.fecha)}</td>
                        <td className="text-slate-700">
                          {p.formaPago.nombre}
                          {p.referencia && <p className="text-xs text-slate-400">{p.referencia}</p>}
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
                      </tr>
                    ))}
                  </tbody>
                </ContenedorTabla>
              )}
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
