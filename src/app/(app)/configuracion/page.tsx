import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { DIAS_SEMANA, fechaHora, humanizar, porcentaje } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import {
  alternarActivoPrevision,
  eliminarPrevision,
  guardarConfiguracion,
  guardarPrevision,
} from './acciones';
import { alternarActivoFormaPago, guardarFormaPago } from '../ventas/acciones';
import {
  alternarActivoCondicion,
  guardarCondicionDental,
} from '../pacientes/[id]/odontograma/acciones';

export const metadata = { title: 'Configuración' };

const TIPOS_PAGO = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'DEBITO', texto: 'Tarjeta de débito' },
  { valor: 'CREDITO', texto: 'Tarjeta de crédito' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia bancaria' },
  { valor: 'CHEQUE', texto: 'Cheque' },
  { valor: 'CONVENIO', texto: 'Convenio' },
  { valor: 'ISAPRE', texto: 'Bono Isapre' },
  { valor: 'FONASA', texto: 'Bono Fonasa' },
  { valor: 'GIFTCARD', texto: 'Gift card' },
  { valor: 'OTRO', texto: 'Otro' },
];

export default async function PaginaConfiguracion() {
  const sesion = await requerirPermiso('configuracion', 'ver');

  const [config, formasPago, previsiones, condicionesDentales, serviciosDisponibles, auditoria] = await Promise.all([
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
    prisma.formaPago.findMany({ orderBy: [{ activo: 'desc' }, { orden: 'asc' }, { nombre: 'asc' }] }),
    prisma.prevision.findMany({
      orderBy: [{ activo: 'desc' }, { orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { pacientes: true } } },
    }),
    prisma.condicionDental.findMany({
      orderBy: [{ activo: 'desc' }, { categoria: 'asc' }, { orden: 'asc' }],
      include: { servicio: { select: { nombre: true } }, _count: { select: { registros: true } } },
    }),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.registroAuditoria.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { usuario: { select: { nombres: true, apellidos: true } } },
    }),
  ]);

  const puedeEditar = puede(sesion, 'configuracion', 'editar');
  const diasActivos = (config?.diasHabiles ?? '1,2,3,4,5,6').split(',');

  const camposFormaPago = (f?: (typeof formasPago)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={f?.nombre} required className="campo" placeholder="Transferencia Banco Estado" />
        </Campo>
        <Campo etiqueta="Tipo" requerido>
          <select name="tipo" defaultValue={f?.tipo ?? 'EFECTIVO'} required className="campo">
            {TIPOS_PAGO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Comisión de la transacción (%)" ayuda="Costo que cobra el medio de pago, ej. 1,5% en tarjetas.">
          <input
            name="comisionPorcentaje"
            type="number"
            min={0}
            max={100}
            step={0.1}
            defaultValue={f?.comisionPorcentaje ?? 0}
            className="campo"
          />
        </Campo>
        <Campo etiqueta="Cuenta contable">
          <input name="cuentaContable" defaultValue={f?.cuentaContable ?? ''} className="campo" />
        </Campo>
      </Grilla>
      <fieldset className="mt-4 space-y-2">
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="requiereComprobante"
            defaultChecked={f?.requiereComprobante ?? false}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Exigir adjuntar comprobante al registrar el pago
        </label>
        <label className="flex items-center gap-2 text-sm text-tinta-700">
          <input
            type="checkbox"
            name="requiereReferencia"
            defaultChecked={f?.requiereReferencia ?? false}
            className="h-4 w-4 rounded border-tinta-300 text-brand-600"
          />
          Exigir número de operación o referencia
        </label>
      </fieldset>
    </>
  );

  const camposPrevision = (p?: (typeof previsiones)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={p?.nombre} required className="campo" placeholder="Isapre Colmena" />
        </Campo>
        <Campo etiqueta="Código" ayuda="Se genera desde el nombre si lo dejas vacío.">
          <input name="codigo" defaultValue={p?.codigo ?? ''} className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Tipo" requerido ayuda="Agrupa la previsión en los reportes.">
          <select name="tipo" defaultValue={p?.tipo ?? 'ISAPRE'} required className="campo">
            <option value="PARTICULAR">Particular</option>
            <option value="FONASA">Fonasa</option>
            <option value="ISAPRE">Isapre</option>
            <option value="SEGURO_COMPLEMENTARIO">Seguro complementario</option>
            <option value="OTRO">Otro</option>
          </select>
        </Campo>
        <Campo etiqueta="Orden en la lista" ayuda="Menor número aparece primero.">
          <input name="orden" type="number" min={0} defaultValue={p?.orden ?? 50} className="campo" />
        </Campo>
      </Grilla>

      <label className="mt-4 flex items-center gap-2 text-sm text-tinta-700">
        <input
          type="checkbox"
          name="requiereDetalle"
          defaultChecked={p?.requiereDetalle ?? false}
          className="h-4 w-4 rounded border-tinta-300 text-brand-600"
        />
        Pedir un dato adicional al elegirla
      </label>

      <Campo
        etiqueta="Qué dato pedir"
        ayuda="Aparece como ayuda en la ficha del paciente. Ej: «Nº de plan», «Tramo»."
        className="mt-4"
      >
        <input name="etiquetaDetalle" defaultValue={p?.etiquetaDetalle ?? ''} className="campo" />
      </Campo>
    </>
  );

  const camposCondicion = (c?: (typeof condicionesDentales)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={c?.nombre} required className="campo" placeholder="Caries" />
        </Campo>
        <Campo etiqueta="Código" ayuda="Se genera desde el nombre si lo dejas vacío.">
          <input name="codigo" defaultValue={c?.codigo ?? ''} className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Tipo" requerido>
          <select name="categoria" defaultValue={c?.categoria ?? 'DIAGNOSTICO'} required className="campo">
            <option value="DIAGNOSTICO">Diagnóstico — lo que se encuentra</option>
            <option value="PROCEDIMIENTO">Procedimiento — lo que se hace</option>
          </select>
        </Campo>
        <Campo etiqueta="Color en el esquema">
          <input name="color" type="color" defaultValue={c?.color ?? '#B94642'} className="campo h-10 p-1" />
        </Campo>
        <Campo etiqueta="Servicio asociado" ayuda="Permite armar el presupuesto desde el odontograma.">
          <select name="servicioId" defaultValue={c?.servicioId ?? ''} className="campo">
            <option value="">Sin vincular</option>
            {serviciosDisponibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Orden en la paleta">
          <input name="orden" type="number" min={0} defaultValue={c?.orden ?? 50} className="campo" />
        </Campo>
      </Grilla>

      <label className="mt-4 flex items-center gap-2 text-sm text-brand-900">
        <input
          type="checkbox"
          name="porCara"
          defaultChecked={c?.porCara ?? true}
          className="h-4 w-4 border-tinta-300 text-brand-600"
        />
        Se marca sobre caras concretas (si no, cubre la pieza completa)
      </label>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        ayuda="configuracion"
        titulo="Configuración"
        descripcion="Datos del centro, parámetros tributarios, horarios, previsiones y formas de pago."
      />

      <div className="space-y-5">
        <Formulario accion={guardarConfiguracion} className="space-y-5">
          <Tarjeta titulo="Datos del centro" descripcion="Aparecen en presupuestos, recetas e informes.">
            <Grilla cols={2}>
              <Campo etiqueta="Nombre del centro" requerido>
                <input
                  name="nombreClinica"
                  defaultValue={config?.nombreClinica ?? ''}
                  required
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="RUT">
                <input name="rut" defaultValue={config?.rut ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Giro">
                <input
                  name="giro"
                  defaultValue={config?.giro ?? ''}
                  disabled={!puedeEditar}
                  placeholder="Servicios odontológicos"
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="Teléfono">
                <input name="telefono" defaultValue={config?.telefono ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Dirección">
                <input name="direccion" defaultValue={config?.direccion ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Comuna">
                <input name="comuna" defaultValue={config?.comuna ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Ciudad">
                <input name="ciudad" defaultValue={config?.ciudad ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Correo">
                <input name="email" type="email" defaultValue={config?.email ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Sitio web">
                <input name="sitioWeb" defaultValue={config?.sitioWeb ?? ''} disabled={!puedeEditar} className="campo" />
              </Campo>
            </Grilla>
          </Tarjeta>

          <Tarjeta titulo="Parámetros tributarios y de agenda">
            <Grilla cols={3}>
              <Campo etiqueta="IVA (%)" ayuda="Se usa para desglosar el neto de ventas y gastos.">
                <input
                  name="ivaPorcentaje"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  defaultValue={config?.ivaPorcentaje ?? 19}
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="Moneda">
                <input name="moneda" defaultValue={config?.moneda ?? 'CLP'} disabled={!puedeEditar} className="campo" />
              </Campo>
              <Campo etiqueta="Zona horaria">
                <input
                  name="zonaHoraria"
                  defaultValue={config?.zonaHoraria ?? 'America/Santiago'}
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="Hora de apertura">
                <input
                  name="horaApertura"
                  type="time"
                  defaultValue={config?.horaApertura ?? '08:00'}
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="Hora de cierre">
                <input
                  name="horaCierre"
                  type="time"
                  defaultValue={config?.horaCierre ?? '20:00'}
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
              <Campo etiqueta="Duración por defecto del cupo (min)">
                <input
                  name="duracionSlotDefecto"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={config?.duracionSlotDefecto ?? 30}
                  disabled={!puedeEditar}
                  className="campo"
                />
              </Campo>
            </Grilla>

            <fieldset className="mt-4">
              <legend className="etiqueta">Días hábiles</legend>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia, indice) => (
                  <label
                    key={dia}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-tinta-300 px-3 py-1.5 text-sm hover:bg-tinta-50"
                  >
                    <input
                      type="checkbox"
                      name="diasHabiles"
                      value={indice}
                      defaultChecked={diasActivos.includes(String(indice))}
                      disabled={!puedeEditar}
                      className="h-4 w-4 rounded border-tinta-300 text-brand-600"
                    />
                    {dia}
                  </label>
                ))}
              </div>
            </fieldset>
          </Tarjeta>

          {puedeEditar && (
            <div className="flex justify-end">
              <BotonEnviar>Guardar configuración</BotonEnviar>
            </div>
          )}
        </Formulario>

        <Tarjeta
          titulo="Formas de pago"
          descripcion="Definen qué se puede exigir al cobrar: comprobante, número de operación, etc."
          sinPadding
          acciones={
            puedeEditar && (
              <Modal titulo="Nueva forma de pago" etiquetaBoton="Nueva forma de pago" tamanoBoton="sm" ancho="max-w-xl">
                <Formulario accion={guardarFormaPago} className="space-y-4">
                  {camposFormaPago()}
                  <div className="flex justify-end">
                    <BotonEnviar>Crear</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            )
          }
        >
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th className="text-right">Comisión</th>
                <th>Exige</th>
                <th>Estado</th>
                {puedeEditar && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {formasPago.map((f) => (
                <tr key={f.id} className={f.activo ? '' : 'opacity-60'}>
                  <td className="font-medium text-tinta-800">{f.nombre}</td>
                  <td className="text-tinta-600">{humanizar(f.tipo)}</td>
                  <td className="text-right tabular-nums text-tinta-600">
                    {f.comisionPorcentaje > 0 ? porcentaje(f.comisionPorcentaje) : '—'}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {f.requiereComprobante && <Badge tono="ambar">comprobante</Badge>}
                      {f.requiereReferencia && <Badge tono="azul">referencia</Badge>}
                      {!f.requiereComprobante && !f.requiereReferencia && (
                        <span className="text-xs text-tinta-400">—</span>
                      )}
                    </div>
                  </td>
                  <td>{f.activo ? <Badge tono="verde">activa</Badge> : <Badge tono="rojo">inactiva</Badge>}</td>
                  {puedeEditar && (
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Modal
                          titulo={`Editar ${f.nombre}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-xl"
                        >
                          <Formulario accion={guardarFormaPago} className="space-y-4">
                            <input type="hidden" name="id" value={f.id} />
                            {camposFormaPago(f)}
                            <div className="flex justify-end">
                              <BotonEnviar>Guardar</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                        <BotonEliminar
                          accion={alternarActivoFormaPago}
                          id={f.id}
                          texto={f.activo ? 'Desactivar' : 'Activar'}
                          mensaje={`¿Confirmas ${f.activo ? 'desactivar' : 'activar'} "${f.nombre}"?`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>

        <Tarjeta
          titulo="Previsiones"
          descripcion="Lo que aparece en el desplegable de la ficha del paciente. Agrega las Isapres o seguros que atienda el centro."
          sinPadding
          acciones={
            puedeEditar && (
              <Modal titulo="Nueva previsión" etiquetaBoton="Nueva previsión" tamanoBoton="sm" ancho="max-w-xl">
                <Formulario accion={guardarPrevision} className="space-y-4" reiniciarAlEnviar>
                  {camposPrevision()}
                  <div className="flex justify-end">
                    <BotonEnviar>Crear</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            )
          }
        >
          <ContenedorTabla>
            <thead>
              <tr>
                <th className="w-16 text-right">Orden</th>
                <th>Previsión</th>
                <th>Tipo</th>
                <th>Dato adicional</th>
                <th className="text-right">Pacientes</th>
                <th>Estado</th>
                {puedeEditar && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {previsiones.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                  <td className="text-right tabular-nums text-tinta-400">{p.orden}</td>
                  <td>
                    <p className="font-medium text-tinta-800">{p.nombre}</p>
                    <p className="font-mono text-xs text-tinta-400">{p.codigo}</p>
                  </td>
                  <td>
                    <Badge
                      tono={
                        p.tipo === 'ISAPRE'
                          ? 'azul'
                          : p.tipo === 'FONASA'
                            ? 'verde'
                            : p.tipo === 'SEGURO_COMPLEMENTARIO'
                              ? 'morado'
                              : 'gris'
                      }
                    >
                      {humanizar(p.tipo)}
                    </Badge>
                  </td>
                  <td className="text-xs text-tinta-600">
                    {p.requiereDetalle ? (p.etiquetaDetalle ?? 'Sí, sin etiqueta') : '—'}
                  </td>
                  <td className="text-right tabular-nums text-tinta-500">{p._count.pacientes}</td>
                  <td>{p.activo ? <Badge tono="verde">activa</Badge> : <Badge tono="rojo">inactiva</Badge>}</td>
                  {puedeEditar && (
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Modal
                          titulo={`Editar ${p.nombre}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-xl"
                        >
                          <Formulario accion={guardarPrevision} className="space-y-4">
                            <input type="hidden" name="id" value={p.id} />
                            {camposPrevision(p)}
                            <div className="flex justify-end">
                              <BotonEnviar>Guardar</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                        <BotonEliminar
                          accion={alternarActivoPrevision}
                          id={p.id}
                          texto={p.activo ? 'Desactivar' : 'Activar'}
                          mensaje={`¿Confirmas ${p.activo ? 'desactivar' : 'activar'} "${p.nombre}"?`}
                        />
                        {p._count.pacientes === 0 && (
                          <BotonEliminar accion={eliminarPrevision} id={p.id} variante="peligro" />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>

        <Tarjeta
          titulo="Condiciones dentales"
          descripcion="Diagnósticos y procedimientos que se pueden marcar en el odontograma. Vincula cada uno a un servicio para poder presupuestarlo."
          sinPadding
          acciones={
            puedeEditar && (
              <Modal titulo="Nueva condición dental" etiquetaBoton="Nueva condición" tamanoBoton="sm" ancho="max-w-xl">
                <Formulario accion={guardarCondicionDental} className="space-y-4" reiniciarAlEnviar>
                  {camposCondicion()}
                  <div className="flex justify-end">
                    <BotonEnviar>Crear</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            )
          }
        >
          <ContenedorTabla>
            <thead>
              <tr>
                <th className="w-14">Color</th>
                <th>Condición</th>
                <th>Tipo</th>
                <th>Se marca</th>
                <th>Servicio para presupuestar</th>
                <th className="text-right">Usos</th>
                <th>Estado</th>
                {puedeEditar && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {condicionesDentales.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-60'}>
                  <td>
                    <span
                      className="inline-block h-5 w-5 ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: c.color }}
                    />
                  </td>
                  <td>
                    <p className="font-medium text-brand-900">{c.nombre}</p>
                    <p className="font-mono text-xs text-tinta-400">{c.codigo}</p>
                  </td>
                  <td>
                    <Badge tono={c.categoria === 'DIAGNOSTICO' ? 'ambar' : 'verde'}>
                      {c.categoria === 'DIAGNOSTICO' ? 'diagnóstico' : 'procedimiento'}
                    </Badge>
                  </td>
                  <td className="text-xs text-tinta-600">{c.porCara ? 'Por cara' : 'Pieza completa'}</td>
                  <td className="text-xs text-tinta-600">
                    {c.servicio?.nombre ?? <span className="text-alerta-texto">sin vincular</span>}
                  </td>
                  <td className="text-right tabular-nums text-tinta-500">{c._count.registros}</td>
                  <td>{c.activo ? <Badge tono="verde">activa</Badge> : <Badge tono="rojo">inactiva</Badge>}</td>
                  {puedeEditar && (
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Modal
                          titulo={`Editar ${c.nombre}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-xl"
                        >
                          <Formulario accion={guardarCondicionDental} className="space-y-4">
                            <input type="hidden" name="id" value={c.id} />
                            {camposCondicion(c)}
                            <div className="flex justify-end">
                              <BotonEnviar>Guardar</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                        <BotonEliminar
                          accion={alternarActivoCondicion}
                          id={c.id}
                          texto={c.activo ? 'Desactivar' : 'Activar'}
                          mensaje={`¿Confirmas ${c.activo ? 'desactivar' : 'activar'} «${c.nombre}»?`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>

        <Tarjeta titulo="Actividad reciente" descripcion="Últimas 40 acciones registradas en el sistema." sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Entidad</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs text-tinta-500">{fechaHora(a.createdAt)}</td>
                  <td className="text-xs text-tinta-700">
                    {a.usuario ? `${a.usuario.nombres} ${a.usuario.apellidos}` : 'sistema'}
                  </td>
                  <td className="text-xs">
                    <Badge tono="gris">{a.modulo}</Badge>
                  </td>
                  <td className="text-xs text-tinta-600">{humanizar(a.accion)}</td>
                  <td className="text-xs text-tinta-400">{a.entidad ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      </div>
    </>
  );
}
