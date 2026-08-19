import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, formatearRut } from '@/lib/format';
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

import { alternarActivoProveedor, crearProveedor, editarProveedor, eliminarProveedor } from './acciones';

export const metadata = { title: 'Proveedores' };

export default async function PaginaProveedores() {
  const sesion = await requerirPermiso('proveedores', 'ver');

  const proveedores = await prisma.proveedor.findMany({
    orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
    include: {
      _count: { select: { productos: true, gastos: true } },
      gastos: { select: { total: true } },
    },
  });

  const puedeCrear = puede(sesion, 'proveedores', 'crear');
  const puedeEditar = puede(sesion, 'proveedores', 'editar');
  const puedeEliminar = puede(sesion, 'proveedores', 'eliminar');

  const campos = (p?: (typeof proveedores)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="RUT">
          <input name="rut" defaultValue={p?.rut ?? ''} placeholder="76123456-7" className="campo" />
        </Campo>
        <Campo etiqueta="Razón social" requerido>
          <input name="razonSocial" defaultValue={p?.razonSocial} required className="campo" />
        </Campo>
        <Campo etiqueta="Nombre de fantasía">
          <input name="nombreFantasia" defaultValue={p?.nombreFantasia ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Giro">
          <input name="giro" defaultValue={p?.giro ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Persona de contacto">
          <input name="contacto" defaultValue={p?.contacto ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={p?.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo">
          <input name="email" type="email" defaultValue={p?.email ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Comuna">
          <input name="comuna" defaultValue={p?.comuna ?? ''} className="campo" />
        </Campo>
      </Grilla>
      <Campo etiqueta="Dirección" className="mt-4">
        <input name="direccion" defaultValue={p?.direccion ?? ''} className="campo" />
      </Campo>
      <Campo etiqueta="Observaciones" className="mt-4">
        <textarea name="observaciones" rows={2} defaultValue={p?.observaciones ?? ''} className="campo" />
      </Campo>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        ayuda="proveedores"
        titulo="Proveedores"
        descripcion="Proveedores de insumos y servicios, usados en compras y gastos."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo proveedor" etiquetaBoton="Nuevo proveedor">
              <Formulario accion={crearProveedor} className="space-y-4">
                {campos()}
                <div className="flex justify-end">
                  <BotonEnviar>Crear proveedor</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {proveedores.length === 0 ? (
        <EstadoVacio titulo="No hay proveedores" descripcion="Registra tus proveedores para asociarlos a compras y gastos." />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>RUT</th>
                <th>Contacto</th>
                <th className="text-right">Productos</th>
                <th className="text-right">Gastos</th>
                <th className="text-right">Total comprado</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                  <td>
                    <p className="font-medium text-tinta-800">{p.razonSocial}</p>
                    {p.nombreFantasia && <p className="text-xs text-tinta-400">{p.nombreFantasia}</p>}
                  </td>
                  <td className="text-tinta-600">{formatearRut(p.rut) || '—'}</td>
                  <td className="text-xs text-tinta-500">
                    {p.contacto ?? '—'}
                    {p.telefono && <div>{p.telefono}</div>}
                    {p.email && <div>{p.email}</div>}
                  </td>
                  <td className="text-right tabular-nums text-tinta-500">{p._count.productos}</td>
                  <td className="text-right tabular-nums text-tinta-500">{p._count.gastos}</td>
                  <td className="text-right font-medium tabular-nums">
                    {clp(p.gastos.reduce((acc, g) => acc + g.total, 0))}
                  </td>
                  <td>{p.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <>
                          <Modal
                            titulo={`Editar ${p.razonSocial}`}
                            etiquetaBoton="Editar"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                          >
                            <Formulario accion={editarProveedor} className="space-y-4">
                              <input type="hidden" name="id" value={p.id} />
                              {campos(p)}
                              <div className="flex justify-end">
                                <BotonEnviar>Guardar</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>
                          <BotonEliminar
                            accion={alternarActivoProveedor}
                            id={p.id}
                            texto={p.activo ? 'Desactivar' : 'Activar'}
                            mensaje={`¿Confirmas ${p.activo ? 'desactivar' : 'activar'} a ${p.razonSocial}?`}
                          />
                        </>
                      )}
                      {puedeEliminar && p._count.gastos === 0 && p._count.productos === 0 && (
                        <BotonEliminar accion={eliminarProveedor} id={p.id} variante="peligro" />
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
