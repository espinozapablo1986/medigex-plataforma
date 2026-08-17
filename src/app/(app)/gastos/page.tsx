import { prisma } from '@/lib/prisma';
import { puede, requerirPermiso } from '@/lib/auth';
import { clp, fechaCorta, humanizar, isoFecha } from '@/lib/format';
import {
  Badge,
  BadgeEstado,
  Campo,
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Grilla,
  Metrica,
  Paginador,
  Tarjeta,
} from '@/components/ui';
import { BotonEliminar, BotonEnviar, Formulario, Modal } from '@/components/formulario';
import { SubirArchivos } from '@/components/subir-archivos';

import {
  crearCategoriaGasto,
  crearGasto,
  editarGasto,
  eliminarGasto,
  marcarGastoPagado,
} from './acciones';

export const metadata = { title: 'Gastos' };

const POR_PAGINA = 30;

const TIPOS_GASTO = [
  { valor: 'OPERACIONAL', texto: 'Operacional' },
  { valor: 'ADMINISTRATIVO', texto: 'Administrativo' },
  { valor: 'INSUMOS', texto: 'Insumos' },
  { valor: 'ARRIENDO', texto: 'Arriendo' },
  { valor: 'SERVICIOS_BASICOS', texto: 'Servicios básicos' },
  { valor: 'REMUNERACIONES', texto: 'Remuneraciones' },
  { valor: 'MARKETING', texto: 'Marketing' },
  { valor: 'EQUIPAMIENTO', texto: 'Equipamiento' },
  { valor: 'MANTENCION', texto: 'Mantención' },
  { valor: 'IMPUESTOS', texto: 'Impuestos' },
  { valor: 'HONORARIOS', texto: 'Honorarios' },
  { valor: 'OTRO', texto: 'Otro' },
];

