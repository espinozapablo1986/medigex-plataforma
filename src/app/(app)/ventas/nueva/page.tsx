import { prisma } from '@/lib/prisma';
import { requerirPermiso } from '@/lib/auth';
import { clp, isoFecha } from '@/lib/format';
import { Aviso, Campo, EncabezadoPagina, Grilla, Tarjeta } from '@/components/ui';
import { BotonEnviar, Formulario } from '@/components/formulario';
import { EditorItems, type LineaItem } from '@/components/editor-items';
import { SelectorBuscable } from '@/components/selector';

import { crearVenta } from '../acciones';

export const metadata = { title: 'Nueva venta' };

export default async function PaginaNuevaVenta({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; presupuesto?: string; atencion?: string }>;
}) {
  const sesion = await requerirPermiso('ventas', 'crear');
  const { paciente: pacienteParam, presupuesto: presupuestoId, atencion: atencionId } = await searchParams;

  // Si viene de un presupuesto aceptado, precargamos sus líneas.
  const presupuesto = presupuestoId
    ? await prisma.presupuesto.findUnique({
        where: { id: presupuestoId },
        include: { items: { orderBy: { orden: 'asc' } }, paciente: { select: { id: true } } },
      })
    : null;

  const pacienteId = presupuesto?.paciente.id ?? pacienteParam;

  const [pacientes, profesionales, servicios, productos, convenios, config, pacienteSeleccionado] = await Promise.all([
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
    prisma.convenio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
    pacienteId
      ? prisma.paciente.findUnique({
          where: { id: pacienteId },
          include: {
            convenio: { select: { id: true, nombre: true, coberturaPorcentaje: true } },
            movimientosCuenta: { orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 1 },
          },
        })
      : null,
  ]);

  const lineasIniciales: LineaItem[] | undefined = presupuesto?.items.map((i) => ({
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

  const saldoActual = pacienteSeleccionado?.movimientosCuenta[0]?.saldoResultante ?? 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Nueva venta"
        descripcion="Registra las prestaciones y productos entregados. El cargo se refleja en la cuenta del paciente."
        volver={{ href: '/ventas', texto: 'Ventas' }}
      />

      {presupuesto && (
        <div className="mb-4">
          <Aviso tono="info" titulo={`Desde el presupuesto Nº ${presupuesto.folio}`}>
            Se precargaron sus {presupuesto.items.length} línea(s). Al guardar, el presupuesto quedará marcado como
            facturado.
          </Aviso>
        </div>
      )}

      {pacienteSeleccionado?.convenio && (
        <div className="mb-4">
          <Aviso tono="info" titulo={`Convenio: ${pacienteSeleccionado.convenio.nombre}`}>
            Se aplicarán las tarifas del convenio y se calculará la cobertura ({pacienteSeleccionado.convenio.coberturaPorcentaje}%)
            junto con el copago del paciente.
          </Aviso>
        </div>
      )}

      {saldoActual > 0 && (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="El paciente tiene saldo pendiente">
            Debe {clp(saldoActual)} de atenciones anteriores.
          </Aviso>
        </div>
      )}

      <Formulario accion={crearVenta} className="space-y-5">
        {presupuestoId && <input type="hidden" name="presupuestoId" value={presupuestoId} />}
        {atencionId && <input type="hidden" name="atencionId" value={atencionId} />}

        <Tarjeta titulo="Datos de la venta">
          <Grilla cols={3}>
            <Campo etiqueta="Paciente" requerido>
              <SelectorBuscable
                name="pacienteId"
                opciones={pacientes.map((p) => ({
                  valor: p.id,
                  etiqueta: `${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}, ${p.nombres}`.replace(/\s+/g, ' '),
                  detalle: p.rut ?? `Ficha ${p.numeroFicha}`,
                  buscarPor: p.rut ?? '',
                }))}
                valorInicial={pacienteId}
                placeholder="Busca por nombre o RUT…"
                permiteVacio={false}
                requerido
              />
            </Campo>
            <Campo etiqueta="Profesional responsable" ayuda="Base para el cálculo de comisiones.">
              <SelectorBuscable
                name="profesionalId"
                opciones={profesionales.map((p) => ({
                  valor: p.id,
                  etiqueta: `${p.apellidos}, ${p.nombres}`,
                  detalle: p.especialidad,
                }))}
                valorInicial={sesion.profesionalId}
                placeholder="Sin asignar"
                textoVacio="Sin asignar"
              />
            </Campo>
            <Campo etiqueta="Convenio" ayuda="Por defecto se usa el del paciente.">
              <SelectorBuscable
                name="convenioId"
                opciones={convenios.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                valorInicial={pacienteSeleccionado?.convenio?.id}
                placeholder="Sin convenio"
                textoVacio="Sin convenio"
              />
            </Campo>
            <Campo etiqueta="Fecha">
              <input name="fecha" type="date" defaultValue={isoFecha(new Date())} className="campo" />
            </Campo>
            <Campo etiqueta="Tipo de documento">
              <select name="tipoDocumento" defaultValue="BOLETA" className="campo">
                <option value="BOLETA">Boleta</option>
                <option value="FACTURA">Factura</option>
                <option value="BOLETA_EXENTA">Boleta exenta</option>
                <option value="NINGUNO">Sin documento</option>
              </select>
            </Campo>
            <Campo etiqueta="Nº de documento">
              <input name="numeroDocumento" className="campo" placeholder="Folio SII" />
            </Campo>
          </Grilla>
          <Campo etiqueta="Observaciones" className="mt-4">
            <textarea name="observaciones" rows={2} className="campo" />
          </Campo>
        </Tarjeta>

        <Tarjeta
          titulo="Detalle"
          descripcion="Asigna el profesional de cada línea para que la comisión se calcule correctamente."
        >
          <EditorItems
            servicios={servicios}
            productos={productos}
            profesionales={profesionales.map((p) => ({ id: p.id, nombre: `${p.apellidos}, ${p.nombres}` }))}
            ivaPorcentaje={config?.ivaPorcentaje ?? 19}
            lineasIniciales={lineasIniciales}
          />
        </Tarjeta>

        <div className="sticky bottom-4 flex justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <BotonEnviar tamano="lg">Registrar venta</BotonEnviar>
          </div>
        </div>
      </Formulario>
    </>
  );
}
