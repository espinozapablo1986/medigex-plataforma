import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { enlaceWhatsapp } from '@/lib/crm';
import { fechaCorta, fechaHora, formatearRut, humanizar, isoFecha } from '@/lib/format';
import {
  Aviso,
  Badge,
  Campo,
  Definicion,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import {
  cambiarEstadoContacto,
  convertirEnPaciente,
  crearSeguimiento,
  editarContacto,
  eliminarContacto,
  registrarInteraccion,
} from '../../acciones';

const ORIGENES = [
  { valor: 'RECOMENDACION', texto: 'Recomendación de un paciente' },
  { valor: 'INSTAGRAM', texto: 'Instagram' },
  { valor: 'FACEBOOK', texto: 'Facebook' },
  { valor: 'GOOGLE', texto: 'Búsqueda en Google' },
  { valor: 'SITIO_WEB', texto: 'Sitio web' },
  { valor: 'WHATSAPP', texto: 'WhatsApp' },
  { valor: 'PASABA_POR_FUERA', texto: 'Pasaba por fuera' },
  { valor: 'CONVENIO_EMPRESA', texto: 'Convenio de empresa' },
  { valor: 'DERIVACION', texto: 'Derivación' },
  { valor: 'CAMPANA', texto: 'Campaña publicitaria' },
  { valor: 'OTRO', texto: 'Otro' },
];

const EMBUDO = ['NUEVO', 'CONTACTADO', 'INTERESADO', 'AGENDADO', 'CONVERTIDO'];

export default async function DetalleContacto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('crm', 'ver');

  const [contacto, usuarios, config] = await Promise.all([
    prisma.contacto.findUnique({
      where: { id },
      include: {
        asignadoA: { select: { id: true, nombres: true, apellidos: true } },
        paciente: { select: { id: true, numeroFicha: true, nombres: true, apellidoPaterno: true } },
        interacciones: {
          orderBy: { fecha: 'desc' },
          include: { usuario: { select: { nombres: true, apellidos: true } } },
        },
        seguimientos: {
          orderBy: { fechaVencimiento: 'asc' },
          include: { asignadoA: { select: { nombres: true, apellidos: true } } },
        },
      },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' }, select: { nombreClinica: true } }),
  ]);
  if (!contacto) notFound();

  const puedeEditar = puede(sesion, 'crm', 'editar');
  const pendientes = contacto.seguimientos.filter((s) => ['PENDIENTE', 'EN_CURSO'].includes(s.estado));
  const centro = config?.nombreClinica ?? 'nuestro centro';

  return (
    <>
      <EncabezadoPagina
        titulo={contacto.nombre}
        descripcion={`Interesado desde el ${fechaCorta(contacto.createdAt)} · ${humanizar(contacto.origen)}`}
        volver={{ href: '/crm/contactos', texto: 'Interesados' }}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tono={contacto.estado === 'CONVERTIDO' ? 'verde' : contacto.estado === 'PERDIDO' ? 'rojo' : 'azul'}>
              {humanizar(contacto.estado)}
            </Badge>

            {contacto.telefono && (
              <a
                href={enlaceWhatsapp(
                  contacto.telefono,
                  `Hola ${contacto.nombre.split(' ')[0]}, te contactamos de ${centro}. ¿Cómo podemos ayudarte?`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                WhatsApp
              </a>
            )}

            {puedeEditar && (
              <Modal titulo="Editar interesado" etiquetaBoton="Editar" varianteBoton="secundario" ancho="max-w-xl">
                <Formulario accion={editarContacto} className="space-y-4">
                  <input type="hidden" name="id" value={contacto.id} />
                  <Grilla cols={2}>
                    <Campo etiqueta="Nombre" requerido>
                      <input name="nombre" defaultValue={contacto.nombre} required className="campo" />
                    </Campo>
                    <Campo etiqueta="Teléfono">
                      <input name="telefono" defaultValue={contacto.telefono ?? ''} className="campo" />
                    </Campo>
                    <Campo etiqueta="Correo">
                      <input name="email" type="email" defaultValue={contacto.email ?? ''} className="campo" />
                    </Campo>
                    <Campo etiqueta="RUT">
                      <input name="rut" defaultValue={contacto.rut ?? ''} className="campo" />
                    </Campo>
                    <Campo etiqueta="Origen">
                      <select name="origen" defaultValue={contacto.origen} className="campo">
                        {ORIGENES.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.texto}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Estado">
                      <select name="estado" defaultValue={contacto.estado} className="campo">
                        <option value="NUEVO">Nuevo</option>
                        <option value="CONTACTADO">Contactado</option>
                        <option value="INTERESADO">Interesado</option>
                        <option value="AGENDADO">Agendado</option>
                        <option value="PERDIDO">Perdido</option>
                      </select>
                    </Campo>
                    <Campo etiqueta="Responsable">
                      <select name="asignadoAId" defaultValue={contacto.asignadoAId ?? ''} className="campo">
                        <option value="">Sin asignar</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.apellidos}, {u.nombres}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </Grilla>
                  <Campo etiqueta="¿Qué busca?">
                    <input name="interes" defaultValue={contacto.interes ?? ''} className="campo" />
                  </Campo>
                  <Campo etiqueta="Motivo de pérdida" ayuda="Sólo se guarda si el estado es «perdido».">
                    <input name="motivoPerdida" defaultValue={contacto.motivoPerdida ?? ''} className="campo" />
                  </Campo>
                  <Campo etiqueta="Observaciones">
                    <textarea name="observaciones" rows={2} defaultValue={contacto.observaciones ?? ''} className="campo" />
                  </Campo>
                  <div className="flex justify-end">
                    <BotonEnviar>Guardar</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            )}

            {puede(sesion, 'crm', 'eliminar') && (
              <BotonEliminar accion={eliminarContacto} id={contacto.id} variante="peligro" />
            )}
          </div>
        }
      />

      {contacto.paciente ? (
        <div className="mb-4">
          <Aviso tono="exito" titulo="Ya es paciente">
            Se convirtió en la ficha Nº {contacto.paciente.numeroFicha}.{' '}
            <Link href={`/pacientes/${contacto.paciente.id}`} className="underline">
              Ver ficha de {contacto.paciente.nombres} {contacto.paciente.apellidoPaterno}
            </Link>
          </Aviso>
        </div>
      ) : (
        contacto.estado === 'PERDIDO' &&
        contacto.motivoPerdida && (
          <div className="mb-4">
            <Aviso tono="alerta" titulo="Interesado perdido">
              {contacto.motivoPerdida}
            </Aviso>
          </div>
        )
      )}

      {/* ── Embudo ── */}
      {!contacto.paciente && puedeEditar && (
        <Tarjeta titulo="Estado en el embudo" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {EMBUDO.filter((e) => e !== 'CONVERTIDO').map((e) => (
              <form key={e} action={cambiarEstadoContacto}>
                <input type="hidden" name="id" value={contacto.id} />
                <input type="hidden" name="estado" value={e} />
                <button
                  type="submit"
                  disabled={contacto.estado === e}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    contacto.estado === e
                      ? 'cursor-default bg-brand-600 text-white'
                      : 'border border-tinta-300 bg-white text-tinta-600 hover:bg-tinta-50'
                  }`}
                >
                  {humanizar(e)}
                </button>
              </form>
            ))}

            <Modal titulo="Convertir en paciente" etiquetaBoton="Convertir en paciente" varianteBoton="exito" tamanoBoton="sm">
              <Formulario accion={convertirEnPaciente} className="space-y-4">
                <input type="hidden" name="id" value={contacto.id} />
                <Aviso tono="info">
                  Se creará la ficha clínica con los datos que ya tenemos y quedará enlazada a este interesado, para
                  no perder de dónde vino. Después podrás completar el resto de la ficha.
                </Aviso>
                {!contacto.telefono && (
                  <Campo etiqueta="Teléfono" requerido ayuda="La ficha del paciente necesita un teléfono.">
                    <input name="telefono" required className="campo" />
                  </Campo>
                )}
                <div className="flex justify-end">
                  <BotonEnviar variante="exito">Crear ficha de paciente</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          </div>
        </Tarjeta>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ── Bitácora ── */}
          <Tarjeta
            titulo="Bitácora de contactos"
            descripcion="Todo lo que se ha conversado con esta persona."
            acciones={
              puede(sesion, 'crm', 'crear') && (
                <Modal titulo="Registrar interacción" etiquetaBoton="Registrar contacto" tamanoBoton="sm" ancho="max-w-lg">
                  <Formulario accion={registrarInteraccion} className="space-y-4">
                    <input type="hidden" name="contactoId" value={contacto.id} />
                    <Grilla cols={2}>
                      <Campo etiqueta="Canal" requerido>
                        <select name="canal" required className="campo">
                          <option value="LLAMADA">Llamada</option>
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="EMAIL">Correo</option>
                          <option value="PRESENCIAL">Presencial</option>
                          <option value="INSTAGRAM">Instagram</option>
                          <option value="SMS">SMS</option>
                        </select>
                      </Campo>
                      <Campo etiqueta="Sentido">
                        <select name="sentido" defaultValue="SALIENTE" className="campo">
                          <option value="SALIENTE">Nosotros contactamos</option>
                          <option value="ENTRANTE">Nos contactaron</option>
                        </select>
                      </Campo>
                    </Grilla>
                    <Campo etiqueta="Asunto" requerido>
                      <input name="asunto" required className="campo" placeholder="Consulta por valor de implante" />
                    </Campo>
                    <Campo etiqueta="Resultado">
                      <input name="resultado" className="campo" placeholder="Pide que lo llamen el lunes" />
                    </Campo>
                    <Campo etiqueta="Detalle">
                      <textarea name="detalle" rows={3} className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar>Registrar</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )
            }
          >
            {contacto.interacciones.length === 0 ? (
              <EstadoVacio
                titulo="Sin contactos registrados"
                descripcion="Registra cada llamada o mensaje para que cualquiera del equipo sepa en qué quedó la conversación."
              />
            ) : (
              <ol className="space-y-3">
                {contacto.interacciones.map((i) => (
                  <li key={i.id} className="border-l-2 border-tinta-200 pl-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-tinta-800">{i.asunto}</p>
                      <span className="text-xs text-tinta-400">{fechaHora(i.fecha)}</span>
                    </div>
                    <p className="text-xs text-tinta-500">
                      <Badge tono="gris">{humanizar(i.canal)}</Badge>{' '}
                      {i.sentido === 'ENTRANTE' ? 'nos contactaron' : 'contactamos'}
                      {i.usuario && ` · ${i.usuario.nombres} ${i.usuario.apellidos}`}
                    </p>
                    {i.resultado && <p className="mt-1 text-sm text-tinta-700">{i.resultado}</p>}
                    {i.detalle && <p className="mt-0.5 whitespace-pre-wrap text-xs text-tinta-500">{i.detalle}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>

          {/* ── Seguimientos ── */}
          <Tarjeta
            titulo="Seguimientos"
            acciones={
              puede(sesion, 'crm', 'crear') && (
                <Modal titulo="Nuevo seguimiento" etiquetaBoton="Agendar seguimiento" tamanoBoton="sm" ancho="max-w-lg">
                  <Formulario accion={crearSeguimiento} className="space-y-4">
                    <input type="hidden" name="contactoId" value={contacto.id} />
                    <input type="hidden" name="tipo" value="PROSPECTO" />
                    <Campo etiqueta="Título" requerido>
                      <input
                        name="titulo"
                        required
                        defaultValue={`Contactar a ${contacto.nombre}`}
                        className="campo"
                      />
                    </Campo>
                    <Grilla cols={2}>
                      <Campo etiqueta="Vence el" requerido>
                        <input
                          name="fechaVencimiento"
                          type="date"
                          required
                          defaultValue={isoFecha(new Date())}
                          className="campo"
                        />
                      </Campo>
                      <Campo etiqueta="Prioridad">
                        <select name="prioridad" defaultValue="NORMAL" className="campo">
                          <option value="BAJA">Baja</option>
                          <option value="NORMAL">Normal</option>
                          <option value="ALTA">Alta</option>
                          <option value="URGENTE">Urgente</option>
                        </select>
                      </Campo>
                    </Grilla>
                    <Campo etiqueta="Asignar a">
                      <select name="asignadoAId" defaultValue={contacto.asignadoAId ?? sesion.usuarioId} className="campo">
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.apellidos}, {u.nombres}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Descripción">
                      <textarea name="descripcion" rows={2} className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar>Agendar</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )
            }
          >
            {contacto.seguimientos.length === 0 ? (
              <p className="text-sm text-tinta-500">Sin seguimientos agendados.</p>
            ) : (
              <ul className="space-y-2">
                {contacto.seguimientos.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-tinta-200 px-3 py-2">
                    <div>
                      <p className="text-sm text-tinta-800">{s.titulo}</p>
                      <p className="text-xs text-tinta-500">
                        {fechaCorta(s.fechaVencimiento)}
                        {s.asignadoA && ` · ${s.asignadoA.nombres} ${s.asignadoA.apellidos}`}
                        {s.resultado && ` · ${s.resultado}`}
                      </p>
                    </div>
                    <Badge
                      tono={
                        s.estado === 'COMPLETADO'
                          ? 'verde'
                          : s.estado === 'CANCELADO'
                            ? 'gris'
                            : s.fechaVencimiento < new Date()
                              ? 'rojo'
                              : 'ambar'
                      }
                    >
                      {humanizar(s.estado)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Datos del interesado">
          <dl className="space-y-3">
            <Definicion termino="Teléfono">{contacto.telefono}</Definicion>
            <Definicion termino="Correo">{contacto.email}</Definicion>
            <Definicion termino="RUT">{formatearRut(contacto.rut)}</Definicion>
            <Definicion termino="Origen">{humanizar(contacto.origen)}</Definicion>
            <Definicion termino="Qué busca">{contacto.interes}</Definicion>
            <Definicion termino="Responsable">
              {contacto.asignadoA ? `${contacto.asignadoA.nombres} ${contacto.asignadoA.apellidos}` : null}
            </Definicion>
            <Definicion termino="Contactos registrados">{String(contacto.interacciones.length)}</Definicion>
            <Definicion termino="Seguimientos abiertos">{String(pendientes.length)}</Definicion>
            <Definicion termino="Registrado">{fechaCorta(contacto.createdAt)}</Definicion>
            {contacto.convertidoAt && (
              <Definicion termino="Convertido">{fechaCorta(contacto.convertidoAt)}</Definicion>
            )}
            <Definicion termino="Observaciones">{contacto.observaciones}</Definicion>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