const PERIODICIDADES = [
  { valor: 'UNICA', texto: 'Única vez' },
  { valor: 'MENSUAL', texto: 'Mensual' },
  { valor: 'BIMESTRAL', texto: 'Bimestral' },
  { valor: 'TRIMESTRAL', texto: 'Trimestral' },
  { valor: 'SEMESTRAL', texto: 'Semestral' },
  { valor: 'ANUAL', texto: 'Anual' },
];

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; categoria?: string; estado?: string; pagina?: string }>;
}) {
  const sesion = await requerirPermiso('gastos', 'ver');
  const { desde, hasta, categoria, estado, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, parseInt(paginaTexto ?? '1', 10) || 1);

  const hoy = new Date();
  const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fechaHasta = hasta ? new Date(`${hasta}T23:59:59`) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

  const where = {
    fecha: { gte: fechaDesde, lte: fechaHasta },
    ...(categoria ? { categoriaId: categoria } : {}),
    ...(estado ? { estado: estado as never } : {}),
  };

  const [gastos, total, agregado, categorias, proveedores, formasPago, porCategoria] = await Promise.all([
    prisma.gasto.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        categoria: true,
        proveedor: { select: { razonSocial: true } },
        formaPago: { select: { nombre: true } },
        adjuntos: { select: { id: true, nombreOriginal: true } },
        registradoPor: { select: { nombres: true, apellidos: true } },
      },
    }),
    prisma.gasto.count({ where }),
    prisma.gasto.aggregate({
      where: { ...where, estado: { not: 'ANULADO' } },
      _sum: { total: true, neto: true, iva: true },
    }),
    prisma.categoriaGasto.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: 'asc' } }),
    prisma.formaPago.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
    prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: { ...where, estado: { not: 'ANULADO' } },
      _sum: { total: true },
    }),
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);
  const filtros = new URLSearchParams();
  if (desde) filtros.set('desde', desde);
  if (hasta) filtros.set('hasta', hasta);
  if (categoria) filtros.set('categoria', categoria);
  if (estado) filtros.set('estado', estado);
  const base = `/gastos${filtros.toString() ? `?${filtros}` : ''}`;

  const pendientes = await prisma.gasto.aggregate({
    where: { ...where, estado: 'PENDIENTE' },
    _sum: { total: true },
    _count: true,
  });

  const mayorCategoria = porCategoria.sort((a, b) => (b._sum.total ?? 0) - (a._sum.total ?? 0))[0];
  const nombreCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría';

  const puedeCrear = puede(sesion, 'gastos', 'crear');
  const puedeEditar = puede(sesion, 'gastos', 'editar');

  const camposGasto = (g?: (typeof gastos)[number]) => (
    <>
      <Grilla cols={2}>
        <Campo etiqueta="Descripción" requerido>
          <input name="descripcion" defaultValue={g?.descripcion} required className="campo" />
        </Campo>
        <Campo etiqueta="Categoría">
          <select name="categoriaId" defaultValue={g?.categoriaId ?? ''} className="campo">
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Proveedor">
          <select name="proveedorId" defaultValue={g?.proveedorId ?? ''} className="campo">
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha del documento" requerido>
          <input name="fecha" type="date" defaultValue={g ? isoFecha(g.fecha) : isoFecha(new Date())} required className="campo" />
        </Campo>
        <Campo etiqueta="Tipo de documento">
          <select name="tipoDocumento" defaultValue={g?.tipoDocumento ?? 'FACTURA'} className="campo">
            <option value="FACTURA">Factura</option>
            <option value="BOLETA">Boleta</option>
            <option value="BOLETA_EXENTA">Boleta exenta</option>
            <option value="NINGUNO">Sin documento</option>
          </select>
        </Campo>
        <Campo etiqueta="Nº de documento">
          <input name="numeroDocumento" defaultValue={g?.numeroDocumento ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Total del documento (CLP)" requerido ayuda="Monto final pagado, IVA incluido.">
          <input name="total" type="number" min={1} step={1} defaultValue={g?.total ?? ''} required className="campo" />
        </Campo>
        <Campo etiqueta="IVA (CLP)" ayuda="Déjalo vacío para calcularlo automáticamente desde el total.">
          <input name="iva" type="number" min={0} step={1} defaultValue={g?.iva || ''} className="campo" />
        </Campo>
        <Campo etiqueta="Forma de pago">
          <select name="formaPagoId" defaultValue={g?.formaPagoId ?? ''} className="campo">
            <option value="">Sin especificar</option>
            {formasPago.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select name="estado" defaultValue={g?.estado ?? 'PAGADO'} className="campo">
            <option value="PAGADO">Pagado</option>
            <option value="PENDIENTE">Pendiente de pago</option>
            <option value="ANULADO">Anulado</option>
          </select>
        </Campo>
        <Campo etiqueta="Fecha de pago">
          <input name="fechaPago" type="date" defaultValue={g?.fechaPago ? isoFecha(g.fechaPago) : ''} className="campo" />
        </Campo>
        <Campo etiqueta="Periodicidad">
          <select name="periodicidad" defaultValue={g?.periodicidad ?? 'UNICA'} className="campo">
            {PERIODICIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </Campo>
      </Grilla>

      <Campo etiqueta="Respaldo del gasto" ayuda="Factura, boleta o comprobante." className="mt-4">
        <SubirArchivos
          name="documento"
          multiple={false}
          aceptar="image/*,application/pdf"
          etiquetaCamara="Fotografiar documento"
        />
      </Campo>

      <Campo etiqueta="Observaciones" className="mt-4">
        <textarea name="observaciones" rows={2} defaultValue={g?.observaciones ?? ''} className="campo" />
      </Campo>

      <fieldset className="mt-4 space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ivaRecuperable"
            defaultChecked={g?.ivaRecuperable ?? true}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          El IVA da derecho a crédito fiscal
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="esRecurrente"
            defaultChecked={g?.esRecurrente ?? false}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Es un gasto recurrente
        </label>
      </fieldset>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Gastos y compras"
        descripcion="Egresos del centro, con su documento tributario y el IVA crédito asociado."
        acciones={
          puedeCrear && (
            <>
              <Modal titulo="Nueva categoría de gasto" etiquetaBoton="Nueva categoría" varianteBoton="secundario" ancho="max-w-md">
                <Formulario accion={crearCategoriaGasto} className="space-y-4" reiniciarAlEnviar>
                  <Campo etiqueta="Nombre" requerido>
                    <input name="nombre" required className="campo" placeholder="Ej: Luz y agua" />
                  </Campo>
                  <Campo etiqueta="Tipo">
                    <select name="tipo" className="campo">
                      {TIPOS_GASTO.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.texto}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="deducible" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    Gasto deducible (aceptado tributariamente)
                  </label>
                  <div className="flex justify-end">
                    <BotonEnviar>Crear categoría</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>

              <Modal titulo="Nuevo gasto" etiquetaBoton="Nuevo gasto" ancho="max-w-3xl">
                <Formulario accion={crearGasto} className="space-y-4">
                  {camposGasto()}
                  <div className="flex justify-end">
                    <BotonEnviar>Registrar gasto</BotonEnviar>
                  </div>
                </Formulario>
              </Modal>
            </>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Total del período" valor={clp(agregado._sum.total ?? 0)} detalle={`${total} documentos`} tono="negativo" />
        <Metrica etiqueta="Neto" valor={clp(agregado._sum.neto ?? 0)} />
        <Metrica etiqueta="IVA crédito" valor={clp(agregado._sum.iva ?? 0)} detalle="Se descuenta del IVA a pagar" tono="marca" />
        <Metrica
          etiqueta="Pendientes de pago"
          valor={clp(pendientes._sum.total ?? 0)}
          detalle={`${pendientes._count} documento(s)`}
          tono={pendientes._count > 0 ? 'alerta' : 'neutro'}
        />
      </div>

      {mayorCategoria && (
        <div className="mb-4">
          <Badge tono="gris">
            Mayor gasto del período: {nombreCategoria(mayorCategoria.categoriaId)} · {clp(mayorCategoria._sum.total ?? 0)}
          </Badge>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde" className="w-40">
          <input name="desde" type="date" defaultValue={desde ?? isoFecha(fechaDesde)} className="campo" />
        </Campo>
        <Campo etiqueta="Hasta" className="w-40">
          <input name="hasta" type="date" defaultValue={hasta ?? isoFecha(fechaHasta)} className="campo" />
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
        <Campo etiqueta="Estado" className="w-40">
          <select name="estado" defaultValue={estado ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="PAGADO">Pagado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ANULADO">Anulado</option>
          </select>
        </Campo>
        <button type="submit" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {gastos.length === 0 ? (
        <EstadoVacio titulo="Sin gastos en el período" descripcion="Registra compras, arriendos, servicios y demás egresos." />
      ) : (
        <Tarjeta sinPadding>
          <ContenedorTabla>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th>Documento</th>
                <th className="text-right">Neto</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Total</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} className={g.estado === 'ANULADO' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-slate-500">{g.folio}</td>
                  <td className="whitespace-nowrap text-slate-600">{fechaCorta(g.fecha)}</td>
                  <td>
                    <p className="font-medium text-slate-800">{g.descripcion}</p>
                    {g.esRecurrente && <p className="text-xs text-slate-400">{humanizar(g.periodicidad)}</p>}
                  </td>
                  <td className="text-xs text-slate-600">{g.categoria?.nombre ?? '—'}</td>
                  <td className="text-xs text-slate-600">{g.proveedor?.razonSocial ?? '—'}</td>
                  <td className="text-xs text-slate-600">
                    {humanizar(g.tipoDocumento)}
                    {g.numeroDocumento && <p className="text-slate-400">{g.numeroDocumento}</p>}
                    {g.adjuntos.length > 0 && (
                      <a
                        href={`/api/adjuntos/${g.adjuntos[0].id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 hover:underline"
                      >
                        Ver respaldo
                      </a>
                    )}
                  </td>
                  <td className="text-right tabular-nums text-slate-600">{clp(g.neto)}</td>
                  <td className="text-right tabular-nums text-slate-500">
                    {g.iva > 0 ? clp(g.iva) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-right font-medium tabular-nums">{clp(g.total)}</td>
                  <td>
                    <BadgeEstado estado={g.estado} />
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {puedeEditar && g.estado === 'PENDIENTE' && (
                        <BotonEliminar
                          accion={marcarGastoPagado}
                          id={g.id}
                          texto="Marcar pagado"
                          mensaje="¿Confirmas que este gasto fue pagado?"
                        />
                      )}
                      {puedeEditar && (
                        <Modal
                          titulo={`Editar gasto Nº ${g.folio}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                          tamanoBoton="sm"
                          ancho="max-w-3xl"
                        >
                          <Formulario accion={editarGasto} className="space-y-4">
                            <input type="hidden" name="id" value={g.id} />
                            {camposGasto(g)}
                            <div className="flex justify-end">
                              <BotonEnviar>Guardar</BotonEnviar>
                            </div>
                          </Formulario>
                        </Modal>
                      )}
                      {puede(sesion, 'gastos', 'eliminar') && (
                        <BotonEliminar accion={eliminarGasto} id={g.id} variante="peligro" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
          <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} base={base} />
        </Tarjeta>
      )}
    </>
  );
}
