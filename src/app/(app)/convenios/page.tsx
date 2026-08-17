import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, formatearRut, humanizar, porcentaje } from '@/lib/format';
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

import { alternarActivoConvenio, crearConvenio, editarConvenio, eliminarConvenio } from './acciones';

export const metadata = { title: 'Convenios' };

const TIPOS = [
  { valor: 'ISAPRE', texto: 'Isapre' },
  { valor: 'SEGURO_COMPLEMENTARIO', texto: 'Seguro complementario' },
  { valor: 'EMPRESA', texto: 'Empresa en convenio' },
  { valor: 'MUTUAL', texto: 'Mutual de seguridad' },
  { valor: 'FONASA', texto: 'Fonasa' },
  { valor: 'OTRO', texto: 'Otro' },
];

export default async function PaginaConvenios() {
  const sesion = await requerirPermiso('convenios', 'ver');

  const convenios = await prisma.convenio.findMany({
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    include: {
      _count: { select: { pacientes: true, servicios: true, ventas: true, informes: true } },
      ventas: { where: { estado: { not: 'ANULADA' } }, select: { total: true, montoCobertura: true } },
    },
  });

  const puedeCrear = puede(sesion, 'convenios', 'crear');
  const puedeEditar = puede(sesion, 'convenios', 'editar');

  const campos = (c?: (typeof convenios)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Nombre" requerido>
          <input name="nombre" defaultValue={c?.nombre} required className="campo" placeholder="Isapre Consalud" />
        </Campo>
        <Campo etiqueta="Código" ayuda="Se genera desde el nombre si lo dejas vacío.">
          <input name="codigo" defaultValue={c?.codigo ?? ''} className="campo uppercase" />
        </Campo>
        <Campo etiqueta="Tipo" requerido>
          <select name="tipo" defaultValue={c?.tipo ?? 'ISAPRE'} required className="campo">
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="RUT">
          <input name="rut" defaultValue={c?.rut ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Contacto">
          <input name="contacto" defaultValue={c?.contacto ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={c?.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo">
          <input name="email" type="email" defaultValue={c?.email ?? ''} className="campo" />
        </Campo>
      </Grilla>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Condiciones comerciales</p>
        <Grilla cols={3}>
          <Campo etiqueta="Descuento general (%)" ayuda="Sobre el precio de lista, si el servicio no tiene tarifa propia.">
            <input
              name="descuentoPorcentaje"
              type="number"
              min={0}
              max={100}
              step={0.5}
              defaultValue={c?.descuentoPorcentaje ?? 0}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Cobertura (%)" ayuda="Porcentaje que asume la aseguradora; el resto es copago.">
            <input
              name="coberturaPorcentaje"
              type="number"
              min={0}
              max={100}
              step={0.5}
              defaultValue={c?.coberturaPorcentaje ?? 0}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Tope por prestación (CLP)" ayuda="0 = sin tope.">
            <input
              name="topePorPrestacion"
              type="number"
              min={0}
              step={1000}
              defaultValue={c?.topePorPrestacion ?? 0}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Vigente desde">
            <input
              name="vigenteDesde"
              type="date"
              defaultValue={c ? c.vigenteDesde.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Vigente hasta">
            <input
              name="vigenteHasta"
              type="date"
              defaultValue={c?.vigenteHasta ? c.vigenteHasta.toISOString().slice(0, 10) : ''}
              className="campo"
            />
          </Campo>
        </Grilla>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="requiereAutorizacion"
            defaultChecked={c?.requiereAutorizacion ?? false}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Requiere autorización previa de la aseguradora
        </label>
      </div>

      <Campo etiqueta="Observaciones" className="mt-4">
        <textarea name="observaciones" rows={2} defaultValue={c?.observaciones ?? ''} className="campo" />
      </Campo>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Convenios"
        descripcion="Isapres, seguros complementarios y empresas con tarifas y cobertura negociadas."
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo convenio" etiquetaBoton="Nuevo convenio" ancho="max-w-3xl">
              <Formulario accion={crearConvenio} className="space-y-4">
                {campos()}
                <div className="flex justify-end">
                  <BotonEnviar>Crear convenio</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {convenios.length === 0 ? (
        <EstadoVacio
          titulo="Sin convenios"
          descripcion="Registra las Isapres, seguros y empresas con las que el centro tiene convenio para aplicar sus tarifas y coberturas."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Convenio</th>
                <th>Tipo</th>
                <th>Contacto</th>
                <th className="text-right">Descuento</th>
                <th className="text-right">Cobertura</th>
                <th className="text-right">Pacientes</th>
                <th className="text-right">Tarifas</th>
                <th className="text-right">Facturado</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {convenios.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-60'}>
                  <td>
                    <Link href={`/convenios/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.nombre}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {c.codigo}
                      {c.rut && ` · ${formatearRut(c.rut)}`}
                    </p>
                  </td>
                  <td>
                    <Badge tono={c.tipo === 'ISAPRE' ? 'azul' : c.tipo === 'SEGURO_COMPLEMENTARIO' ? 'morado' : 'gris'}>
                      {humanizar(c.tipo)}
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-500">
                    {c.contacto ?? '—'}
                    {c.telefono && <div>{c.telefono}</div>}
                  </td>
                  <td className="text-right tabular-nums text-slate-600">{porcentaje(c.descuentoPorcentaje, 0)}</td>
                  <td className="text-right tabular-nums text-slate-600">
                    {porcentaje(c.coberturaPorcentaje, 0)}
                    {c.topePorPrestacion > 0 && (
                      <p className="text-xs text-slate-400">tope {clp(c.topePorPrestacion)}</p>
                    )}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{c._count.pacientes}</td>
                  <td className="text-right tabular-nums text-slate-500">{c._count.servicios}</td>
                  <td className="text-right font-medium tabular-nums">
                    {clp(c.ventas.reduce((acc, v) => acc + v.total, 0))}
                    <p className="text-xs text-emerald-600">
                      cubre {clp(c.ventas.reduce((acc, v) => acc + v.montoCobertura, 0))}
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {c.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}
                      {c.vigenteHasta && c.vigenteHasta < new Date() && <Badge tono="ambar">vencido</Badge>}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && (
                        <>
                          <Modal
                            titulo={`Editar ${c.nombre}`}
                            etiquetaBoton="Editar"
                            varianteBoton="secundario"
                            tamanoBoton="sm"
                            ancho="max-w-3xl"
                          >
                            <Formulario accion={editarConvenio} className="space-y-4">
                              <input type="hidden" name="id" value={c.id} />
                              {campos(c)}
                              <div className="flex justify-end">
                                <BotonEnviar>Guardar</BotonEnviar>
                              </div>
                            </Formulario>
                          </Modal>
                          <BotonEliminar
                            accion={alternarActivoConvenio}
                            id={c.id}
                            texto={c.activo ? 'Desactivar' : 'Activar'}
                            mensaje={`¿Confirmas ${c.activo ? 'desactivar' : 'activar'} el convenio ${c.nombre}?`}
                          />
                        </>
                      )}
                      {puede(sesion, 'convenios', 'eliminar') && c._count.ventas === 0 && c._count.pacientes === 0 && (
                        <BotonEliminar accion={eliminarConvenio} id={c.id} variante="peligro" />
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
