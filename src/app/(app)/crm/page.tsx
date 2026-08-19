import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import {
  controlesVencidos,
  cumpleanosDelMes,
  inasistenciasSinReagendar,
  pacientesSinVolver,
  presupuestosSinRespuesta,
  resumenCrm,
  saldosPendientes,
} from '@/lib/crm';
import { clp, fechaCorta, humanizar, isoFecha } from '@/lib/format';
import {
  Badge,
  Campo,
  EncabezadoPagina,
  EnlaceBoton,
  EstadoVacio,
  Grilla,
  Metrica,
  Pestanas,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SelectorBuscable } from '@/components/selector';

import { cancelarSeguimiento, completarSeguimiento, crearSeguimiento, posponerSeguimiento } from './acciones';
import { ListaRecall } from './listas';

export const metadata = { title: 'CRM y seguimiento' };

const LISTAS = [
  { clave: 'sin-volver', texto: 'No vuelven' },
  { clave: 'controles', texto: 'Controles vencidos' },
  { clave: 'presupuestos', texto: 'Presupuestos sin respuesta' },
  { clave: 'saldos', texto: 'Saldos por cobrar' },
  { clave: 'inasistencias', texto: 'No asistieron' },
  { clave: 'cumpleanos', texto: 'Cumpleaños del mes' },
] as const;

