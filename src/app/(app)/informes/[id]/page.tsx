import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { calcularEdad, clp, fechaCorta, fechaLarga, formatearRut, humanizar, numero } from '@/lib/format';
import { BadgeEstado, ContenedorTabla, EncabezadoPagina, Tarjeta } from '@/components/ui';
import { Simbolo } from '@/components/marca';
import { BotonEliminar } from '@/components/formulario';

import { cambiarEstadoInforme, eliminarInforme } from '../../convenios/acciones';

const SIGUIENTES: Record<string, { estado: string; texto: string; clase: string }[]> = {
  EMITIDO: [
    { estado: 'PRESENTADO', texto: 'Marcar como presentado', clase: 'bg-brand-600 text-white hover:bg-brand-700' },
  ],
  PRESENTADO: [
    { estado: 'APROBADO', texto: 'Aprobado por la aseguradora', clase: 'bg-emerald-600 text-white hover:bg-emerald-700' },
    { estado: 'RECHAZADO', texto: 'Rechazado', clase: 'border border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50' },
  ],
  APROBADO: [
    { estado: 'PAGADO', texto: 'Reembolso pagado', clase: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  ],
};

export default async function DetalleInforme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('informes_beneficio', 'ver');

  const [informe, config] = await Promise.all([
    prisma.informeBeneficio.findUnique({
      where: { id },
      include: {
        paciente: { include: { prevision: { select: { nombre: true } } } },
        convenio: true,
        profesional: true,
        emitidoPor: { select: { nombres: true, apellidos: true } },
        items: { orderBy: { fecha: 'asc' } },
      },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!informe) notFound();

  const paciente = informe.paciente;
  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);
  const acciones = SIGUIENTES[informe.estado] ?? [];

  return (
    <>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo={`Informe de prestaciones Nº ${informe.folio}`}
          descripcion={`${paciente.nombres} ${paciente.apellidoPaterno} · emitido el ${fechaCorta(informe.fechaEmision)}`}
          volver={{ href: '/informes', texto: 'Informes de beneficio' }}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <BadgeEstado estado={informe.estado} />
              {puede(sesion, 'informes_beneficio', 'editar') &&
                acciones.map((a) => (
                  <form key={a.estado} action={cambiarEstadoInforme}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="estado" value={a.estado} />
                    <button type="submit" className={`rounded-lg px-3.5 py-2 text-sm font-medium ${a.clase}`}>
                      {a.texto}
                    </button>
                  </form>
                ))}
              {puede(sesion, 'informes_beneficio', 'anular') && (
                <BotonEliminar
                  accion={eliminarInforme}
                  id={id}
                  variante="peligro"
                  mensaje="¿Eliminar este informe? El paciente ya no podrá presentarlo."
                />
              )}
            </div>
          }
        />
      </div>

      {/* ── Documento imprimible ── */}
      <article className="tarjeta mx-auto max-w-4xl p-10">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-tinta-800 pb-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-lg font-bold text-brand-900"><Simbolo tamano={26} />{config?.nombreClinica ?? 'MEDIGEX'}</h1>
            {config?.rut && <p className="text-sm text-tinta-600">RUT {formatearRut(config.rut)}</p>}
            {config?.giro && <p className="text-sm text-tinta-600">{config.giro}</p>}
            <p className="text-sm text-tinta-600">
              {[config?.direccion, config?.comuna, config?.ciudad].filter(Boolean).join(', ')}
            </p>
            {config?.telefono && <p className="text-sm text-tinta-600">Teléfono {config.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-tinta-400">Informe de prestaciones</p>
            <p className="text-2xl font-bold text-tinta-900">Nº {informe.folio}</p>
            <p className="text-sm text-tinta-600">{fechaLarga(informe.fechaEmision)}</p>
          </div>
        </header>

        <p className="mb-6 text-sm leading-relaxed text-tinta-700">
          Se certifica que el paciente individualizado a continuación recibió en este centro las prestaciones de salud
          detalladas en el presente informe, entre el <strong>{fechaCorta(informe.periodoDesde)}</strong> y el{' '}
          <strong>{fechaCorta(informe.periodoHasta)}</strong>, y que dichas prestaciones se encuentran íntegramente
          pagadas.
        </p>

        <section className="mb-6 grid gap-x-8 gap-y-2 rounded-lg bg-tinta-50 p-4 sm:grid-cols-2">
          <Dato etiqueta="Paciente" valor={`${paciente.nombres} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno ?? ''}`} />
          <Dato etiqueta="RUT" valor={formatearRut(paciente.rut) || paciente.pasaporte || '—'} />
          <Dato etiqueta="Edad" valor={edad !== null ? `${edad} años` : '—'} />
          <Dato etiqueta="Previsión" valor={paciente.prevision?.nombre ?? 'Sin registrar'} />
          {informe.convenio && <Dato etiqueta="Convenio / aseguradora" valor={informe.convenio.nombre} />}
          {paciente.numeroAfiliado && <Dato etiqueta="Nº de afiliado / póliza" valor={paciente.numeroAfiliado} />}
          {informe.diagnostico && <Dato etiqueta="Diagnóstico" valor={informe.diagnostico} />}
          {informe.cie10 && <Dato etiqueta="Código CIE-10" valor={informe.cie10} />}
          {informe.profesional && (
            <Dato
              etiqueta="Profesional tratante"
              valor={`${informe.profesional.nombres} ${informe.profesional.apellidos} — ${informe.profesional.especialidad}`}
            />
          )}
        </section>

        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-tinta-500">Prestaciones</h2>
        <ContenedorTabla>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código</th>
              <th>Prestación</th>
              <th>Profesional</th>
              <th className="text-right">Cant.</th>
              <th className="text-right">Valor</th>
              <th className="text-right">Cobertura</th>
              <th className="text-right">Copago</th>
            </tr>
          </thead>
          <tbody>
            {informe.items.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap text-tinta-600">{fechaCorta(item.fecha)}</td>
                <td className="font-mono text-xs text-tinta-600">{item.codigoPrestacion ?? '—'}</td>
                <td className="text-tinta-800">{item.descripcion}</td>
                <td className="text-xs text-tinta-600">{item.profesional ?? '—'}</td>
                <td className="text-right tabular-nums">{numero(item.cantidad, item.cantidad % 1 === 0 ? 0 : 2)}</td>
                <td className="text-right font-medium tabular-nums">{clp(item.montoTotal)}</td>
                <td className="text-right tabular-nums text-emerald-700">{clp(item.montoCobertura)}</td>
                <td className="text-right tabular-nums">{clp(item.montoPaciente)}</td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Total prestaciones</dt>
              <dd className="tabular-nums text-tinta-800">{clp(informe.totalPrestaciones)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Cubierto por el convenio</dt>
              <dd className="tabular-nums text-emerald-600">{clp(informe.totalCobertura)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-tinta-800 pt-2 text-base font-bold">
              <dt>Pagado por el paciente</dt>
              <dd className="tabular-nums">{clp(informe.totalPaciente)}</dd>
            </div>
          </dl>
        </div>

        {informe.observaciones && (
          <section className="mt-6 rounded-lg bg-tinta-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-tinta-700">{informe.observaciones}</p>
          </section>
        )}

        <footer className="mt-12 flex items-end justify-between gap-6">
          <p className="max-w-sm text-xs text-tinta-400">
            Documento emitido para fines de reembolso ante la institución previsional o compañía de seguros del
            paciente. No constituye documento tributario.
          </p>
          <div className="w-64 text-center">
            <div className="border-t border-tinta-800 pt-1">
              {informe.profesional ? (
                <>
                  <p className="text-sm font-semibold text-tinta-900">
                    {informe.profesional.nombres} {informe.profesional.apellidos}
                  </p>
                  <p className="text-xs text-tinta-600">{informe.profesional.especialidad}</p>
                  {informe.profesional.registroSuperintendencia && (
                    <p className="text-xs text-tinta-600">Reg. Nº {informe.profesional.registroSuperintendencia}</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-tinta-900">{config?.nombreClinica ?? 'MEDIGEX'}</p>
              )}
            </div>
          </div>
        </footer>

        <p className="mt-6 text-xs text-tinta-400">
          Emitido por {informe.emitidoPor ? `${informe.emitidoPor.nombres} ${informe.emitidoPor.apellidos}` : 'el sistema'} ·{' '}
          {fechaCorta(informe.createdAt)}
        </p>
      </article>

      <p className="no-imprimir mt-4 text-center text-xs text-tinta-400">
        Usa Ctrl/Cmd + P para imprimir el informe o guardarlo como PDF y entregarlo al paciente.
      </p>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-semibold text-tinta-500">{etiqueta}:</span>
      <span className="text-tinta-800">{valor}</span>
    </div>
  );
}
