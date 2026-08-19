import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, humanizar } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import {
  alternarActivoServicio,
  crearCategoriaServicio,
  crearServicio,
  editarServicio,
  eliminarServicio,
} from './acciones';
import { CamposServicio } from './campos';

export const metadata = { title: 'Servicios' };

export default async function PaginaServicios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; inactivos?: string }>;
}) {
  const sesion = await requerirPermiso('servicios', 'ver');
  const { q, categoria, inactivos } = await searchParams;

  const [servicios, categorias] = await Promise.all([
    prisma.servicio.findMany({
      where: {
        ...(inactivos === '1' ? {} : { activo: true }),
        ...(categoria ? { categoriaId: categoria } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' as const } },
                { codigo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { categoria: true, _count: { select: { insumos: true } } },
    }),
    prisma.categoriaServicio.findMany({ orderBy: { nombre: 'asc' } }),
  ]);

  const puedeCrear = puede(sesion, 'servicios', 'crear');
  const puedeEditar = puede(sesion, 'servicios', 'editar');
  const puedeEliminar = puede(sesion, 'servicios', 'eliminar');

  return (
    <>
      <EncabezadoPagina
        ayuda="servicios"
        titulo="Servicios"
        descripcion="Catálogo de prestaciones con precio, duración y requisitos de box."
        acciones={
          puedeCrear && (
            <>
              <Modal
                titulo="Nueva categoría"
                etiquetaBoton="Nueva categoría"
                varianteBoton="secundario"
                ancho="max-w-md"
              >
                <Formulario accion={crearCategoriaServicio} className="space-y-4" reiniciarAlEnviar>
                  <Campo etiqueta="Nombre" requerido>
                    <input name="nombre" required className="campo" placeholder="Ej: Odontología general" />
                  </Campo>
                  <Campo etiqueta="Descripción">
                    <input name="descripcion" className="campo" />
                  </Campo>
                  <Campo etiqueta="Color">
                    <input name="color" type="color" defaultValue="#64748b" className="campo h-10 p-1" />
                  </Campo>
                  <div className="flex justify-end">
                    <BotonEnviar>Crear categoría</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>

              <Modal titulo="Nuevo servicio" etiquetaBoton="Nuevo servicio">
                <Formulario accion={crearServicio} className="space-y-4">
                  <CamposServicio categorias={categorias} />
                  <div className="flex justify-end">
                    <BotonEnviar>Crear servicio</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            </>
          )
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar" className="w-56">
          <input name="q" defaultValue={q ?? ''} placeholder="Nombre o código" className="campo" />
        </Campo>
        <Campo etiqueta="Categoría" className="w-52">
          <select name="categoria" defaultValue={categoria ?? ''} className="campo">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex h-10 items-center gap-2 text-sm text-tinta-600">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={inactivos === '1'} className="h-4 w-4 rounded border-tinta-300 text-brand-600" />
          Incluir inactivos
        </label>
        <button type="submit" className="h-10 rounded-lg border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
          Filtrar
        </button>
      </form>

      {servicios.length === 0 ? (
        <EstadoVacio
          titulo="No hay servicios"
          descripcion="Crea tu catálogo de prestaciones para poder agendar, presupuestar y vender."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Código</th>
                <th>Servicio</th>
                <th>Categoría</th>
                <th className="text-right">Duración</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Margen</th>
                <th>Requisitos</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => {
                const margen = s.precio > 0 ? Math.round(((s.precio - s.costoEstimado) / s.precio) * 100) : 0;
                return (
                  <tr key={s.id} className={s.activo ? '' : 'opacity-60'}>
                    <td className="font-mono text-xs text-tinta-600">{s.codigo}</td>
                    <td>
                      <Link href={`/servicios/${s.id}`} className="font-medium text-brand-700 hover:underline">
                        {s.nombre}
                      </Link>
                      {s._count.insumos > 0 && (
                        <span className="ml-1.5 text-xs text-tinta-400">{s._count.insumos} insumo(s)</span>
                      )}
                    </td>
                    <td>
                      {s.categoria ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-tinta-600">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.categoria.color }} />
                          {s.categoria.nombre}
                        </span>
                      ) : (
                        <span className="text-tinta-400">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-tinta-600">{s.duracionMinutos} min</td>
                    <td className="text-right font-medium tabular-nums">{clp(s.precio)}</td>
                    <td className="text-right tabular-nums text-tinta-500">
                      {s.costoEstimado > 0 ? `${margen}%` : '—'}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {s.usaRayosX && <Badge tono="morado">rayos X</Badge>}
                        {s.tipoBoxRequerido && <Badge tono="gris">{humanizar(s.tipoBoxRequerido)}</Badge>}
                        {!s.afectoIva && <Badge tono="ambar">exento</Badge>}
                        {!s.activo && <Badge tono="rojo">inactivo</Badge>}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {puedeEditar && (
                          <>
                            <Modal
                              titulo={`Editar ${s.nombre}`}
                              etiquetaBoton="Editar"
                              varianteBoton="secundario"
                              tamanoBoton="sm"
                            >
                              <Formulario accion={editarServicio} className="space-y-4">
                                <input type="hidden" name="id" value={s.id} />
                                <CamposServicio valores={s} categorias={categorias} />
                                <div className="flex justify-end">
                                  <BotonEnviar>Guardar</BotonEnviar>
                                </div>
                              </Formulario>
                            </Modal>
                            <BotonEliminar
                              accion={alternarActivoServicio}
                              id={s.id}
                              texto={s.activo ? 'Desactivar' : 'Activar'}
                              mensaje={`¿Confirmas ${s.activo ? 'desactivar' : 'activar'} "${s.nombre}"?`}
                            />
                          </>
                        )}
                        {puedeEliminar && <BotonEliminar accion={eliminarServicio} id={s.id} variante="peligro" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      )}
    </>
  );
}
