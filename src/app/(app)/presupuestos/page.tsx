import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta } from '@/lib/format';
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

export const metadata = { title: 'Presupuestos' };

const POR_PAGINA = 25;

export default async function PaginaPresupuestos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; pagina?: string }>;
}) {
  const sesion = await requerirPermiso('presupuestos', 'ver');
  const { estado, q, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);

  const where = {
    ...(estado ? { estado: estado as never } : {}),
    ...(q
      ? {
          paciente: {
            OR: [
              { nombres: { contains: q, mode: 'insensitive' as const } },
              { apellidoPaterno: { contains: q, mode: 'insensitive' as const } },
              { rut: { contains: q.replace(/[.\s]/g, ''), mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [presupuestos, total, agregados] = await Promise.all([
    prisma.presupuesto.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, rut: true } },
        profesional: { select: { nombres: true, apellidos: true } },
        _count: { select: { items: true, ventas: true } },
      },
    }),
    prisma.presupuesto.count({ where }),
    prisma.presupuesto.groupBy({ by: ['estado'], _sum: { total: true }, _count: true }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (estado) filtros.set('estado', estado);
  if (q) filtros.set('q', q);
  const base = `/presupuestos${filtros.toString() ? `?${filtros}` : ''}`;

  const porEstado = (e: string) => agregados.find((a) => a.estado === e);
  const aceptados = porEstado('ACEPTADO');
  const enviados = porEstado('ENVIADO');
  const totalAceptado = aceptados?._sum.total ?? 0;
  const totalEnviado = enviados?._sum.total ?? 0;
  const tasaConversion =
    (aceptados?._count ?? 0) + (porEstado('RECHAZADO')?._count ?? 0) > 0
      ? Math.round(
          ((aceptados?._count ?? 0) / ((aceptados?._count ?? 0) + (porEstado('RECHAZADO')?._count ?? 0))) * 100,
        )
      : 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Presupuestos"
        descripcion="Propuestas de tratamiento con servicios e insumos para cada paciente."
        acciones={
          puede(sesion, 'presupuestos', 'crear') && (
            <EnlaceBoton href="/presupuestos/nuevo">Nuevo presupuesto</EnlaceBoton>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Presupuestos" valor={String(total)} />
        <Metrica etiqueta="Enviados sin respuesta" valor={clp(totalEnviado)} detalle={`${enviados?._count ?? 0} documentos`} tono="alerta" />
        <Metrica etiqueta="Aceptados" valor={clp(totalAceptado)} detalle={`${aceptados?._count ?? 0} documentos`} tono="positivo" />
        <Metrica etiqueta="Tasa de aceptación" valor={`${tasaConversion}%`} tono="marca" />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar paciente" className="w-64">
          <input name="q" defaultValue={q ?? ''} placeholder="Nombre o RUT" className="campo" />
        </Campo>
        <Campo etiqueta="Estado" className="w-48">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="ENVIADO">Enviado</option>
            <option value="ACEPTADO">Aceptado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="VENCIDO">Vencido</option>
            <option value="FACTURADO">Facturado</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {presupuestos.length === 0 ? (
        <EstadoVacio
          titulo="Sin presupuestos"
          descripcion="Arma el primer presupuesto con los servicios e insumos que recibirá el paciente."
          accion={
            puede(sesion, 'presupuestos', 'crear') && (
              <EnlaceBoton href="/presupuestos/nuevo">Nuevo presupuesto</EnlaceBoton>
            )
          }
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Paciente</th>
                <th>Profesional</th>
                <th>Fecha</th>
                <th>Válido hasta</th>
                <th className="text-right">Ítems</th>
                <th className="text-right">Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {presupuestos.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-slate-500">{p.folio}</td>
                  <td>
                    <Link href={`/pacientes/${p.paciente.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.paciente.nombres} {p.paciente.apellidoPaterno}
                    </Link>
                    <p className="text-xs text-slate-400">{p.paciente.rut}</p>
                  </td>
                  <td className="text-xs text-slate-600">
                    {p.profesional ? `${p.profesional.nombres} ${p.profesional.apellidos}` : '—'}
                  </td>
                  <td className="text-slate-600">{fechaCorta(p.fecha)}</td>
                  <td className="text-slate-600">{p.validoHasta ? fechaCorta(p.validoHasta) : '—'}</td>
                  <td className="text-right tabular-nums text-slate-500">{p._count.items}</td>
                  <td className="text-right font-medium tabular-nums">{clp(p.total)}</td>
                  <td>
                    <BadgeEstado estado={p.estado} />
                  </td>
                  <td className="text-right">
                    <EnlaceBoton href={`/presupuestos/${p.id}`} variante="secundario" tamano="sm">
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
