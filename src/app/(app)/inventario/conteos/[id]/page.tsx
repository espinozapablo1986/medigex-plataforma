import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaHora } from '@/lib/format';
import {
  Aviso,
  Badge,
  ContenedorTabla,
  EncabezadoPagina,
  Metrica,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar } from '@/components/formulario';

import { anularConteo, cerrarConteo } from '../acciones';
import { HojaConteo } from './hoja';
import { SubirConteo } from './subir';

export const metadata = { title: 'Conteo de inventario' };

export default async function PaginaConteo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('inventario', 'ver');

  const conteo = await prisma.conteoInventario.findUnique({
    where: { id },
    include: {
      categoria: { select: { nombre: true } },
      abiertoPor: { select: { nombres: true, apellidos: true } },
      cerradoPor: { select: { nombres: true, apellidos: true } },
      items: {
        include: {
          producto: {
            select: { sku: true, nombre: true, unidadMedida: true, ubicacion: true, costoPromedio: true },
          },
        },
        orderBy: { producto: { nombre: 'asc' } },
      },
    },
  });
  if (!conteo) notFound();

  const abierto = conteo.estado === 'ABIERTO';
  const puedeEditar = puede(sesion, 'inventario', 'editar') && abierto;
  const puedeAprobar = puede(sesion, 'inventario', 'aprobar') && abierto;

  const contados = conteo.items.filter((i) => i.stockContado !== null);
  const conDiferencia = contados.filter((i) => i.stockContado !== i.stockTeorico);

  // Valoriza la diferencia al costo promedio: es la cifra que le importa a
  // administración, más que el número de unidades descuadradas.
  const impacto = conDiferencia.reduce(
    (suma, i) => suma + (i.stockContado! - i.stockTeorico) * i.producto.costoPromedio,
    0,
  );

  return (
    <>
      <EncabezadoPagina
        titulo={`Conteo N.° ${conteo.folio} — ${conteo.nombre}`}
        ayuda="inventario"
        volver={{ href: '/inventario/conteos', texto: 'Conteos' }}
        descripcion={
          conteo.categoria?.nombre || conteo.ubicacion
            ? [conteo.categoria?.nombre, conteo.ubicacion].filter(Boolean).join(' · ')
            : 'Todas las categorías y ubicaciones.'
        }
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/inventario/plantilla?tipo=conteo&conteo=${conteo.id}`}
              className="inline-flex items-center gap-1.5 border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              <Download className="h-4 w-4" />
              Descargar planilla
            </a>
            {puedeAprobar && (
              <>
                <BotonEliminar
                  accion={cerrarConteo}
                  id={conteo.id}
                  texto="Cerrar y ajustar"
                  variante="primario"
                  tamano="md"
                  mensaje={
                    `Se aplicarán ${conDiferencia.length} ajustes de stock y el conteo quedará cerrado.\n\n` +
                    'Los ajustes quedan registrados como movimientos, así que se puede rastrear qué cambió y por qué. Esta acción no se deshace.'
                  }
                />
                <BotonEliminar
                  accion={anularConteo}
                  id={conteo.id}
                  texto="Anular"
                  variante="peligro"
                  tamano="md"
                  mensaje="Se descarta el conteo sin tocar el stock. ¿Continuamos?"
                />
              </>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Posiciones" valor={String(conteo.items.length)} />
        <Metrica
          etiqueta="Contadas"
          valor={`${contados.length}`}
          detalle={`${conteo.items.length - contados.length} pendientes`}
          tono={contados.length === conteo.items.length ? 'positivo' : 'neutro'}
        />
        <Metrica
          etiqueta="Con diferencia"
          valor={String(conDiferencia.length)}
          tono={conDiferencia.length > 0 ? 'negativo' : 'positivo'}
        />
        <Metrica
          etiqueta="Impacto valorizado"
          valor={new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
          }).format(impacto)}
          detalle="al costo promedio"
          tono={impacto < 0 ? 'negativo' : impacto > 0 ? 'positivo' : 'neutro'}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-tinta-600">
        <Badge tono={abierto ? 'ambar' : conteo.estado === 'CERRADO' ? 'verde' : 'gris'}>
          {conteo.estado.toLowerCase()}
        </Badge>
        <span>
          Abierto el {fechaHora(conteo.abiertoAt)}
          {conteo.abiertoPor && ` por ${conteo.abiertoPor.nombres} ${conteo.abiertoPor.apellidos}`}
        </span>
        {conteo.cerradoAt && (
          <span>
            · Cerrado el {fechaHora(conteo.cerradoAt)}
            {conteo.cerradoPor && ` por ${conteo.cerradoPor.nombres} ${conteo.cerradoPor.apellidos}`}
          </span>
        )}
      </div>

      {conteo.observaciones && (
        <div className="mb-5">
          <Aviso tono="info" titulo="Observaciones del conteo">
            {conteo.observaciones}
          </Aviso>
        </div>
      )}

      {abierto ? (
        <>
          {puedeEditar && (
            <Tarjeta
              titulo="Cargar desde planilla"
              descripcion="Si contaste en papel o en el teléfono, descarga la planilla, escribe las cantidades y súbela aquí."
              className="mb-5"
            >
              <SubirConteo conteoId={conteo.id} />
            </Tarjeta>
          )}

          <HojaConteo
            conteoId={conteo.id}
            puedeEditar={puedeEditar}
            items={conteo.items.map((i) => ({
              id: i.id,
              sku: i.producto.sku,
              nombre: i.producto.nombre,
              unidad: i.producto.unidadMedida,
              ubicacion: i.producto.ubicacion,
              stockTeorico: i.stockTeorico,
              stockContado: i.stockContado,
              observaciones: i.observaciones,
            }))}
          />
        </>
      ) : (
        <Tarjeta titulo="Resultado del conteo" sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Ubicación</th>
                <th className="text-right">Sistema</th>
                <th className="text-right">Contado</th>
                <th className="text-right">Diferencia</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {conteo.items.map((i) => {
                const dif = i.stockContado === null ? null : i.stockContado - i.stockTeorico;
                return (
                  <tr key={i.id}>
                    <td>
                      <p className="font-medium text-brand-900">{i.producto.nombre}</p>
                      <p className="dato text-xs">{i.producto.sku}</p>
                    </td>
                    <td className="text-xs text-tinta-500">{i.producto.ubicacion ?? '—'}</td>
                    <td className="text-right tabular-nums text-tinta-500">{i.stockTeorico}</td>
                    <td className="text-right tabular-nums">
                      {i.stockContado === null ? <span className="text-tinta-300">sin contar</span> : i.stockContado}
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums ${
                        dif === null ? 'text-tinta-300' : dif === 0 ? 'text-tinta-400' : dif > 0 ? 'text-exito' : 'text-error'
                      }`}
                    >
                      {dif === null ? '—' : dif > 0 ? `+${dif}` : dif}
                    </td>
                    <td className="text-xs text-tinta-600">{i.observaciones ?? '—'}</td>
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
