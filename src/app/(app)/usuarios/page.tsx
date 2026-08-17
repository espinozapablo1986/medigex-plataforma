import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaHora, formatearRut } from '@/lib/format';
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

import {
  alternarActivoUsuario,
  cambiarPassword,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
} from './acciones';

export const metadata = { title: 'Usuarios' };

export default async function PaginaUsuarios() {
  const sesion = await requerirPermiso('usuarios', 'ver');

  const [usuarios, roles, profesionales] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { apellidos: 'asc' }],
      include: { rol: true, profesional: { select: { id: true, especialidad: true } } },
    }),
    prisma.rol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true, usuarioId: true },
    }),
  ]);

  const puedeCrear = puede(sesion, 'usuarios', 'crear');
  const puedeEditar = puede(sesion, 'usuarios', 'editar');
  const puedeEliminar = puede(sesion, 'usuarios', 'eliminar');

  const camposUsuario = (
    valores?: {
      nombres: string;
      apellidos: string;
      email: string;
      rut: string | null;
      telefono: string | null;
      rolId: string;
      profesionalId?: string | null;
    },
  ) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Nombres" requerido>
          <input name="nombres" defaultValue={valores?.nombres} required className="campo" />
        </Campo>
        <Campo etiqueta="Apellidos" requerido>
          <input name="apellidos" defaultValue={valores?.apellidos} required className="campo" />
        </Campo>
        <Campo etiqueta="Correo electrónico" requerido>
          <input name="email" type="email" defaultValue={valores?.email} required className="campo" />
        </Campo>
        <Campo etiqueta="RUT">
          <input name="rut" defaultValue={valores?.rut ?? ''} placeholder="12345678-9" className="campo" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={valores?.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Rol" requerido>
          <select name="rolId" defaultValue={valores?.rolId ?? ''} required className="campo">
            <option value="">Selecciona un rol…</option>
            {roles.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </Grilla>
      <Campo
        etiqueta="Ficha de profesional vinculada"
        ayuda="Vincula la cuenta con un profesional para que vea su propia agenda y firme recetas."
        className="mt-4"
      >
        <select name="profesionalId" defaultValue={valores?.profesionalId ?? ''} className="campo">
          <option value="">Sin vincular</option>
          {profesionales
            .filter((p) => !p.usuarioId || p.id === valores?.profesionalId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.apellidos}, {p.nombres} — {p.especialidad}
              </option>
            ))}
        </select>
      </Campo>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso al sistema y el perfil de permisos asignado a cada una."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo usuario" etiquetaBoton="Nuevo usuario">
              <Formulario accion={crearUsuario} className="space-y-4">
                {camposUsuario()}
                <Campo etiqueta="Contraseña inicial" requerido ayuda="Mínimo 8 caracteres. El usuario deberá cambiarla.">
                  <input name="password" type="password" required minLength={8} className="campo" />
                </Campo>
                <div className="flex justify-end">
                  <BotonEnviar>Crear usuario</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {usuarios.length === 0 ? (
        <EstadoVacio titulo="Aún no hay usuarios" descripcion="Crea la primera cuenta de acceso al sistema." />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Contacto</th>
                <th>Profesional</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <p className="font-medium text-tinta-800">
                      {usuario.apellidos}, {usuario.nombres}
                      {usuario.id === sesion.usuarioId && <span className="ml-1 text-xs text-tinta-400">(tú)</span>}
                    </p>
                    <p className="text-xs text-tinta-500">{usuario.email}</p>
                  </td>
                  <td>
                    <Badge tono="azul">{usuario.rol.nombre}</Badge>
                  </td>
                  <td className="text-xs text-tinta-500">
                    {formatearRut(usuario.rut) || '—'}
                    {usuario.telefono && <div>{usuario.telefono}</div>}
                  </td>
                  <td className="text-xs text-tinta-500">{usuario.profesional?.especialidad ?? '—'}</td>
                  <td className="text-xs text-tinta-500">
                    {usuario.ultimoAccesoAt ? fechaHora(usuario.ultimoAccesoAt) : 'Nunca'}
                  </td>
                  <td>{usuario.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <>
                          <Modal
                            titulo={`Editar ${usuario.nombres}`}
                            etiquetaBoton="Editar"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                          >
                            <Formulario accion={editarUsuario} className="space-y-4">
                              <input type="hidden" name="id" value={usuario.id} />
                              {camposUsuario({
                                nombres: usuario.nombres,
                                apellidos: usuario.apellidos,
                                email: usuario.email,
                                rut: usuario.rut,
                                telefono: usuario.telefono,
                                rolId: usuario.rolId,
                                profesionalId: usuario.profesional?.id ?? null,
                              })}
                              <div className="flex justify-end">
                                <BotonEnviar>Guardar cambios</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>

                          <Modal
                            titulo="Restablecer contraseña"
                            etiquetaBoton="Contraseña"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                            ancho="max-w-md"
                          >
                            <Formulario accion={cambiarPassword} className="space-y-4">
                              <input type="hidden" name="id" value={usuario.id} />
                              <p className="text-sm text-tinta-600">
                                Se cerrarán las sesiones activas de <strong>{usuario.email}</strong>.
                              </p>
                              <Campo etiqueta="Nueva contraseña" requerido>
                                <input name="password" type="password" required minLength={8} className="campo" />
                              </Campo>
                              <Campo etiqueta="Repetir contraseña" requerido>
                                <input name="confirmacion" type="password" required minLength={8} className="campo" />
                              </Campo>
                              <div className="flex justify-end">
                                <BotonEnviar>Restablecer</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>

                          {usuario.id !== sesion.usuarioId && (
                            <BotonEliminar
                              accion={alternarActivoUsuario}
                              id={usuario.id}
                              texto={usuario.activo ? 'Desactivar' : 'Activar'}
                              mensaje={`¿Confirmas ${usuario.activo ? 'desactivar' : 'activar'} a ${usuario.email}?`}
                            />
                          )}
                        </>
                      )}
                      {puedeEliminar && usuario.id !== sesion.usuarioId && (
                        <BotonEliminar
                          accion={eliminarUsuario}
                          id={usuario.id}
                          variante="peligro"
                          mensaje={`Se eliminará la cuenta ${usuario.email}. Esta acción no se puede deshacer.`}
                        />
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
