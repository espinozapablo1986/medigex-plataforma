import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import {
  Badge,
  ContenedorTabla,
  EncabezadoPagina,
  EnlaceBoton,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { Campo } from '@/components/ui';

import { crearRol } from './acciones';

export const metadata = { title: 'Roles y permisos' };

export default async function PaginaRoles() {
  const sesion = await requerirPermiso('roles', 'ver');

  const roles = await prisma.rol.findMany({
    orderBy: [{ esSistema: 'desc' }, { nombre: 'asc' }],
    include: {
      _count: { select: { usuarios: true } },
      permisos: { where: { permitido: true }, select: { id: true } },
    },
  });

  const puedeCrear = puede(sesion, 'roles', 'crear');

  return (
    <>
      <EncabezadoPagina
        titulo="Roles y permisos"
        descripcion="Define qué puede ver y hacer cada perfil de usuario en cada módulo del sistema."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo rol" etiquetaBoton="Nuevo rol">
              <Formulario accion={crearRol} className="space-y-4">
                <Campo etiqueta="Nombre del rol" requerido>
                  <input name="nombre" required className="campo" placeholder="Ej: Recepción turno tarde" />
                </Campo>
                <Campo etiqueta="Descripción">
                  <textarea name="descripcion" rows={2} className="campo" placeholder="Qué hace este perfil" />
                </Campo>
                <Campo etiqueta="Copiar permisos de" ayuda="Opcional: parte desde un rol existente y luego ajusta.">
                  <select name="copiarDe" className="campo">
                    <option value="">Empezar sin permisos</option>
                    {roles.map((rol) => (
                      <option key={rol.id} value={rol.id}>
                        {rol.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="flex justify-end">
                  <BotonEnviar>Crear rol</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      <Tarjeta sinPadding>
        <ContenedorTabla>
          <thead>
            <tr>
              <th>Rol</th>
              <th>Descripción</th>
              <th className="text-right">Usuarios</th>
              <th className="text-right">Permisos activos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roles.map((rol) => (
              <tr key={rol.id}>
                <td>
                  <Link href={`/roles/${rol.id}`} className="font-medium text-brand-700 hover:underline">
                    {rol.nombre}
                  </Link>
                  <p className="text-xs text-tinta-400">{rol.slug}</p>
                </td>
                <td className="max-w-md text-tinta-500">{rol.descripcion ?? '—'}</td>
                <td className="text-right tabular-nums">{rol._count.usuarios}</td>
                <td className="text-right tabular-nums">{rol.permisos.length}</td>
                <td>
                  <div className="flex gap-1">
                    {rol.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}
                    {rol.esSistema && <Badge tono="azul">sistema</Badge>}
                  </div>
                </td>
                <td className="text-right">
                  <EnlaceBoton href={`/roles/${rol.id}`} variante="secundario" tamano="sm">
                    Editar permisos
                  </EnlaceBoton>
                </td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      </Tarjeta>
    </>
  );
}
