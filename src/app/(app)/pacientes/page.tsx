import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { calcularEdad, clp, fechaCorta, formatearRut, humanizar } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EnlaceBoton,
  EstadoVacio,
  Paginador,
  Tarjeta,
} from '@/components/ui';

export const metadata = { title: 'Pacientes' };

const POR_PAGINA = 25;

export default async function PaginaPacientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; inactivos?: string; derivados?: string }>;
}) {
  const sesion = await requerirPermiso('pacientes', 'ver');
  const { q, pagina: paginaTexto, inactivos, derivados } = await searchParams;

  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);
  const busqueda = q?.trim();

  const where = {
    ...(inactivos === '1' ? {} : { activo: true }),
    ...(derivados === '1' ? { vieneDeOtroCentro: true } : {}),
    ...(busqueda
      ? {
          OR: [
            { nombres: { contains: busqueda, mode: 'insensitive' as const } },
            { apellidoPaterno: { contains: busqueda, mode: 'insensitive' as const } },
            { apellidoMaterno: { contains: busqueda, mode: 'insensitive' as const } },
            { rut: { contains: busqueda.replace(/[.\s]/g, ''), mode: 'insensitive' as const } },
            { telefonoPrincipal: { contains: busqueda } },
            { telefonoSecundario: { contains: busqueda } },
            { email: { contains: busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [pacientes, total] = await Promise.all([
    prisma.paciente.findMany({
      where,
      orderBy: [{ apellidoPaterno: 'asc' }, { nombres: 'asc' }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        convenio: { select: { nombre: true } },
        prevision: { select: { nombre: true } },
        movimientosCuenta: {
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { saldoResultante: true },
        },
        _count: { select: { atenciones: true, citas: true } },
      },
    }),
    prisma.paciente.count({ where }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (busqueda) filtros.set('q', busqueda);
  if (inactivos === '1') filtros.set('inactivos', '1');
  if (derivados === '1') filtros.set('derivados', '1');
  const base = `/pacientes${filtros.toString() ? `?${filtros}` : ''}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Pacientes"
        descripcion="Fichas de pacientes. Al ingresar uno nuevo se crea su ficha clínica automáticamente."
        acciones={
          puede(sesion, 'pacientes', 'crear') && <EnlaceBoton href="/pacientes/nuevo">Nuevo paciente</EnlaceBoton>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" className="w-72">
          <input
            name="q"
            defaultValue={busqueda ?? ''}
            placeholder="Nombre, RUT, teléfono o correo"
            className="campo"
          />
        </Campo>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="derivados" value="1" defaultChecked={derivados === '1'} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Sólo derivados
        </label>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={inactivos === '1'} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Incluir inactivos
        </label>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Buscar
        </button>
      </form>

      {pacientes.length === 0 ? (
        <EstadoVacio
          titulo={busqueda ? 'Sin resultados' : 'Aún no hay pacientes'}
          descripcion={
            busqueda
              ? `No se encontraron pacientes para "${busqueda}".`
              : 'Crea la primera ficha para empezar a agendar y registrar atenciones.'
          }
          accion={
            puede(sesion, 'pacientes', 'crear') && <EnlaceBoton href="/pacientes/nuevo">Nuevo paciente</EnlaceBoton>
          }
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Ficha</th>
                <th>Paciente</th>
                <th>RUT</th>
                <th className="text-right">Edad</th>
                <th>Teléfonos</th>
                <th>Previsión</th>
                <th className="text-right">Atenciones</th>
                <th className="text-right">Saldo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => {
                const saldo = p.movimientosCuenta[0]?.saldoResultante ?? 0;
                const edad = calcularEdad(p.fechaNacimiento, p.edadRegistrada);
                return (
                  <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                    <td className="font-mono text-xs text-slate-500">Nº {p.numeroFicha}</td>
                    <td>
                      <Link href={`/pacientes/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.apellidoPaterno} {p.apellidoMaterno ?? ''}, {p.nombres}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.vieneDeOtroCentro && <Badge tono="morado">derivado</Badge>}
                        {p.alergias && <Badge tono="rojo">alergias</Badge>}
                        {!p.activo && <Badge tono="gris">inactivo</Badge>}
                      </div>
                    </td>
                    <td className="text-slate-600">{formatearRut(p.rut) || p.pasaporte || '—'}</td>
                    <td className="text-right tabular-nums text-slate-600">{edad ?? '—'}</td>
                    <td className="text-xs text-slate-500">
                      <div>{p.telefonoPrincipal}</div>
                      {p.telefonoSecundario && <div>{p.telefonoSecundario}</div>}
                    </td>
                    <td className="text-xs text-slate-600">
                      {p.prevision?.nombre ?? '—'}
                      {p.convenio && <div className="text-brand-600">{p.convenio.nombre}</div>}
                    </td>
                    <td className="text-right tabular-nums text-slate-500">{p._count.atenciones}</td>
                    <td className="text-right font-medium tabular-nums">
                      {saldo > 0 ? (
                        <span className="text-rose-600">{clp(saldo)}</span>
                      ) : saldo < 0 ? (
                        <span className="text-emerald-600">{clp(Math.abs(saldo))} a favor</span>
                      ) : (
                        <span className="text-slate-400">{clp(0)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <EnlaceBoton href={`/pacientes/${p.id}`} variante="secundario" tamano="sm">
                        Ver ficha
                      </EnlaceBoton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
          <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} base={base} />
        </Tarjeta>
      )}
    </>
  );
}
