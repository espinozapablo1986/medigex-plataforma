import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { isoFecha } from '@/lib/format';
import { Campo, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';
import { EditorItems, type LineaItem } from '@/components/editor-items';

import { actualizarPresupuesto } from '../../acciones';

export const metadata = { title: 'Editar presupuesto' };

export default async function EditarPresupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirPermiso('presupuestos', 'editar');

  const [presupuesto, profesionales, servicios, productos, config] = await Promise.all([
    prisma.presupuesto.findUnique({
      where: { id },
      include: {
        paciente: { select: { nombres: true, apellidoPaterno: true, rut: true } },
        items: { orderBy: { orden: 'asc' } },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: 'asc' },
      select: { id: true, nombres: true, apellidos: true, especialidad: true },
    }),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, precio: true, afectoIva: true, duracionMinutos: true },
    }),
    prisma.producto.findMany({
      where: { activo: true, esVendible: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, sku: true, precioVenta: true, afectoIva: true, stockActual: true },
    }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
  ]);

  if (!presupuesto) notFound();

  const lineas: LineaItem[] = presupuesto.items.map((i) => ({
    tipo: i.tipo,
    servicioId: i.servicioId,
    productoId: i.productoId,
    profesionalId: null,
    descripcion: i.descripcion,
    piezaDental: i.piezaDental ?? '',
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    descuento: i.descuento,
    afectoIva: i.afectoIva,
  }));

  return (
    <>
      <EncabezadoPagina
        titulo={`Editar presupuesto Nº ${presupuesto.folio}`}
        descripcion={`${presupuesto.paciente.nombres} ${presupuesto.paciente.apellidoPaterno}`}
        volver={{ href: `/presupuestos/${id}`, texto: 'Volver al presupuesto' }}
      />

      <Formulario accion={actualizarPresupuesto} className="space-y-5">
        <input type="hidden" name="id" value={id} />

        <Tarjeta titulo="Datos generales">
          <Grilla cols={2}>
            <Campo etiqueta="Profesional responsable">
              <select name="profesionalId" defaultValue={presupuesto.profesionalId ?? sesion.profesionalId ?? ''} className="campo">
                <option value="">Sin asignar</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellidos}, {p.nombres} — {p.especialidad}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Válido hasta">
              <input
                name="validoHasta"
                type="date"
                defaultValue={presupuesto.validoHasta ? isoFecha(presupuesto.validoHasta) : ''}
                className="campo"
              />
            </Campo>
          </Grilla>
          <Campo etiqueta="Observaciones" className="mt-4">
            <textarea name="observaciones" rows={2} defaultValue={presupuesto.observaciones ?? ''} className="campo" />
          </Campo>
        </Tarjeta>

        <Tarjeta titulo="Detalle">
          <EditorItems
            servicios={servicios}
            productos={productos}
            ivaPorcentaje={config?.ivaPorcentaje ?? 19}
            lineasIniciales={lineas}
            mostrarProfesional={false}
          />
        </Tarjeta>

        <div className="sticky bottom-4 flex justify-end">
          <div className="rounded-xl border border-tinta-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Guardar cambios</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
