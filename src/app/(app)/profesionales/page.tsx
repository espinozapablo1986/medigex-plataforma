import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, formatearRut, humanizar, porcentaje } from '@/lib/format';
import {
  Avatar,
  Badge,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { alternarActivoProfesional, crearProfesional, eliminarProfesional } from './acciones';
import { CamposProfesional } from './campos';

export const metadata = { title: 'Profesionales' };

export default async function PaginaProfesionales() {
  const sesion = await requerirPermiso('profesionales', 'ver');

  const profesionales = await prisma.profesional.findMany({
    orderBy: [{ activo: 'desc' }, { apellidos: 'asc' }],
    include: {
      usuario: { select: { email: true } },
      arriendos: { where: { activo: true }, include: { box: { select: { codigo: true } } } },
      _count: { select: { citas: true, atenciones: true, disponibilidad: true } },
    },
  });

  const puedeCrear = puede(sesion, 'profesionales', 'crear');
  const puedeEditar = puede(sesion, 'profesionales', 'editar');
  const puedeEliminar = puede(sesion, 'profesionales', 'eliminar');

  return (
    <>
      <EncabezadoPagina
        titulo="Profesionales"
        descripcion="Fichas de los profesionales, sus condiciones de pago y su disponibilidad horaria."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo profesional" etiquetaBoton="Nuevo profesional">
              <Formulario accion={crearProfesional} className="space-y-4">
                <CamposProfesional />
                <div className="flex justify-end">
                  <BotonEnviar>Crear profesional</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {profesionales.length === 0 ? (
        <EstadoVacio
          titulo="No hay profesionales registrados"
          descripcion="Agrega a los profesionales del centro para poder configurar su agenda y sus comisiones."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Especialidad</th>
                <th>Contacto</th>
                <th>Modelo de pago</th>
                <th>Arriendo de box</th>
                <th className="text-right">Bloques horarios</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profesionales.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar texto={`${p.nombres[0]}${p.apellidos[0]}`} color={p.colorAgenda} />
                      <div>
                        <Link href={`/profesionales/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          {p.apellidos}, {p.nombres}
                        </Link>
                        <p className="text-xs text-slate-400">{formatearRut(p.rut)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-600">
                    {p.especialidad}
                    {p.subespecialidad && <p className="text-xs text-slate-400">{p.subespecialidad}</p>}
                  </td>
                  <td className="text-xs text-slate-500">
                    {p.email ?? p.usuario?.email ?? '—'}
                    {p.telefono && <div>{p.telefono}</div>}
                  </td>
                  <td>
                    <Badge tono="azul">{humanizar(p.modeloPago)}</Badge>
                    {p.comisionPorcentaje > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">{porcentaje(p.comisionPorcentaje)} de comisión</p>
                    )}
                  </td>
                  <td className="text-xs text-slate-600">
                    {p.arriendos.length === 0
                      ? '—'
                      : p.arriendos.map((a) => (
                          <div key={a.id}>
                            {a.box.codigo}: {clp(a.monto)} / {humanizar(a.periodicidad).toLowerCase()}
                          </div>
                        ))}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{p._count.disponibilidad}</td>
                  <td>{p.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <BotonEliminar
                          accion={alternarActivoProfesional}
                          id={p.id}
                          texto={p.activo ? 'Desactivar' : 'Activar'}
                          mensaje={`¿Confirmas ${p.activo ? 'desactivar' : 'activar'} a ${p.nombres} ${p.apellidos}?`}
                        />
                      )}
                      {puedeEliminar && p._count.atenciones === 0 && (
                        <BotonEliminar accion={eliminarProfesional} id={p.id} variante="peligro" />
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
