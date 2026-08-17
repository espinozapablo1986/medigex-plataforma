import { notFound } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import {
  calcularEdad,
  clp,
  fechaCorta,
  fechaHora,
  fechaLarga,
  formatearRut,
  humanizar,
  numero,
} from '@/lib/format';

import { Simbolo } from '@/components/marca';
import { BotonImprimir } from './boton-imprimir';

export const metadata = { title: 'Ficha del paciente' };

/**
 * Ficha completa en formato documento, pensada para imprimirse o guardarse
 * como PDF desde el navegador. Los bloques se pueden incluir o excluir con
 * parámetros de la URL para no imprimir 20 páginas cuando sólo se necesita
 * la portada.
 */
export default async function FichaImprimible({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historia?: string; examenes?: string; recetas?: string; cuenta?: string }>;
}) {
  const { id } = await params;
  const opciones = await searchParams;
  const sesion = await requerirPermiso('pacientes', 'ver');

  const incluir = {
    historia: opciones.historia !== '0' && puede(sesion, 'historia_clinica', 'ver'),
    examenes: opciones.examenes !== '0' && puede(sesion, 'historia_clinica', 'ver'),
    recetas: opciones.recetas !== '0' && puede(sesion, 'recetas', 'ver'),
    cuenta: opciones.cuenta !== '0' && puede(sesion, 'pagos', 'ver'),
  };

  const [paciente, config] = await Promise.all([
    prisma.paciente.findUnique({
      where: { id },
      include: {
        prevision: { select: { nombre: true, tipo: true } },
        convenio: { select: { nombre: true, tipo: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
        // Se carga todo y se decide al renderizar: un `include` condicional
        // haría que Prisma pierda los tipos de las relaciones anidadas, y el
        // volumen de un solo paciente no justifica esa complicación.
        atenciones: {
          orderBy: { fecha: 'desc' },
          include: { profesional: { select: { nombres: true, apellidos: true, especialidad: true } } },
        },
        examenes: {
          orderBy: { fechaSolicitud: 'desc' },
          include: { solicitadoPor: { select: { nombres: true, apellidos: true } } },
        },
        recetas: {
          orderBy: { fecha: 'desc' },
          include: {
            profesional: { select: { nombres: true, apellidos: true } },
            items: { orderBy: { orden: 'asc' } },
          },
        },
        movimientosCuenta: { orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }] },
        _count: { select: { adjuntos: true, citas: true } },
      },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!paciente) notFound();

  const edad = calcularEdad(paciente.fechaNacimiento, paciente.edadRegistrada);
  const saldo = paciente.movimientosCuenta[0]?.saldoResultante ?? 0;
  const emitida = new Date();

  return (
    <>
      {/* ── Barra de control, no se imprime ── */}
      <div className="no-imprimir mb-5">
        <Link
          href={`/pacientes/${id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-tinta-500 hover:text-brand-600"
        >
          ← Volver a la ficha
        </Link>

        <div className="tarjeta flex flex-wrap items-end justify-between gap-4 p-4">
          <div>
            <h1 className="text-lg font-semibold text-tinta-900">Ficha para imprimir</h1>
            <p className="text-sm text-tinta-500">
              Elige qué secciones incluir y usa el botón para imprimir o guardar como PDF.
            </p>
          </div>

          <form className="flex flex-wrap items-center gap-4">
            {[
              { campo: 'historia', texto: 'Historia clínica', visible: puede(sesion, 'historia_clinica', 'ver') },
              { campo: 'examenes', texto: 'Exámenes', visible: puede(sesion, 'historia_clinica', 'ver') },
              { campo: 'recetas', texto: 'Recetas', visible: puede(sesion, 'recetas', 'ver') },
              { campo: 'cuenta', texto: 'Estado de cuenta', visible: puede(sesion, 'pagos', 'ver') },
            ]
              .filter((o) => o.visible)
              .map((o) => (
                <label key={o.campo} className="flex items-center gap-1.5 text-sm text-tinta-600">
                  <input
                    type="checkbox"
                    name={o.campo}
                    value="1"
                    defaultChecked={incluir[o.campo as keyof typeof incluir]}
                    className="h-4 w-4 rounded border-tinta-300 text-brand-600"
                  />
                  {o.texto}
                </label>
              ))}
            {/* Los checkbox desmarcados no viajan; este campo asegura el "0". */}
            <input type="hidden" name="ajustado" value="1" />
            <button
              type="submit"
              className="h-9 rounded-lg border border-tinta-300 bg-white px-3 text-sm font-medium text-tinta-700 hover:bg-tinta-50"
            >
              Aplicar
            </button>
            <BotonImprimir />
          </form>
        </div>
      </div>

      {/* ── Documento ── */}
      <article className="tarjeta mx-auto max-w-4xl p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-tinta-800 pb-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-lg font-bold text-brand-900"><Simbolo tamano={26} />{config?.nombreClinica ?? 'MEDIGEX'}</h1>
            {config?.rut && <p className="text-sm text-tinta-600">RUT {formatearRut(config.rut)}</p>}
            <p className="text-sm text-tinta-600">
              {[config?.direccion, config?.comuna, config?.ciudad].filter(Boolean).join(', ')}
            </p>
            {config?.telefono && <p className="text-sm text-tinta-600">Teléfono {config.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-tinta-400">Ficha clínica</p>
            <p className="text-2xl font-bold text-tinta-900">Nº {paciente.numeroFicha}</p>
            <p className="text-xs text-tinta-500">Emitida el {fechaLarga(emitida)}</p>
          </div>
        </header>

        {paciente.alergias && (
          <div className="mb-6 rounded-lg border-2 border-rose-400 bg-rose-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Alergias</p>
            <p className="text-sm font-medium text-rose-900">{paciente.alergias}</p>
          </div>
        )}

        {/* ── Identificación ── */}
        <Seccion titulo="Identificación">
          <Rejilla>
            <Dato etiqueta="Nombre completo" valor={`${paciente.nombres} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno ?? ''}`} />
            <Dato etiqueta="RUT" valor={formatearRut(paciente.rut) || paciente.pasaporte || '—'} />
            <Dato etiqueta="Fecha de nacimiento" valor={fechaCorta(paciente.fechaNacimiento)} />
            <Dato etiqueta="Edad" valor={edad !== null ? `${edad} años` : '—'} />
            <Dato etiqueta="Sexo" valor={humanizar(paciente.sexo)} />
            <Dato etiqueta="Ocupación" valor={paciente.ocupacion ?? '—'} />
          </Rejilla>
        </Seccion>

        {/* ── Contacto ── */}
        <Seccion titulo="Contacto">
          <Rejilla>
            <Dato etiqueta="Teléfono principal" valor={paciente.telefonoPrincipal} />
            <Dato etiqueta="Teléfono secundario" valor={paciente.telefonoSecundario ?? '—'} />
            <Dato etiqueta="Correo" valor={paciente.email ?? '—'} />
            <Dato
              etiqueta="Dirección"
              valor={[paciente.direccion, paciente.comuna, paciente.ciudad].filter(Boolean).join(', ') || '—'}
            />
            <Dato
              etiqueta="Contacto de emergencia"
              valor={
                paciente.contactoEmergenciaNombre
                  ? `${paciente.contactoEmergenciaNombre} (${paciente.contactoEmergenciaRelacion ?? 'contacto'}) · ${paciente.contactoEmergenciaTelefono ?? ''}`
                  : '—'
              }
            />
          </Rejilla>
        </Seccion>

        {/* ── Previsión ── */}
        <Seccion titulo="Previsión y convenio">
          <Rejilla>
            <Dato etiqueta="Previsión" valor={paciente.prevision?.nombre ?? 'Sin registrar'} />
            <Dato etiqueta="Detalle" valor={paciente.previsionDetalle ?? '—'} />
            <Dato etiqueta="Convenio" valor={paciente.convenio?.nombre ?? 'Sin convenio'} />
            <Dato etiqueta="Nº de afiliado" valor={paciente.numeroAfiliado ?? '—'} />
          </Rejilla>
        </Seccion>

        {/* ── Procedencia ── */}
        {paciente.vieneDeOtroCentro && (
          <Seccion titulo="Derivación de origen">
            <Rejilla>
              <Dato etiqueta="Centro de origen" valor={paciente.centroOrigen ?? '—'} />
              <Dato etiqueta="Profesional que deriva" valor={paciente.profesionalOrigen ?? '—'} />
              <Dato etiqueta="Fecha" valor={fechaCorta(paciente.fechaDerivacion)} />
            </Rejilla>
            {paciente.motivoDerivacion && <Parrafo titulo="Motivo" texto={paciente.motivoDerivacion} />}
          </Seccion>
        )}

        {/* ── Antecedentes ── */}
        <Seccion titulo="Antecedentes de salud">
          <Parrafo titulo="Alergias" texto={paciente.alergias} />
          <Parrafo titulo="Medicamentos actuales" texto={paciente.medicamentosActuales} />
          <Parrafo titulo="Antecedentes médicos" texto={paciente.antecedentesMedicos} />
          <Parrafo titulo="Antecedentes quirúrgicos" texto={paciente.antecedentesQuirurgicos} />
          <Parrafo titulo="Observaciones" texto={paciente.observaciones} />
          {!paciente.alergias &&
            !paciente.medicamentosActuales &&
            !paciente.antecedentesMedicos &&
            !paciente.antecedentesQuirurgicos && (
              <p className="text-sm text-tinta-500">Sin antecedentes registrados.</p>
            )}
        </Seccion>

        {/* ── Historia clínica ── */}
        {incluir.historia && (
          <Seccion titulo={`Historia clínica (${paciente.atenciones.length} atenciones)`} saltoDePagina>
            {paciente.atenciones.length === 0 ? (
              <p className="text-sm text-tinta-500">Sin atenciones registradas.</p>
            ) : (
              <div className="space-y-4">
                {paciente.atenciones.map((a) => (
                  <div key={a.id} className="break-inside-avoid border-l-2 border-tinta-300 pl-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-tinta-900">{fechaHora(a.fecha)}</p>
                      <p className="text-xs text-tinta-500">
                        {a.profesional.nombres} {a.profesional.apellidos} · {a.profesional.especialidad}
                      </p>
                    </div>

                    <Parrafo titulo="Motivo de consulta" texto={a.motivoConsulta} />
                    <Parrafo titulo="Anamnesis" texto={a.anamnesis} />
                    <Parrafo titulo="Examen físico" texto={a.examenFisico} />
                    <Parrafo
                      titulo="Diagnóstico"
                      texto={[a.diagnostico, a.cie10 && `(CIE-10 ${a.cie10})`].filter(Boolean).join(' ') || null}
                    />
                    <Parrafo titulo="Tratamiento realizado" texto={a.tratamientoRealizado} />
                    <Parrafo titulo="Indicaciones" texto={a.indicaciones} />
                    <Parrafo titulo="Observaciones" texto={a.observaciones} />

                    {(a.presionArterial || a.frecuenciaCardiaca || a.temperatura || a.pesoKg || a.tallaCm) && (
                      <p className="mt-1 text-xs text-tinta-600">
                        <span className="font-semibold uppercase tracking-wide text-tinta-400">Signos vitales: </span>
                        {[
                          a.presionArterial && `PA ${a.presionArterial}`,
                          a.frecuenciaCardiaca && `FC ${a.frecuenciaCardiaca}`,
                          a.temperatura && `T° ${numero(a.temperatura, 1)}`,
                          a.saturacion && `Sat ${a.saturacion}%`,
                          a.pesoKg && `Peso ${numero(a.pesoKg, 1)} kg`,
                          a.tallaCm && `Talla ${numero(a.tallaCm, 0)} cm`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}

                    {a.proximoControl && (
                      <p className="mt-1 text-xs text-tinta-600">
                        Próximo control: {fechaCorta(a.proximoControl)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Seccion>
        )}

        {/* ── Exámenes ── */}
        {incluir.examenes && paciente.examenes.length > 0 && (
          <Seccion titulo={`Exámenes (${paciente.examenes.length})`} saltoDePagina>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tinta-300 text-left text-xs uppercase tracking-wide text-tinta-500">
                  <th className="py-1.5">Fecha</th>
                  <th>Examen</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {paciente.examenes.map((e) => (
                  <tr key={e.id} className="break-inside-avoid border-b border-tinta-100 align-top">
                    <td className="whitespace-nowrap py-1.5 text-tinta-600">{fechaCorta(e.fechaSolicitud)}</td>
                    <td className="text-tinta-800">
                      {e.nombre}
                      {e.solicitadoPor && (
                        <p className="text-xs text-tinta-400">
                          {e.solicitadoPor.nombres} {e.solicitadoPor.apellidos}
                        </p>
                      )}
                    </td>
                    <td className="text-tinta-600">{humanizar(e.tipo)}</td>
                    <td className="text-tinta-600">{humanizar(e.estado)}</td>
                    <td className="text-tinta-700">{e.resultado ?? 'Pendiente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}

        {/* ── Recetas ── */}
        {incluir.recetas && paciente.recetas.length > 0 && (
          <Seccion titulo={`Recetas emitidas (${paciente.recetas.length})`} saltoDePagina>
            <div className="space-y-3">
              {paciente.recetas.map((r) => (
                <div key={r.id} className="break-inside-avoid border-l-2 border-tinta-300 pl-4">
                  <p className="text-sm font-semibold text-tinta-900">
                    Nº {r.folio} · {fechaCorta(r.fecha)}
                    {r.anulada && <span className="ml-2 text-rose-600">(anulada)</span>}
                  </p>
                  <p className="text-xs text-tinta-500">
                    {humanizar(r.tipo)} · {r.profesional.nombres} {r.profesional.apellidos}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-tinta-700">
                    {r.items.map((i) => (
                      <li key={i.id}>
                        <strong>{i.medicamento}</strong>
                        {[i.dosis, i.frecuencia, i.duracion].filter(Boolean).length > 0 &&
                          ` — ${[i.dosis, i.frecuencia, i.duracion].filter(Boolean).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ── Cuenta corriente ── */}
        {incluir.cuenta && (
          <Seccion titulo="Estado de cuenta" saltoDePagina>
            <p className="mb-3 text-sm">
              Saldo actual:{' '}
              <strong className={saldo > 0 ? 'text-rose-700' : saldo < 0 ? 'text-emerald-700' : ''}>
                {saldo < 0 ? `${clp(Math.abs(saldo))} a favor del paciente` : clp(saldo)}
              </strong>
            </p>

            {paciente.movimientosCuenta.length === 0 ? (
              <p className="text-sm text-tinta-500">Sin movimientos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tinta-300 text-left text-xs uppercase tracking-wide text-tinta-500">
                    <th className="py-1.5">Fecha</th>
                    <th>Descripción</th>
                    <th className="text-right">Cargo</th>
                    <th className="text-right">Abono</th>
                    <th className="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {paciente.movimientosCuenta.map((m) => (
                    <tr key={m.id} className="border-b border-tinta-100">
                      <td className="whitespace-nowrap py-1.5 text-tinta-600">{fechaCorta(m.fecha)}</td>
                      <td className="text-tinta-700">{m.descripcion}</td>
                      <td className="text-right tabular-nums text-rose-700">{m.monto > 0 ? clp(m.monto) : ''}</td>
                      <td className="text-right tabular-nums text-emerald-700">
                        {m.monto < 0 ? clp(Math.abs(m.monto)) : ''}
                      </td>
                      <td className="text-right font-medium tabular-nums">{clp(m.saldoResultante)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Seccion>
        )}

        <footer className="mt-8 border-t border-tinta-200 pt-4 text-xs text-tinta-400">
          <p>
            Ficha Nº {paciente.numeroFicha} · creada el {fechaCorta(paciente.createdAt)}
            {paciente.creadoPor && ` por ${paciente.creadoPor.nombres} ${paciente.creadoPor.apellidos}`} ·{' '}
            {paciente._count.adjuntos} archivo(s) adjunto(s) en el sistema.
          </p>
          <p className="mt-1">
            Documento emitido por {sesion.nombres} {sesion.apellidos} el {fechaHora(emitida)}. Contiene información
            clínica sujeta a reserva conforme a la Ley 20.584 sobre derechos y deberes de los pacientes.
          </p>
        </footer>
      </article>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Piezas del documento
// ─────────────────────────────────────────────────────────────

function Seccion({
  titulo,
  children,
  saltoDePagina,
}: {
  titulo: string;
  children: React.ReactNode;
  saltoDePagina?: boolean;
}) {
  return (
    <section className={`mb-6 ${saltoDePagina ? 'break-before-page' : ''}`}>
      <h2 className="mb-2 border-b border-tinta-300 pb-1 text-sm font-bold uppercase tracking-widest text-tinta-600">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Rejilla({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">{children}</div>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-semibold text-tinta-500">{etiqueta}:</span>
      <span className="text-tinta-800">{valor}</span>
    </div>
  );
}

function Parrafo({ titulo, texto }: { titulo: string; texto?: string | null }) {
  if (!texto) return null;
  return (
    <div className="mt-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta-400">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm text-tinta-700">{texto}</p>
    </div>
  );
}
