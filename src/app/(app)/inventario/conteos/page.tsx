import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { fechaHora } from '@/lib/format';
import {
  Badge,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Tarjeta,
} from '@/components/ui';
import { BotonEnviar, Formulario, Modal } from '@/components/formulario';

import { abrirConteo } from './acciones';

export const metadata = { title: 'Conteos de inventario' };

const TONO: Record<string, 'verde' | 'ambar' | 'gris'> = {
  ABIERTO: 'ambar',
  CERRADO: 'verde',
  ANULADO: 'gris',
};

export default async function PaginaConteos() {
  const sesion = await requerirPermiso('inventario', 'ver');

  const [conteos, categorias] = await Promise.all([
    prisma.conteoInventario.findMany({
      orderBy: { abiertoAt: 'desc' },
      take: 50,
      include: {
        categoria: { select: { nombre: true } },
        abiertoPor: { select: { nombres: true, apellidos: true } },
        _count: { select: { items: true } },
        items: { select: { stockContado: true } },
      },
    }),
    prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } }),
  ]);

  const puedeCrear = puede(sesion, 'inventario', 'crear');

  return (
    <>
      <EncabezadoPagina
        titulo="Conteos de inventario"
        ayuda="inventario"
        descripcion="Recuento físico de las existencias, para que el stock del sistema deje de ser una suposición."
        volver={{ href: '/inventario', texto: 'Inventario' }}
        acciones={
          puedeCrear && (
            <Modal titulo="Nuevo conteo" etiquetaBoton="Nuevo conteo">
              <Formulario accion={abrirConteo} className="space-y-4">
                <Campo etiqueta="Nombre del conteo" requerido ayuda="Por ejemplo: «Bodega principal — agosto».">
                  <input name="nombre" required className="campo" />
                </Campo>
                <Grilla cols={2}>
                  <Campo etiqueta="Sólo una categoría" ayuda="Vacío incluye todas.">
                    <select name="categoriaId" className="campo">
                      <option value="">Todas las categorías</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Sólo una ubicación" ayuda="Coincidencia parcial: «Bodega A».">
                    <input name="ubicacion" className="campo" placeholder="Todas las ubicaciones" />
                  </Campo>
                </Grilla>
                <Campo etiqueta="Observaciones">
                  <textarea name="observaciones" rows={2} className="campo" />
                </Campo>
                <p className="text-xs text-tinta-500">
                  Al abrirlo se congela la existencia teórica de cada producto. Las salidas por atenciones que ocurran
                  mientras cuentas no se confundirán con diferencias de bodega.
                </p>
                <div className="flex justify-end">
                  <BotonEnviar>Abrir conteo</BotonEnviar>
                </div>
              </Formulario>
            </Modal>
          )
        }
      />

      {conteos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no se ha hecho ningún conteo"
          descripcion="Un conteo compara lo que dice el sistema con lo que hay en la repisa, y deja registrada la diferencia."
        />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Conteo</th>
                <th>Alcance</th>
                <th className="text-right">Avance</th>
                <th>Abierto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conteos.map((c) => {
                const contados = c.items.filter((i) => i.stockContado !== null).length;
                const total = c._count.items;
                return (
                  <tr key={c.id}>
                    <td className="dato">{c.folio}</td>
                    <td>
                      <Link href={`/inventario/conteos/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.nombre}
                      </Link>
                      <p className="text-xs text-tinta-400">
                        {c.abiertoPor ? `${c.abiertoPor.nombres} ${c.abiertoPor.apellidos}` : '—'}
                      </p>
                    </td>
                    <td className="text-xs text-tinta-600">
                      {c.categoria?.nombre ?? 'Todas las categorías'}
                      {c.ubicacion && <div>{c.ubicacion}</div>}
                    </td>
                    <td className="text-right tabular-nums text-tinta-600">
                      {contados} / {total}
                    </td>
                    <td className="whitespace-nowrap text-xs text-tinta-600">{fechaHora(c.abiertoAt)}</td>
                    <td>
                      <Badge tono={TONO[c.estado] ?? 'gris'}>{c.estado.toLowerCase()}</Badge>
                    </td>
                    <td className="text-right">
                      <Link href={`/inventario/conteos/${c.id}`} className="text-sm text-brand-600 hover:underline">
                        {c.estado === 'ABIERTO' ? 'Continuar' : 'Ver'}
                      </Link>
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
