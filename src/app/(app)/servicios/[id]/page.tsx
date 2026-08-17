import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, humanizar, numero, porcentaje } from '@/lib/format';
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
import { BotonEliminar, BotonEnviar, Formulario } from '@/components/formulario';

import {
  agregarInsumo,
  guardarComisionServicio,
  quitarComisionServicio,
  quitarInsumo,
} from '../acciones';

export default async function PaginaServicio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('servicios', 'ver');

  const servicio = await prisma.servicio.findUnique({
    where: { id },
    include: {
      categoria: true,
      insumos: { include: { producto: true } },
      comisiones: { include: { profesional: { select: { nombres: true, apellidos: true, especialidad: true } } } },
    },
  });
  if (!servicio) notFound();

  const [productos, profesionales] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true, esInsumo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, sku: true, unidadMedida: true, stockActual: true, costoPromedio: true },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, comisionPorcentaje: true },
    }),
  ]);

  const puedeEditar = puede(sesion, 'servicios', 'editar');

  const costoInsumos = servicio.insumos.reduce(
    (acc, i) => acc + Math.round(i.cantidad * i.producto.costoPromedio),
    0,
  );

  return (
    <>
      <EncabezadoPagina
        titulo={servicio.nombre}
        descripcion={servicio.descripcion ?? `Código ${servicio.codigo}`}
        volver={{ href: '/servicios', texto: 'Servicios' }}
        acciones={
          <div className="flex gap-1.5">
            {servicio.usaRayosX && <Badge tono="morado">usa rayos X</Badge>}
            {servicio.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta titulo="Insumos que consume" descripcion="Se descuentan del inventario al registrar la atención.">
            {servicio.insumos.length === 0 ? (
              <EstadoVacio
                titulo="Sin insumos asociados"
                descripcion="Asocia los consumibles que gasta este servicio para descontar stock automáticamente."
              />
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Stock actual</th>
                    <th className="text-right">Costo</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {servicio.insumos.map((insumo) => (
                    <tr key={insumo.id}>
                      <td>
                        <p className="font-medium text-tinta-800">{insumo.producto.nombre}</p>
                        <p className="text-xs text-tinta-400">{insumo.producto.sku}</p>
                      </td>
                      <td className="text-right tabular-nums">
                        {numero(insumo.cantidad, 2)} {humanizar(insumo.producto.unidadMedida).toLowerCase()}
                      </td>
                      <td className="text-right tabular-nums">
                        <span className={insumo.producto.stockActual <= insumo.producto.stockMinimo ? 'text-rose-600' : ''}>
                          {numero(insumo.producto.stockActual, 2)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-tinta-500">
                        {clp(Math.round(insumo.cantidad * insumo.producto.costoPromedio))}
                      </td>
                      {puedeEditar && (
                        <td className="text-right">
                          <BotonEliminar accion={quitarInsumo} id={insumo.id} texto="Quitar" mensaje="¿Quitar este insumo del servicio?" />
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-tinta-50 font-medium">
                    <td colSpan={3} className="text-right text-xs uppercase tracking-wide text-tinta-500">
                      Costo total de insumos
                    </td>
                    <td className="text-right tabular-nums">{clp(costoInsumos)}</td>
                    {puedeEditar && <td />}
                  </tr>
                </tbody>
              </ContenedorTabla>
            )}

            {puedeEditar && (
              <Formulario accion={agregarInsumo} className="mt-4 border-t border-tinta-200 pt-4" reiniciarAlEnviar>
                <input type="hidden" name="servicioId" value={servicio.id} />
                <div className="flex flex-wrap items-end gap-3">
                  <Campo etiqueta="Producto" className="min-w-[16rem] flex-1">
                    <select name="productoId" required className="campo">
                      <option value="">Selecciona un insumo…</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Cantidad" className="w-32">
                    <input name="cantidad" type="number" min={0.01} step={0.01} defaultValue={1} required className="campo" />
                  </Campo>
                  <BotonEnviar variante="secundario">Agregar</BotonEnviar>
                </div>
              </Formulario>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Comisiones especiales por profesional"
            descripcion="Sobrescriben la comisión general del profesional sólo para este servicio."
          >
            {servicio.comisiones.length === 0 ? (
              <p className="text-sm text-tinta-500">
                Ningún profesional tiene comisión especial para este servicio. Se aplica{' '}
                {servicio.comisionPorcentaje !== null
                  ? `el ${porcentaje(servicio.comisionPorcentaje)} definido en el servicio`
                  : 'la comisión general de cada profesional'}
                .
              </p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Profesional</th>
                    <th className="text-right">Comisión</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {servicio.comisiones.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-tinta-800">
                        {c.profesional.apellidos}, {c.profesional.nombres}
                        <span className="ml-1 text-xs text-tinta-400">{c.profesional.especialidad}</span>
                      </td>
                      <td className="text-right tabular-nums">{porcentaje(c.porcentaje)}</td>
                      {puedeEditar && (
                        <td className="text-right">
                          <BotonEliminar accion={quitarComisionServicio} id={c.id} texto="Quitar" mensaje="¿Quitar esta comisión especial?" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}

            {puedeEditar && (
              <Formulario accion={guardarComisionServicio} className="mt-4 border-t border-tinta-200 pt-4" reiniciarAlEnviar>
                <input type="hidden" name="servicioId" value={servicio.id} />
                <div className="flex flex-wrap items-end gap-3">
                  <Campo etiqueta="Profesional" className="min-w-[16rem] flex-1">
                    <select name="profesionalId" required className="campo">
                      <option value="">Selecciona…</option>
                      {profesionales.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.apellidos}, {p.nombres} (general {porcentaje(p.comisionPorcentaje)})
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Comisión %" className="w-32">
                    <input name="porcentaje" type="number" min={0} max={100} step={0.5} required className="campo" />
                  </Campo>
                  <BotonEnviar variante="secundario">Guardar</BotonEnviar>
                </div>
              </Formulario>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Ficha del servicio">
          <dl className="space-y-3">
            <Definicion termino="Código">{servicio.codigo}</Definicion>
            <Definicion termino="Categoría">{servicio.categoria?.nombre}</Definicion>
            <Definicion termino="Duración">{servicio.duracionMinutos} minutos</Definicion>
            <Definicion termino="Precio de lista">{clp(servicio.precio)}</Definicion>
            <Definicion termino="Costo estimado">{clp(servicio.costoEstimado)}</Definicion>
            <Definicion termino="Costo real de insumos">{clp(costoInsumos)}</Definicion>
            <Definicion termino="Margen estimado">
              {servicio.precio > 0
                ? `${Math.round(((servicio.precio - Math.max(servicio.costoEstimado, costoInsumos)) / servicio.precio) * 100)}%`
                : '—'}
            </Definicion>
            <Definicion termino="Box requerido">
              {servicio.requiereBox ? humanizar(servicio.tipoBoxRequerido ?? 'Cualquiera') : 'No requiere'}
            </Definicion>
            <Definicion termino="IVA">{servicio.afectoIva ? 'Afecto' : 'Exento'}</Definicion>
            <Definicion termino="Comisión del servicio">
              {servicio.comisionPorcentaje !== null ? porcentaje(servicio.comisionPorcentaje) : 'Según profesional'}
            </Definicion>
            <Definicion termino="Consentimiento">
              {servicio.requiereConsentimiento ? 'Requerido' : 'No requerido'}
            </Definicion>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
