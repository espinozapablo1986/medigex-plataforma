import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, humanizar } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { alternarActivoBox, crearBox, editarBox, eliminarBox } from './acciones';

export const metadata = { title: 'Boxes y salas' };

const TIPOS = [
  { valor: 'BOX_DENTAL', texto: 'Box dental' },
  { valor: 'BOX_MEDICO', texto: 'Box médico' },
  { valor: 'SALA_RAYOS_X', texto: 'Sala de rayos X' },
  { valor: 'SALA_PROCEDIMIENTOS', texto: 'Sala de procedimientos' },
  { valor: 'SALA_CIRUGIA', texto: 'Sala de cirugía' },
  { valor: 'OTRO', texto: 'Otro' },
];

export default async function PaginaBoxes() {
  const sesion = await requerirPermiso('boxes', 'ver');

  const boxes = await prisma.box.findMany({
    orderBy: [{ activo: 'desc' }, { codigo: 'asc' }],
    include: {
      _count: { select: { citas: true, arriendos: true } },
      arriendos: {
        where: { activo: true },
        include: { profesional: { select: { nombres: true, apellidos: true } } },
      },
    },
  });

  const puedeCrear = puede(sesion, 'boxes', 'crear');
  const puedeEditar = puede(sesion, 'boxes', 'editar');
  const puedeEliminar = puede(sesion, 'boxes', 'eliminar');

  const campos = (b?: (typeof boxes)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Código" requerido ayuda="Identificador corto, ej: B1, RX">
          <input name="codigo" defaultValue={b?.codigo} required className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={b?.nombre} required className="campo" />
        </Campo>
        <Campo etiqueta="Tipo" requerido>
          <select name="tipo" defaultValue={b?.tipo ?? 'BOX_MEDICO'} required className="campo">
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ubicación">
          <input name="ubicacion" defaultValue={b?.ubicacion ?? ''} placeholder="2º piso, ala norte" className="campo" />
        </Campo>
        <Campo etiqueta="Valor arriendo por hora (CLP)" ayuda="Referencia para calcular cobros de arriendo de box.">
          <input name="valorArriendoHora" type="number" min={0} step={100} defaultValue={b?.valorArriendoHora ?? 0} className="campo" />
        </Campo>
      </Grilla>
      <Campo etiqueta="Equipamiento" className="mt-4">
        <textarea
          name="equipamiento"
          rows={2}
          defaultValue={b?.equipamiento ?? ''}
          placeholder="Sillón dental, lámpara, autoclave…"
          className="campo"
        />
      </Campo>
      <Campo etiqueta="Descripción" className="mt-4">
        <textarea name="descripcion" rows={2} defaultValue={b?.descripcion ?? ''} className="campo" />
      </Campo>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        ayuda="boxes"
        titulo="Boxes y salas"
        descripcion="Dependencias del centro. La agenda valida que el box esté libre antes de confirmar una hora."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo box o sala" etiquetaBoton="Nuevo box">
              <Formulario accion={crearBox} className="space-y-4">
                {campos()}
                <div className="flex justify-end">
                  <BotonEnviar>Crear box</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {boxes.length === 0 ? (
        <EstadoVacio
          titulo="No hay boxes registrados"
          descripcion="Registra los boxes y salas del centro para poder agendar y controlar su disponibilidad."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Ubicación</th>
                <th className="text-right">Arriendo/hora</th>
                <th>Arrendado a</th>
                <th className="text-right">Citas</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((box) => (
                <tr key={box.id}>
                  <td className="font-mono text-xs font-semibold text-tinta-700">{box.codigo}</td>
                  <td className="font-medium text-tinta-800">{box.nombre}</td>
                  <td>
                    <Badge tono={box.tipo === 'SALA_RAYOS_X' ? 'morado' : 'gris'}>{humanizar(box.tipo)}</Badge>
                  </td>
                  <td className="text-tinta-500">{box.ubicacion ?? '—'}</td>
                  <td className="text-right tabular-nums">
                    {box.valorArriendoHora > 0 ? clp(box.valorArriendoHora) : '—'}
                  </td>
                  <td className="text-xs text-tinta-500">
                    {box.arriendos.length === 0
                      ? '—'
                      : box.arriendos
                          .map((a) => `${a.profesional.nombres} ${a.profesional.apellidos}`)
                          .join(', ')}
                  </td>
                  <td className="text-right tabular-nums text-tinta-500">{box._count.citas}</td>
                  <td>{box.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <>
                          <Modal
                            titulo={`Editar ${box.nombre}`}
                            etiquetaBoton="Editar"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                          >
                            <Formulario accion={editarBox} className="space-y-4">
                              <input type="hidden" name="id" value={box.id} />
                              {campos(box)}
                              <div className="flex justify-end">
                                <BotonEnviar>Guardar</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>
                          <BotonEliminar
                            accion={alternarActivoBox}
                            id={box.id}
                            texto={box.activo ? 'Desactivar' : 'Activar'}
                            mensaje={`¿Confirmas ${box.activo ? 'desactivar' : 'activar'} el box ${box.nombre}?`}
                          />
                        </>
                      )}
                      {puedeEliminar && box._count.citas === 0 && (
                        <BotonEliminar accion={eliminarBox} id={box.id} variante="peligro" />
                      )}
                    </div>
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
