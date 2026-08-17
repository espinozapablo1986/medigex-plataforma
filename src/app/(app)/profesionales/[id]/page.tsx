import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import {
  DIAS_SEMANA,
  clp,
  fechaCorta,
  formatearRut,
  humanizar,
  isoFecha,
  porcentaje,
} from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  Definicion,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import {
  agregarArriendo,
  agregarDisponibilidad,
  agregarExcepcion,
  editarProfesional,
  eliminarArriendo,
  eliminarDisponibilidad,
  eliminarExcepcion,
} from '../acciones';
import { CamposProfesional } from '../campos';

const TIPOS_EXCEPCION = [
  { valor: 'BLOQUEO', texto: 'Bloqueo puntual' },
  { valor: 'VACACIONES', texto: 'Vacaciones' },
  { valor: 'FERIADO', texto: 'Feriado' },
  { valor: 'LICENCIA', texto: 'Licencia médica' },
  { valor: 'DISPONIBILIDAD_EXTRA', texto: 'Disponibilidad extra' },
];

const PERIODICIDADES = [
  { valor: 'MENSUAL', texto: 'Mensual' },
  { valor: 'QUINCENAL', texto: 'Quincenal' },
  { valor: 'SEMANAL', texto: 'Semanal' },
  { valor: 'DIARIA', texto: 'Diaria' },
  { valor: 'ANUAL', texto: 'Anual' },
];

