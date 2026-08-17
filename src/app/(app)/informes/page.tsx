import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, humanizar, isoFecha } from '@/lib/format';
import {
  Aviso,
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
import { SelectorBuscable } from '@/components/selector';

import { emitirInforme } from '../convenios/acciones';

export const metadata = { title: 'Informes de beneficio' };

export default async function PaginaInformes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; paciente?: string }>;
}) {
  const sesion = await requerirPermiso('informes_beneficio', 'ver');
  const { estado, paciente: pacientePreseleccionado } = await searchParams;

  const [informes, pacientes, convenios, profesionales, agregado] = await Promise.all([
    prisma.informeBeneficio.findMany({
      where: estado ? { estado: estado as never } : {},
      orderBy: { fechaEmision: 'desc' },
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, rut: true } },
        convenio: { select: { nombre: true, tipo: true } },
        profesional: { select: { nombres: true, apellidos: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, rut: true, convenio: { select: { nombre: true } } },
    }),
    prisma.convenio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.informeBeneficio.aggregate({
      _sum: { totalPrestaciones: true, totalCobertura: true, totalPaciente: true },
      _count: true,
    }),
  ]);

  const puedeCrear = puede(sesion, 'informes_beneficio', 'crear');

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return (
    <>
      <EncabezadoPagina
        titulo="Informes de beneficio"
        descripcion="Certificados de prestaciones para que el paciente cobre su reembolso o bono en Isapre, Fonasa o seguro complementario."
        acciones={
          puedeCrear && (
            <Modal titulo="Emitir informe de prestaciones" etiquetaBoton="Emitir informe" ancho="max-w-2xl">
              <Formulario accion={emitirInforme} className="space-y-4">
                <Aviso tono="info">
                  El informe reúne todas las prestaciones <strong>ya pagadas</strong> del paciente en el período
                  seleccionado, con su valor, cobertura del convenio y copago.
                </Aviso>

                <Campo etiqueta="Paciente" requerido>
                  <SelectorBuscable
                    name="pacienteId"
                    opciones={pacientes.map((p) => ({
                      valor: p.id,
                      etiqueta: `${p.apellidoPaterno}, ${p.nombres}`,
                      detalle: `${p.rut ?? 'sin RUT'}${p.convenio ? ` · ${p.convenio.nombre}` : ''}`,
                      buscarPor: p.rut ?? '',
                    }))}
                    valorInicial={pacientePreseleccionado}
                    placeholder="Busca por nombre o RUT…"
                    permiteVacio={false}
                    requerido
                  />
                </Campo>

                <Grilla cols={2}>
                  <Campo etiqueta="Período desde" requerido>
                    <input name="periodoDesde" type="date" defaultValue={isoFecha(inicioMes)} required className="campo" />
                  </Campo>
                  <Campo etiqueta="Período hasta" requerido>
                    <input name="periodoHasta" type="date" defaultValue={isoFecha(hoy)} required className="campo" />
                  </Campo>
                  <Campo etiqueta="Convenio / aseguradora" ayuda="Por defecto se usa el del paciente.">
                    <select name="convenioId" className="campo">
                      <option value="">El del paciente</option>
                      {convenios.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Profesional tratante">
                    <select name="profesionalId" defaultValue={sesion.profesionalId ?? ''} className="campo">
                      <option value="">Sin especificar</option>
                      {profesionales.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.apellidos}, {p.nombres}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Diagnóstico">
                    <input name="diagnostico" className="campo" />
                  </Campo>
                  <Campo etiqueta="Código CIE-10">
                    <input name="cie10" className="campo" />
                  </Campo>
                </Grilla>

                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>

                <div className="flex justify-end">
                  <BotonEnviar>Emitir informe</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Informes emitidos" valor={String(agregado._count)} />
        <Metrica etiqueta="Prestaciones certificadas" valor={clp(agregado._sum.totalPrestaciones ?? 0)} />
        <Metrica etiqueta="Cobertura declarada" valor={clp(agregado._sum.totalCobertura ?? 0)} tono="positivo" />
        <Metrica etiqueta="Copago de pacientes" valor={clp(agregado._sum.totalPaciente ?? 0)} />
      </div>

      <form className="mb-4 flex items-end gap-3">
        <Campo etiqueta="Estado" className="w-52">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="EMITIDO">Emitido</option>
            <option value="PRESENTADO">Presentado a la aseguradora</option>
            <option value="APROBADO">Aprobado</option>
            <option value="PAGADO">Reembolso pagado</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {informes.length === 0 ? (
        <EstadoVacio
          titulo="Sin informes emitidos"
          descripcion="Emite un informe para que el paciente presente sus prestaciones a la Isapre o al seguro complementario."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Emisión</th>
                <th>Paciente</th>
                <th>Convenio</th>
                <th>Período</th>
                <th className="text-right">Prestaciones</th>
                <th className="text-right">Total</th>
                <th className="text-right">Cobertura</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {informes.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs text-slate-500">{i.folio}</td>
                  <td className="whitespace-nowrap text-slate-600">{fechaCorta(i.fechaEmision)}</td>
                  <td>
                    <Link href={`/pacientes/${i.paciente.id}`} className="font-medium text-brand-700 hover:underline">
                      {i.paciente.nombres} {i.paciente.apellidoPaterno}
                    </Link>
                    <p className="text-xs text-slate-400">{i.paciente.rut}</p>
                  </td>
                  <td className="text-xs text-slate-600">
                    {i.convenio?.nombre ?? '—'}
                    {i.convenio && <p className="text-slate-400">{humanizar(i.convenio.tipo)}</p>}
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-600">
                    {fechaCorta(i.periodoDesde)} → {fechaCorta(i.periodoHasta)}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{i._count.items}</td>
                  <td className="text-right font-medium tabular-nums">{clp(i.totalPrestaciones)}</td>
                  <td className="text-right tabular-nums text-emerald-600">{clp(i.totalCobertura)}</td>
                  <td>
                    <BadgeEstado estado={i.estado} />
                  </td>
                  <td className="text-right">
                    <Link href={`/informes/${i.id}`} className="text-sm text-brand-700 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
