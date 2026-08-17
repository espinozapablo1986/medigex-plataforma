import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { ACCIONES, ETIQUETA_ACCION, GRUPOS_MODULO, MODULOS, claveP } from '@/lib/permissions';
import { Aviso, Badge, EncabezadoPagina, Tarjeta, Campo } from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario } from '@/components/formulario';

import { eliminarRol, guardarPermisos } from '../acciones';
import { MatrizPermisos } from './matriz';

export default async function PaginaRol({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('roles', 'ver');

  const rol = await prisma.rol.findUnique({
    where: { id },
    include: {
      permisos: true,
      _count: { select: { usuarios: true } },
    },
  });
  if (!rol) notFound();

  const activos = new Set(rol.permisos.filter((p) => p.permitido).map((p) => claveP(p.modulo, p.accion)));
  const puedeEditar = puede(sesion, 'roles', 'editar');
  const puedeEliminar = puede(sesion, 'roles', 'eliminar') && !rol.esSistema && rol._count.usuarios === 0;

  return (
    <>
      <EncabezadoPagina
        titulo={rol.nombre}
        descripcion={rol.descripcion ?? 'Marca las acciones que este perfil podrá realizar en cada módulo.'}
        volver={{ href: '/roles', texto: 'Roles y permisos' }}
        acciones={
          <div className="flex items-center gap-2">
            <Badge tono="gris">{rol._count.usuarios} usuario(s)</Badge>
            {rol.esSistema && <Badge tono="azul">rol de sistema</Badge>}
            {puedeEliminar && <BotonEliminar accion={eliminarRol} id={rol.id} variante="peligro" />}
          </div>
        }
      />

      {!puedeEditar && (
        <div className="mb-4">
          <Aviso tono="alerta">Sólo puedes consultar esta matriz. No tienes permiso para editar roles.</Aviso>
        </div>
      )}

      {rol.slug === 'administrador' && (
        <div className="mb-4">
          <Aviso tono="info" titulo="Cuidado con el rol Administrador">
            Si le quitas permisos a este rol podrías quedarte sin acceso a la configuración del sistema. Asegúrate de
            que al menos una cuenta activa conserve los permisos de Roles y Usuarios.
          </Aviso>
        </div>
      )}

      <Formulario accion={guardarPermisos} className="space-y-5">
        <input type="hidden" name="rolId" value={rol.id} />

        <Tarjeta titulo="Datos del rol">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" requerido>
              <input name="nombre" defaultValue={rol.nombre} required disabled={!puedeEditar} className="campo" />
            </Campo>
            <Campo etiqueta="Descripción">
              <input name="descripcion" defaultValue={rol.descripcion ?? ''} disabled={!puedeEditar} className="campo" />
            </Campo>
          </div>
        </Tarjeta>

        <MatrizPermisos
          grupos={GRUPOS_MODULO}
          modulos={MODULOS}
          acciones={[...ACCIONES]}
          etiquetas={ETIQUETA_ACCION}
          activos={[...activos]}
          soloLectura={!puedeEditar}
        />

        {puedeEditar && (
          <div className="sticky bottom-4 flex justify-end">
            <div className="rounded-xl border border-tinta-200 bg-white p-2 shadow-lg">
              <BotonEnviar>Guardar permisos</BotonEnviar>
            </div>
          </div>
        )}
      </Formulario>
    </>
  );
}
