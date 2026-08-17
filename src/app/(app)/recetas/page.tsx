import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaCorta, humanizar } from '@/lib/format';
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

export const metadata = { title: 'Recetas' };

const POR_PAGINA = 30;

export default async function PaginaRecetas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; profesional?: string; tipo?: string; pagina?: string }>;
}) {
  const sesion = await requerirPermiso('recetas', 'ver');
  const { q, profesional, tipo, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);

  const where = {
    ...(profesional ? { profesionalId: profesional } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
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

  const [recetas, total, profesionales] = await Promise.all([
    prisma.receta.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, rut: true } },
        profesional: { select: { nombres: true, apellidos: true, especialidad: true } },
        items: { select: { id: true, medicamento: true } },
      },
    }),
    prisma.receta.count({ where }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (q) filtros.set('q', q);
  if (profesional) filtros.set('profesional', profesional);
  if (tipo) filtros.set('tipo', tipo);
  const base = `/recetas${filtros.toString() ? `?${filtros}` : ''}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Recetas"
        descripcion="Prescripciones digitales emitidas por los profesionales del centro."
        acciones={puede(sesion, 'recetas', 'crear') && <EnlaceBoton href="/recetas/nueva">Nueva receta</EnlaceBoton>}
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar paciente" className="w-64">
          <input name="q" defaultValue={q ?? ''} placeholder="Nombre o RUT" className="campo" />
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
        <Campo etiqueta="Tipo" className="w-44">
          <select name="tipo" defaultValue={tipo ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="SIMPLE">Simple</option>
            <option value="RETENIDA">Retenida</option>
            <option value="CHEQUE_MEDICO">Cheque médico</option>
            <option value="MAGISTRAL">Magistral</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {recetas.length === 0 ? (
        <EstadoVacio
          titulo="Sin recetas"
          descripcion="Las prescripciones emitidas quedarán registradas aquí y en la historia de cada paciente."
          accion={puede(sesion, 'recetas', 'crear') && <EnlaceBoton href="/recetas/nueva">Nueva receta</EnlaceBoton>}
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Profesional</th>
                <th>Tipo</th>
                <th>Medicamentos</th>
                <th>Vigencia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recetas.map((r) => {
                const vencida = r.vigenteHasta && r.vigenteHasta < new Date();
                return (
                  <tr key={r.id} className={r.anulada ? 'opacity-50' : ''}>
                    <td className="font-mono text-xs text-tinta-500">{r.folio}</td>
                    <td className="whitespace-nowrap text-tinta-600">{fechaCorta(r.fecha)}</td>
                    <td>
                      <Link href={`/pacientes/${r.paciente.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.paciente.nombres} {r.paciente.apellidoPaterno}
                      </Link>
                      <p className="text-xs text-tinta-400">{r.paciente.rut}</p>
                    </td>
                    <td className="text-xs text-tinta-600">
                      {r.profesional.nombres} {r.profesional.apellidos}
                      <p className="text-tinta-400">{r.profesional.especialidad}</p>
                    </td>
                    <td>
                      <Badge tono={r.tipo === 'RETENIDA' ? 'ambar' : 'gris'}>{humanizar(r.tipo)}</Badge>
                    </td>
                    <td className="max-w-xs text-xs text-tinta-600">
                      {r.items.map((i) => i.medicamento).join(', ')}
                    </td>
                    <td className="text-xs">
                      {r.anulada ? (
                        <Badge tono="rojo">anulada</Badge>
                      ) : vencida ? (
                        <Badge tono="ambar">vencida</Badge>
                      ) : (
                        <span className="text-tinta-500">
                          {r.vigenteHasta ? `hasta ${fechaCorta(r.vigenteHasta)}` : 'sin vencimiento'}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <EnlaceBoton href={`/recetas/${r.id}`} variante="secundario" tamano="sm">
                        Ver
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
