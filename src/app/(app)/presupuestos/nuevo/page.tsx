import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { isoFecha } from '@/lib/format';
import { Aviso, Campo, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';
import { EditorItems } from '@/components/editor-items';

import { crearPresupuesto } from '../acciones';

export const metadata = { title: 'Nuevo presupuesto' };

export default async function PaginaNuevoPresupuesto({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string }>;
}) {
  const sesion = await requerirPermiso('presupuestos', 'crear');
  const { paciente: pacienteId } = await searchParams;

  const [pacientes, profesionales, servicios, productos, config, pacienteSeleccionado] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: { apellidoPaterno: 'asc' },
      take: 500,
      select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, rut: true, numeroFicha: true },
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
    pacienteId
      ? prisma.paciente.findUnique({
          where: { id: pacienteId },
          include: { convenio: { select: { nombre: true, descuentoPorcentaje: true, coberturaPorcentaje: true } } },
        })
      : null,
  ]);

  const validez = new Date();
  validez.setDate(validez.getDate() + 30);

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo presupuesto"
        descripcion="Arma la propuesta con los servicios e insumos que recibirá el paciente."
        volver={{ href: '/presupuestos', texto: 'Presupuestos' }}
      />

      {pacienteSeleccionado?.convenio && (
        <div className="mb-4">
          <Aviso tono="info" titulo={`Paciente con convenio: ${pacienteSeleccionado.convenio.nombre}`}>
            Al guardar se aplicarán las tarifas negociadas del convenio a los servicios que las tengan definidas
            (descuento general {pacienteSeleccionado.convenio.descuentoPorcentaje}%, cobertura{' '}
            {pacienteSeleccionado.convenio.coberturaPorcentaje}%).
          </Aviso>
        </div>
      )}

      <Formulario accion={crearPresupuesto} className="space-y-5">
        <Tarjeta titulo="Datos generales">
          <Grilla cols={2}>
            <Campo etiqueta="Paciente" requerido>
              <select name="pacienteId" defaultValue={pacienteId ?? ''} required className="campo">
                <option value="">Selecciona un paciente…</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellidoPaterno} {p.apellidoMaterno ?? ''}, {p.nombres} — {p.rut ?? `Ficha ${p.numeroFicha}`}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Profesional responsable">
              <select name="profesionalId" defaultValue={sesion.profesionalId ?? ''} className="campo">
                <option value="">Sin asignar</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellidos}, {p.nombres} — {p.especialidad}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fecha">
              <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
            </Campo>
            <Campo etiqueta="Válido hasta" ayuda="Por defecto, 30 días.">
              <input name="validoHasta" type="date" defaultValue={isoFecha(validez)} className="campo" />
            </Campo>
          </Grilla>
          <Campo etiqueta="Observaciones para el paciente" className="mt-4">
            <textarea
              name="observaciones"
              rows={2}
              placeholder="Condiciones de pago, número de sesiones, etc."
              className="campo"
            />
          </Campo>
        </Tarjeta>

        <Tarjeta titulo="Detalle del presupuesto">
          <EditorItems
            servicios={servicios}
            productos={productos}
            profesionales={profesionales.map((p) => ({ id: p.id, nombre: `${p.apellidos}, ${p.nombres}` }))}
            ivaPorcentaje={config?.ivaPorcentaje ?? 19}
            mostrarProfesional={false}
          />
        </Tarjeta>

        <div className="sticky bottom-4 flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Crear presupuesto</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