export default async function PaginaProfesional({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('profesionales', 'ver');

  const profesional = await prisma.profesional.findUnique({
    where: { id },
    include: {
      usuario: { select: { email: true, activo: true } },
      disponibilidad: {
        where: { activo: true },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        include: { box: { select: { codigo: true, nombre: true } } },
      },
      excepciones: { orderBy: { fechaInicio: 'desc' }, take: 20 },
      arriendos: { orderBy: { vigenteDesde: 'desc' }, include: { box: true } },
      _count: { select: { citas: true, atenciones: true, recetas: true } },
    },
  });
  if (!profesional) notFound();

  const boxes = await prisma.box.findMany({
    where: { activo: true },
    orderBy: { codigo: 'asc' },
    select: { id: true, codigo: true, nombre: true },
  });

  const puedeEditar = puede(sesion, 'profesionales', 'editar');
  const hoy = isoFecha(new Date());

  const horasSemanales = profesional.disponibilidad.reduce((acc, b) => {
    const [hi, mi] = b.horaInicio.split(':').map(Number);
    const [hf, mf] = b.horaFin.split(':').map(Number);
    return acc + (hf * 60 + mf - (hi * 60 + mi)) / 60;
  }, 0);

  return (
    <>
      <EncabezadoPagina
        titulo={`${profesional.nombres} ${profesional.apellidos}`}
        descripcion={`${profesional.especialidad}${profesional.subespecialidad ? ` · ${profesional.subespecialidad}` : ''}`}
        volver={{ href: '/profesionales', texto: 'Profesionales' }}
        acciones={
          puedeEditar && (
            <Modal titulo="Editar profesional" etiquetaBoton="Editar ficha" varianteBoton="secundario">
              <Formulario accion={editarProfesional} className="space-y-4">
                <input type="hidden" name="id" value={profesional.id} />
                <CamposProfesional valores={profesional} />
                <div className="flex justify-end">
                  <BotonEnviar>Guardar cambios</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ── Disponibilidad recurrente ── */}
          <Tarjeta
            titulo="Disponibilidad semanal"
            descripcion={`${horasSemanales.toFixed(1)} horas a la semana en ${profesional.disponibilidad.length} bloque(s).`}
            acciones={
              puedeEditar && (
                <Modal titulo="Agregar bloque de disponibilidad" etiquetaBoton="Agregar bloque" tamanoBoton="sm">
                  <Formulario accion={agregarDisponibilidad} className="space-y-4">
                    <input type="hidden" name="profesionalId" value={profesional.id} />

                    <fieldset>
                      <legend className="etiqueta">Días de la semana *</legend>
                      <div className="flex flex-wrap gap-2">
                        {DIAS_SEMANA.map((dia, indice) => (
                          <label
                            key={dia}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-tinta-300 px-3 py-1.5 text-sm hover:bg-tinta-50"
                          >
                            <input
                              type="checkbox"
                              name="diaSemana"
                              value={indice}
                              className="h-4 w-4 rounded border-tinta-300 text-brand-600"
                            />
                            {dia}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <Grilla cols={2}>
                      <Campo etiqueta="Hora de inicio" requerido>
                        <input name="horaInicio" type="time" required defaultValue="09:00" className="campo" />
                      </Campo>
                      <Campo etiqueta="Hora de término" requerido>
                        <input name="horaFin" type="time" required defaultValue="13:00" className="campo" />
                      </Campo>
                      <Campo etiqueta="Duración de cada cupo (min)">
                        <input name="duracionSlot" type="number" min={5} step={5} defaultValue={30} className="campo" />
                      </Campo>
                      <Campo etiqueta="Box preferente">
                        <select name="boxId" className="campo">
                          <option value="">Sin box fijo</option>
                          {boxes.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.codigo} — {b.nombre}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo etiqueta="Vigente desde">
                        <input name="vigenteDesde" type="date" defaultValue={hoy} className="campo" />
                      </Campo>
                      <Campo etiqueta="Vigente hasta" ayuda="Opcional, para contratos temporales.">
                        <input name="vigenteHasta" type="date" className="campo" />
                      </Campo>
                    </Grilla>

                    <div className="flex justify-end">
                      <BotonEnviar>Agregar disponibilidad</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )
            }
          >
            {profesional.disponibilidad.length === 0 ? (
              <EstadoVacio
                titulo="Sin horarios configurados"
                descripcion="Agrega bloques de disponibilidad para que este profesional aparezca en la agenda."
              />
            ) : (
              <div className="space-y-3">
                {DIAS_SEMANA.map((dia, indice) => {
                  const bloques = profesional.disponibilidad.filter((b) => b.diaSemana === indice);
                  if (bloques.length === 0) return null;
                  return (
                    <div key={dia} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 shrink-0 text-sm font-medium text-tinta-700">{dia}</span>
                      {bloques.map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-tinta-200 bg-tinta-50 px-2.5 py-1 text-sm"
                        >
                          <span className="tabular-nums text-tinta-700">
                            {b.horaInicio}–{b.horaFin}
                          </span>
                          <span className="text-xs text-tinta-400">{b.duracionSlot} min</span>
                          {b.box && <Badge tono="azul">{b.box.codigo}</Badge>}
                          {b.vigenteHasta && (
                            <span className="text-xs text-amber-600">hasta {fechaCorta(b.vigenteHasta)}</span>
                          )}
                          {puedeEditar && (
                            <BotonEliminar
                              accion={eliminarDisponibilidad}
                              id={b.id}
                              texto="✕"
                              variante="fantasma"
                              mensaje="¿Eliminar este bloque de disponibilidad?"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Tarjeta>

          {/* ── Bloqueos ── */}
          <Tarjeta
            titulo="Bloqueos y ausencias"
            descripcion="Vacaciones, licencias y bloqueos puntuales que sacan horas de la agenda."
            acciones={
              puedeEditar && (
                <Modal titulo="Nuevo bloqueo" etiquetaBoton="Agregar bloqueo" tamanoBoton="sm" ancho="max-w-lg">
                  <Formulario accion={agregarExcepcion} className="space-y-4">
                    <input type="hidden" name="profesionalId" value={profesional.id} />
                    <Campo etiqueta="Tipo" requerido>
                      <select name="tipo" required className="campo">
                        {TIPOS_EXCEPCION.map((t) => (
                          <option key={t.valor} value={t.valor}>
                            {t.texto}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Grilla cols={2}>
                      <Campo etiqueta="Desde" requerido>
                        <input name="fechaInicio" type="datetime-local" required className="campo" />
                      </Campo>
                      <Campo etiqueta="Hasta" requerido>
                        <input name="fechaFin" type="datetime-local" required className="campo" />
                      </Campo>
                    </Grilla>
                    <label className="flex items-center gap-2 text-sm text-tinta-700">
                      <input type="checkbox" name="todoElDia" className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
                      Todo el día
                    </label>
                    <Campo etiqueta="Motivo">
                      <input name="motivo" className="campo" placeholder="Congreso, vacaciones…" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar>Guardar bloqueo</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )
            }
          >
            {profesional.excepciones.length === 0 ? (
              <p className="text-sm text-tinta-500">No hay bloqueos registrados.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Motivo</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {profesional.excepciones.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Badge tono={e.tipo === 'DISPONIBILIDAD_EXTRA' ? 'verde' : 'ambar'}>{humanizar(e.tipo)}</Badge>
                      </td>
                      <td className="text-tinta-600">{fechaCorta(e.fechaInicio)}</td>
                      <td className="text-tinta-600">{fechaCorta(e.fechaFin)}</td>
                      <td className="text-tinta-500">{e.motivo ?? '—'}</td>
                      {puedeEditar && (
                        <td className="text-right">
                          <BotonEliminar accion={eliminarExcepcion} id={e.id} texto="Eliminar" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>

          {/* ── Arriendo de box ── */}
          <Tarjeta
            titulo="Arriendo de box"
            descripcion="Se descuenta automáticamente en la liquidación del período."
            acciones={
              puedeEditar && (
                <Modal titulo="Registrar arriendo de box" etiquetaBoton="Agregar arriendo" tamanoBoton="sm" ancho="max-w-lg">
                  <Formulario accion={agregarArriendo} className="space-y-4">
                    <input type="hidden" name="profesionalId" value={profesional.id} />
                    <Campo etiqueta="Box" requerido>
                      <select name="boxId" required className="campo">
                        <option value="">Selecciona un box…</option>
                        {boxes.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.codigo} — {b.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Grilla cols={2}>
                      <Campo etiqueta="Monto (CLP)" requerido>
                        <input name="monto" type="number" min={1} step={1000} required className="campo" />
                      </Campo>
                      <Campo etiqueta="Periodicidad" requerido>
                        <select name="periodicidad" defaultValue="MENSUAL" required className="campo">
                          {PERIODICIDADES.map((p) => (
                            <option key={p.valor} value={p.valor}>
                              {p.texto}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo etiqueta="Vigente desde">
                        <input name="vigenteDesde" type="date" defaultValue={hoy} className="campo" />
                      </Campo>
                      <Campo etiqueta="Vigente hasta">
                        <input name="vigenteHasta" type="date" className="campo" />
                      </Campo>
                    </Grilla>
                    <Campo etiqueta="Observaciones">
                      <input name="observaciones" className="campo" />
                    </Campo>
                    <div className="flex justify-end">
                      <BotonEnviar>Registrar arriendo</BotonEnviar>
                    </div>
                  </Formulario>
                </Modal>
              )
            }
          >
            {profesional.arriendos.length === 0 ? (
              <p className="text-sm text-tinta-500">Este profesional no paga arriendo de box.</p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Box</th>
                    <th className="text-right">Monto</th>
                    <th>Periodicidad</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {profesional.arriendos.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-tinta-800">
                        {a.box.codigo} — {a.box.nombre}
                      </td>
                      <td className="text-right font-medium tabular-nums">{clp(a.monto)}</td>
                      <td className="text-tinta-600">{humanizar(a.periodicidad)}</td>
                      <td className="text-xs text-tinta-500">
                        {fechaCorta(a.vigenteDesde)} → {a.vigenteHasta ? fechaCorta(a.vigenteHasta) : 'indefinido'}
                      </td>
                      <td>{a.activo ? <Badge tono="verde">vigente</Badge> : <Badge tono="gris">terminado</Badge>}</td>
                      {puedeEditar && (
                        <td className="text-right">
                          <BotonEliminar accion={eliminarArriendo} id={a.id} texto="Eliminar" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Datos generales">
          <dl className="space-y-3">
            <Definicion termino="RUT">{formatearRut(profesional.rut)}</Definicion>
            <Definicion termino="Especialidad">{profesional.especialidad}</Definicion>
            <Definicion termino="Registro Superintendencia">{profesional.registroSuperintendencia}</Definicion>
            <Definicion termino="Correo">{profesional.email ?? profesional.usuario?.email}</Definicion>
            <Definicion termino="Teléfono">{profesional.telefono}</Definicion>
            <Definicion termino="Cuenta de acceso">
              {profesional.usuario ? (
                <Badge tono="verde">vinculada</Badge>
              ) : (
                <span className="text-tinta-500">sin cuenta de usuario</span>
              )}
            </Definicion>
            <Definicion termino="Modelo de pago">{humanizar(profesional.modeloPago)}</Definicion>
            <Definicion termino="Comisión general">{porcentaje(profesional.comisionPorcentaje)}</Definicion>
            {profesional.sueldoBase > 0 && (
              <Definicion termino="Sueldo base">{clp(profesional.sueldoBase)}</Definicion>
            )}
            <Definicion termino="Citas totales">{profesional._count.citas}</Definicion>
            <Definicion termino="Atenciones">{profesional._count.atenciones}</Definicion>
            <Definicion termino="Recetas emitidas">{profesional._count.recetas}</Definicion>
            <Definicion termino="Observaciones">{profesional.observaciones}</Definicion>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