export default async function PaginaCrm({
  searchParams,
}: {
  searchParams: Promise<{ lista?: string; meses?: string }>;
}) {
  const sesion = await requerirPermiso('crm', 'ver');
  const { lista: listaActiva = 'sin-volver', meses } = await searchParams;
  const mesesSinVolver = Math.max(1, parseInt(meses ?? '6', 10) || 6);

  const [resumen, seguimientos, usuarios, pacientes, nombreClinica] = await Promise.all([
    resumenCrm(),
    prisma.seguimiento.findMany({
      where: { estado: { in: ['PENDIENTE', 'EN_CURSO'] } },
      orderBy: [{ fechaVencimiento: 'asc' }],
      take: 60,
      include: {
        paciente: { select: { id: true, nombres: true, apellidoPaterno: true, telefonoPrincipal: true } },
        contacto: { select: { id: true, nombre: true, telefono: true } },
        presupuesto: { select: { id: true, folio: true, total: true } },
        asignadoA: { select: { id: true, nombres: true, apellidos: true } },
      },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      select: { id: true, nombres: true, apellidoPaterno: true, rut: true },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' }, select: { nombreClinica: true } }),
  ]);

  const centro = nombreClinica?.nombreClinica ?? 'el centro';
  const opcionesUsuarios = usuarios.map((u) => ({ id: u.id, nombre: `${u.apellidos}, ${u.nombres}` }));

  // Sólo se consulta la lista que se está mirando.
  const datos = {
    'sin-volver': listaActiva === 'sin-volver' ? await pacientesSinVolver(mesesSinVolver) : [],
    controles: listaActiva === 'controles' ? await controlesVencidos() : [],
    presupuestos: listaActiva === 'presupuestos' ? await presupuestosSinRespuesta() : [],
    saldos: listaActiva === 'saldos' ? await saldosPendientes() : [],
    inasistencias: listaActiva === 'inasistencias' ? await inasistenciasSinReagendar() : [],
    cumpleanos: listaActiva === 'cumpleanos' ? await cumpleanosDelMes() : [],
  };

  const ahora = new Date();
  const vencidos = seguimientos.filter((s) => s.fechaVencimiento < ahora);
  const hoy = seguimientos.filter(
    (s) => s.fechaVencimiento >= ahora && s.fechaVencimiento < new Date(ahora.getTime() + 86_400_000),
  );
  const proximos = seguimientos.filter((s) => s.fechaVencimiento >= new Date(ahora.getTime() + 86_400_000));

  const puedeCrear = puede(sesion, 'crm', 'crear');
  const puedeEditar = puede(sesion, 'crm', 'editar');

  return (
    <>
      <EncabezadoPagina
        ayuda="crm"
        titulo="CRM y seguimiento"
        descripcion="Interesados, tareas de contacto y listas de pacientes que conviene recuperar."
        acciones={
          <div className="flex flex-wrap gap-2">
            <EnlaceBoton href="/crm/contactos" variante="secundario">
              Interesados
            </EnlaceBoton>
            {puedeCrear && (
              <Modal titulo="Nuevo seguimiento" etiquetaBoton="Nuevo seguimiento" ancho="max-w-xl">
                <Formulario accion={crearSeguimiento} className="space-y-4">
                  <Campo etiqueta="Título" requerido>
                    <input name="titulo" required className="campo" placeholder="Llamar para confirmar control" />
                  </Campo>
                  <Campo etiqueta="Paciente">
                    <SelectorBuscable
                      name="pacienteId"
                      opciones={pacientes.map((p) => ({
                        valor: p.id,
                        etiqueta: `${p.apellidoPaterno}, ${p.nombres}`,
                        detalle: p.rut ?? 'sin RUT',
                        buscarPor: p.rut ?? '',
                      }))}
                      placeholder="Busca un paciente…"
                      textoVacio="Sin paciente asociado"
                    />
                  </Campo>
                  <Grilla cols={2}>
                    <Campo etiqueta="Tipo">
                      <select name="tipo" defaultValue="OTRO" className="campo">
                        <option value="RECALL">Recuperación</option>
                        <option value="CONTROL">Control clínico</option>
                        <option value="PRESUPUESTO">Presupuesto</option>
                        <option value="COBRANZA">Cobranza</option>
                        <option value="POST_ATENCION">Post atención</option>
                        <option value="PROSPECTO">Prospecto</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </Campo>
                    <Campo etiqueta="Prioridad">
                      <select name="prioridad" defaultValue="NORMAL" className="campo">
                        <option value="BAJA">Baja</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ALTA">Alta</option>
                        <option value="URGENTE">Urgente</option>
                      </select>
                    </Campo>
                    <Campo etiqueta="Vence el" requerido>
                      <input
                        name="fechaVencimiento"
                        type="date"
                        required
                        defaultValue={isoFecha(new Date())}
                        className="campo"
                      />
                    </Campo>
                    <Campo etiqueta="Asignar a">
                      <select name="asignadoAId" defaultValue={sesion.usuarioId} className="campo">
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.apellidos}, {u.nombres}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </Grilla>
                  <Campo etiqueta="Descripción">
                    <textarea name="descripcion" rows={2} className="campo" />
                  </Campo>
                  <div className="flex justify-end">
                    <BotonEnviar>Agendar seguimiento</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Seguimientos vencidos"
          valor={String(resumen.seguimientosVencidos)}
          tono={resumen.seguimientosVencidos > 0 ? 'negativo' : 'positivo'}
          detalle={resumen.seguimientosVencidos > 0 ? 'Requieren atención hoy' : 'Todo al día'}
        />
        <Metrica etiqueta="Seguimientos abiertos" valor={String(resumen.seguimientosPendientes)} />
        <Metrica etiqueta="Interesados en gestión" valor={String(resumen.contactosAbiertos)} tono="marca" />
        <Metrica
          etiqueta="Convertidos este mes"
          valor={String(resumen.contactosConvertidosMes)}
          tono="positivo"
          detalle="Interesados que llegaron a ficha"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ── Tareas ── */}
        <div className="space-y-4 lg:col-span-2">
          <BloqueSeguimientos
            titulo="Vencidos"
            tono="rojo"
            seguimientos={vencidos}
            puedeEditar={puedeEditar}
            usuarios={usuarios}
          />
          <BloqueSeguimientos
            titulo="Para hoy"
            tono="ambar"
            seguimientos={hoy}
            puedeEditar={puedeEditar}
            usuarios={usuarios}
          />
          <BloqueSeguimientos
            titulo="Próximos"
            tono="gris"
            seguimientos={proximos}
            puedeEditar={puedeEditar}
            usuarios={usuarios}
          />
        </div>

        {/* ── Listas inteligentes ── */}
        <div className="lg:col-span-3">
          <Tarjeta
            titulo="Listas de recuperación"
            descripcion="Cruces automáticos sobre la agenda, la historia clínica y las ventas."
          >
            <Pestanas
              activo={`/crm?lista=${listaActiva}`}
              items={LISTAS.map((l) => ({ href: `/crm?lista=${l.clave}`, texto: l.texto }))}
            />

            {listaActiva === 'sin-volver' && (
              <>
                <form className="mb-3 flex items-end gap-2">
                  <input type="hidden" name="lista" value="sin-volver" />
                  <Campo etiqueta="Sin atención hace más de" className="w-40">
                    <select name="meses" defaultValue={String(mesesSinVolver)} className="campo">
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">12 meses</option>
                      <option value="24">24 meses</option>
                    </select>
                  </Campo>
                  <button
                    type="submit"
                    className="h-10 rounded-lg border border-tinta-300 bg-white px-3 text-sm font-medium text-tinta-700 hover:bg-tinta-50"
                  >
                    Aplicar
                  </button>
                </form>
                <ListaRecall
                  filas={datos['sin-volver']}
                  tipo="RECALL"
                  tituloTarea="Invitar a retomar atención"
                  usuarios={opcionesUsuarios}
                  vacio={`Ningún paciente lleva más de ${mesesSinVolver} meses sin atenderse.`}
                  plantilla={`Hola {nombre}, te saludamos de ${centro}. Vimos que ha pasado un tiempo desde tu última atención y queríamos saber cómo estás. ¿Te gustaría agendar una hora de control?`}
                />
              </>
            )}

            {listaActiva === 'controles' && (
              <ListaRecall
                filas={datos.controles}
                tipo="CONTROL"
                tituloTarea="Agendar control pendiente"
                usuarios={opcionesUsuarios}
                vacio="No hay controles indicados que estén vencidos."
                plantilla={`Hola {nombre}, te escribimos de ${centro}. Tu profesional dejó indicado un control que ya está pendiente. ¿Te acomoda que te agendemos una hora esta semana?`}
              />
            )}

            {listaActiva === 'saldos' && (
              <ListaRecall
                filas={datos.saldos}
                tipo="COBRANZA"
                tituloTarea="Gestionar saldo pendiente"
                usuarios={opcionesUsuarios}
                mostrarMonto
                vacio="No hay saldos pendientes con más de 15 días."
                plantilla={`Hola {nombre}, te contactamos de ${centro} por el saldo pendiente de tu atención ({monto}). ¿Podemos coordinar el pago?`}
              />
            )}

            {listaActiva === 'inasistencias' && (
              <ListaRecall
                filas={datos.inasistencias}
                tipo="RECALL"
                tituloTarea="Reagendar hora perdida"
                usuarios={opcionesUsuarios}
                vacio="Todas las horas perdidas del último mes ya fueron reagendadas."
                plantilla={`Hola {nombre}, te saludamos de ${centro}. Notamos que no pudiste asistir a tu hora. ¿Te ayudamos a reagendarla?`}
              />
            )}

            {listaActiva === 'presupuestos' && (
              <>
                {datos.presupuestos.length === 0 ? (
                  <EstadoVacio
                    titulo="Nada pendiente aquí"
                    descripcion="No hay presupuestos enviados esperando respuesta hace más de una semana."
                  />
                ) : (
                  <div className="scroll-fino max-h-[26rem] overflow-y-auto rounded-lg border border-tinta-200">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-tinta-50">
                        <tr className="border-b border-tinta-200 text-left text-xs uppercase tracking-wide text-tinta-500">
                          <th className="px-3 py-2">Nº</th>
                          <th>Paciente</th>
                          <th className="text-right">Total</th>
                          <th className="text-right">Días</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datos.presupuestos.map((p) => (
                          <tr key={p.presupuestoId} className="border-b border-tinta-100 last:border-0">
                            <td className="px-3 py-2">
                              <Link href={`/presupuestos/${p.presupuestoId}`} className="text-brand-700 hover:underline">
                                {p.folio}
                              </Link>
                            </td>
                            <td>
                              <Link href={`/pacientes/${p.pacienteId}`} className="font-medium text-tinta-800 hover:underline">
                                {p.nombre}
                              </Link>
                              <p className="text-xs text-tinta-400">{p.telefono}</p>
                            </td>
                            <td className="text-right font-medium tabular-nums">{clp(p.total)}</td>
                            <td className="text-right tabular-nums text-tinta-600">{p.dias}</td>
                            <td>
                              <Badge tono={p.estado === 'ENVIADO' ? 'azul' : 'gris'}>{humanizar(p.estado)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {listaActiva === 'cumpleanos' && (
              <>
                {datos.cumpleanos.length === 0 ? (
                  <EstadoVacio titulo="Sin cumpleaños este mes" descripcion="Ningún paciente activo cumple años este mes." />
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {datos.cumpleanos.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-tinta-200 px-3 py-2"
                      >
                        <div>
                          <Link href={`/pacientes/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                            {p.nombres} {p.apellidoPaterno}
                          </Link>
                          <p className="text-xs text-tinta-400">{p.telefonoPrincipal}</p>
                        </div>
                        <Badge tono="morado">día {p.dia}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Bloque de tareas
// ─────────────────────────────────────────────────────────────

type SeguimientoConRelaciones = Prisma.SeguimientoGetPayload<{
  include: {
    paciente: { select: { id: true; nombres: true; apellidoPaterno: true; telefonoPrincipal: true } };
    contacto: { select: { id: true; nombre: true; telefono: true } };
    presupuesto: { select: { id: true; folio: true; total: true } };
    asignadoA: { select: { id: true; nombres: true; apellidos: true } };
  };
}>[];

function BloqueSeguimientos({
  titulo,
  tono,
  seguimientos,
  puedeEditar,
  usuarios,
}: {
  titulo: string;
  tono: 'rojo' | 'ambar' | 'gris';
  seguimientos: SeguimientoConRelaciones;
  puedeEditar: boolean;
  usuarios: { id: string; nombres: string; apellidos: string }[];
}) {
  if (seguimientos.length === 0) return null;

  return (
    <Tarjeta
      titulo={`${titulo} (${seguimientos.length})`}
      sinPadding
      className={tono === 'rojo' ? 'border-rose-200' : tono === 'ambar' ? 'border-amber-200' : undefined}
    >
      <ul className="divide-y divide-tinta-100">
        {seguimientos.map((s) => (
          <li key={s.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-tinta-800">{s.titulo}</p>
                <p className="mt-0.5 text-xs text-tinta-500">
                  {fechaCorta(s.fechaVencimiento)}
                  {s.asignadoA && ` · ${s.asignadoA.nombres} ${s.asignadoA.apellidos}`}
                </p>
                {s.paciente && (
                  <Link
                    href={`/pacientes/${s.paciente.id}`}
                    className="text-xs text-brand-700 hover:underline"
                  >
                    {s.paciente.nombres} {s.paciente.apellidoPaterno} · {s.paciente.telefonoPrincipal}
                  </Link>
                )}
                {s.contacto && (
                  <Link href={`/crm/contactos/${s.contacto.id}`} className="text-xs text-brand-700 hover:underline">
                    {s.contacto.nombre} {s.contacto.telefono && `· ${s.contacto.telefono}`}
                  </Link>
                )}
                {s.presupuesto && (
                  <Link href={`/presupuestos/${s.presupuesto.id}`} className="block text-xs text-brand-700 hover:underline">
                    Presupuesto Nº {s.presupuesto.folio} · {clp(s.presupuesto.total)}
                  </Link>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tono={s.prioridad === 'URGENTE' ? 'rojo' : s.prioridad === 'ALTA' ? 'ambar' : 'gris'}>
                  {humanizar(s.tipo)}
                </Badge>
              </div>
            </div>

            {puedeEditar && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Modal
                  titulo="Completar seguimiento"
                  etiquetaBoton="Completar"
                  tamanoBoton="sm"
                  ancho="max-w-lg"
                >
                  <Formulario accion={completarSeguimiento} className="space-y-4">
                    <input type="hidden" name="id" value={s.id} />
                    <p className="text-sm text-tinta-600">{s.titulo}</p>
                    <Grilla cols={2}>
                      <Campo etiqueta="Canal usado">
                        <select name="canal" defaultValue="LLAMADA" className="campo">
                          <option value="LLAMADA">Llamada</option>
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="EMAIL">Correo</option>
                          <option value="PRESENCIAL">Presencial</option>
                        </select>
                      </Campo>
                      <Campo etiqueta="Volver a contactar el" ayuda="Opcional: crea el próximo seguimiento.">
                        <input name="proximoSeguimiento" type="date" className="campo" />
                      </Campo>
                    </Grilla>
                    <Campo etiqueta="Resultado" ayuda="Queda en la bitácora del paciente.">
                      <textarea
                        name="resultado"
                        rows={3}
                        className="campo"
                        placeholder="Agendó para el martes / no contesta / pidió llamar la próxima semana"
                      />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar variante="exito">Marcar completado</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>

                <form action={posponerSeguimiento}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dias" value="3" />
                  <button
                    type="submit"
                    className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs text-tinta-600 hover:bg-tinta-50"
                  >
                    +3 días
                  </button>
                </form>

                <BotonEliminar
                  accion={cancelarSeguimiento}
                  id={s.id}
                  texto="Cancelar"
                  mensaje="¿Cancelar este seguimiento?"
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
