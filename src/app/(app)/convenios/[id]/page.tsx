import { notFound } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, formatearRut, humanizar, porcentaje } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  Definicion,
  EncabezadoPagina,
  EstadoVacio,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario } from '@/components/formulario';

import { guardarTarifa, quitarTarifa } from '../acciones';

export default async function DetalleConvenio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('convenios', 'ver');

  const convenio = await prisma.convenio.findUnique({
    where: { id },
    include: {
      servicios: { include: { servicio: true }, orderBy: { servicio: { nombre: 'asc' } } },
      pacientes: {
        select: { id: true, nombres: true, apellidoPaterno: true, rut: true, numeroAfiliado: true },
        orderBy: { apellidoPaterno: 'asc' },
        take: 100,
      },
      ventas: { where: { estado: { not: 'ANULADA' } }, select: { total: true, montoCobertura: true, montoPaciente: true } },
      _count: { select: { informes: true } },
    },
  });
  if (!convenio) notFound();

  const servicios = await prisma.servicio.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, codigo: true, precio: true },
  });

  const puedeEditar = puede(sesion, 'convenios', 'editar');
  const facturado = convenio.ventas.reduce((acc, v) => acc + v.total, 0);
  const cubierto = convenio.ventas.reduce((acc, v) => acc + v.montoCobertura, 0);
  const copagos = convenio.ventas.reduce((acc, v) => acc + v.montoPaciente, 0);

  return (
    <>
      <EncabezadoPagina
        titulo={convenio.nombre}
        descripcion={`${humanizar(convenio.tipo)} · código ${convenio.codigo}`}
        volver={{ href: '/convenios', texto: 'Convenios' }}
        acciones={convenio.activo ? <Badge tono="verde">activo</Badge> : <Badge tono="rojo">inactivo</Badge>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Facturado con el convenio" valor={clp(facturado)} detalle={`${convenio.ventas.length} ventas`} />
        <Metrica etiqueta="Cubierto por el convenio" valor={clp(cubierto)} tono="positivo" />
        <Metrica etiqueta="Copagos de pacientes" valor={clp(copagos)} />
        <Metrica etiqueta="Pacientes adscritos" valor={String(convenio.pacientes.length)} tono="marca" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tarjeta
            titulo="Tarifas negociadas por servicio"
            descripcion="Si un servicio no tiene tarifa aquí, se usa el precio de lista con el descuento general."
          >
            {convenio.servicios.length === 0 ? (
              <EstadoVacio
                titulo="Sin tarifas específicas"
                descripcion={`Se aplica el descuento general de ${porcentaje(convenio.descuentoPorcentaje, 0)} y una cobertura de ${porcentaje(convenio.coberturaPorcentaje, 0)}.`}
              />
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Código prestación</th>
                    <th className="text-right">Precio lista</th>
                    <th className="text-right">Precio convenio</th>
                    <th className="text-right">Cobertura</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {convenio.servicios.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/servicios/${t.servicio.id}`} className="font-medium text-brand-700 hover:underline">
                          {t.servicio.nombre}
                        </Link>
                        <p className="text-xs text-tinta-400">{t.servicio.codigo}</p>
                      </td>
                      <td className="font-mono text-xs text-tinta-600">{t.codigoPrestacion ?? '—'}</td>
                      <td className="text-right tabular-nums text-tinta-500 line-through">{clp(t.servicio.precio)}</td>
                      <td className="text-right font-medium tabular-nums">
                        {t.precioConvenio > 0 ? clp(t.precioConvenio) : 'precio lista'}
                      </td>
                      <td className="text-right tabular-nums text-emerald-600">
                        {porcentaje(t.coberturaPorcentaje > 0 ? t.coberturaPorcentaje : convenio.coberturaPorcentaje, 0)}
                      </td>
                      {puedeEditar && (
                        <td className="text-right">
                          <BotonEliminar accion={quitarTarifa} id={t.id} texto="Quitar" mensaje="¿Quitar esta tarifa del convenio?" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}

            {puedeEditar && (
              <Formulario accion={guardarTarifa} className="mt-4 border-t border-tinta-200 pt-4" reiniciarAlEnviar>
                <input type="hidden" name="convenioId" value={convenio.id} />
                <div className="flex flex-wrap items-end gap-3">
                  <Campo etiqueta="Servicio" className="min-w-[14rem] flex-1">
                    <select name="servicioId" required className="campo">
                      <option value="">Selecciona…</option>
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} — {clp(s.precio)}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Precio convenio" className="w-36">
                    <input name="precioConvenio" type="number" min={0} step={100} defaultValue={0} className="campo" />
                  </Campo>
                  <Campo etiqueta="Cobertura %" className="w-28">
                    <input name="coberturaPorcentaje" type="number" min={0} max={100} step={1} defaultValue={0} className="campo" />
                  </Campo>
                  <Campo etiqueta="Cód. prestación" className="w-36">
                    <input name="codigoPrestacion" className="campo" />
                  </Campo>
                  <BotonEnviar variante="secundario">Guardar tarifa</BotonEnviar>
                </div>
              </Formulario>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pacientes adscritos" sinPadding>
            {convenio.pacientes.length === 0 ? (
              <p className="p-4 text-sm text-tinta-500">
                Ningún paciente tiene este convenio asignado. Se asigna en la ficha del paciente.
              </p>
            ) : (
              <ContenedorTabla>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>RUT</th>
                    <th>Nº afiliado</th>
                  </tr>
                </thead>
                <tbody>
                  {convenio.pacientes.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/pacientes/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          {p.apellidoPaterno}, {p.nombres}
                        </Link>
                      </td>
                      <td className="text-tinta-600">{formatearRut(p.rut) || '—'}</td>
                      <td className="text-tinta-600">{p.numeroAfiliado ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </ContenedorTabla>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Datos del convenio">
          <dl className="space-y-3">
            <Definicion termino="Tipo">{humanizar(convenio.tipo)}</Definicion>
            <Definicion termino="RUT">{formatearRut(convenio.rut)}</Definicion>
            <Definicion termino="Contacto">{convenio.contacto}</Definicion>
            <Definicion termino="Teléfono">{convenio.telefono}</Definicion>
            <Definicion termino="Correo">{convenio.email}</Definicion>
            <Definicion termino="Descuento general">{porcentaje(convenio.descuentoPorcentaje, 0)}</Definicion>
            <Definicion termino="Cobertura">{porcentaje(convenio.coberturaPorcentaje, 0)}</Definicion>
            <Definicion termino="Tope por prestación">
              {convenio.topePorPrestacion > 0 ? clp(convenio.topePorPrestacion) : 'Sin tope'}
            </Definicion>
            <Definicion termino="Autorización previa">
              {convenio.requiereAutorizacion ? 'Requerida' : 'No requerida'}
            </Definicion>
            <Definicion termino="Vigencia">
              {fechaCorta(convenio.vigenteDesde)} → {convenio.vigenteHasta ? fechaCorta(convenio.vigenteHasta) : 'indefinida'}
            </Definicion>
            <Definicion termino="Informes emitidos">{String(convenio._count.informes)}</Definicion>
            <Definicion termino="Observaciones">{convenio.observaciones}</Definicion>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
