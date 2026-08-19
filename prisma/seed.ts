/**
 * Semilla de MEDIGEX.
 *
 * Es idempotente: se puede ejecutar varias veces sin duplicar datos.
 * Crea la configuración base, los roles con su matriz de permisos, el usuario
 * administrador y un juego de datos de demostración para poder probar el
 * sistema de punta a punta.
 *
 *   npm run seed
 *   SEED_DEMO=0 npm run seed   → sólo lo imprescindible, sin datos de ejemplo
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { MODULOS, ROLES_SEMILLA, expandirPermisos } from '../src/lib/permissions';

const prisma = new PrismaClient();

const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD || 'Medigex2026!';
const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL || 'admin@medigex.cl';
const CON_DEMO = process.env.SEED_DEMO !== '0';

/**
 * Asocia cada condición dental con el servicio que se cobra por ella.
 *
 * Es idempotente y respeta al administrador: sólo escribe donde todavía no hay
 * nada. Un servicio que aún no existe simplemente se salta, y el enlace se
 * hará la próxima vez que se siembre, cuando ya esté en el tarifario.
 */
async function enlazarCondicionesConServicios(
  condiciones: { codigo: string; servicio: string | null }[],
) {
  let enlazadas = 0;
  let pendientes = 0;

  for (const { codigo, servicio } of condiciones) {
    if (!servicio) continue;

    const condicion = await prisma.condicionDental.findUnique({
      where: { codigo },
      select: { id: true, servicioId: true },
    });
    if (!condicion) continue;
    if (condicion.servicioId) continue; // ya enlazada, a mano o antes

    const asociado = await prisma.servicio.findUnique({ where: { codigo: servicio } });
    if (!asociado) {
      pendientes++;
      continue;
    }

    await prisma.condicionDental.update({ where: { codigo }, data: { servicioId: asociado.id } });
    enlazadas++;
  }

  if (enlazadas > 0) log(`${enlazadas} condiciones dentales enlazadas a su servicio.`);
  if (pendientes > 0) {
    log(`${pendientes} condiciones esperan un servicio que aún no está en el tarifario.`);
  }
}

function log(mensaje: string) {
  console.log(`  ${mensaje}`);
}

async function main() {
  console.log('\n🌱 Sembrando MEDIGEX…\n');

  // ── Configuración del centro ─────────────────────────────────
  await prisma.configuracion.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      nombreClinica: 'Centro Clínico Demo',
      giro: 'Servicios odontológicos y médicos',
      ivaPorcentaje: 19,
      moneda: 'CLP',
      zonaHoraria: 'America/Santiago',
      horaApertura: '08:00',
      horaCierre: '20:00',
      diasHabiles: '1,2,3,4,5,6',
      duracionSlotDefecto: 30,
    },
    update: {},
  });
  log('Configuración del centro lista.');

  // ── Roles y matriz de permisos ───────────────────────────────
  for (const semilla of ROLES_SEMILLA) {
    const rol = await prisma.rol.upsert({
      where: { slug: semilla.slug },
      create: {
        slug: semilla.slug,
        nombre: semilla.nombre,
        descripcion: semilla.descripcion,
        esSistema: true,
      },
      update: { nombre: semilla.nombre, descripcion: semilla.descripcion, esSistema: true },
    });

    // Sincroniza los permisos: añade los que falten sin pisar ajustes manuales
    // de los módulos ya existentes.
    const existentes = await prisma.rolPermiso.findMany({ where: { rolId: rol.id } });
    const yaDefinidos = new Set(existentes.map((p) => `${p.modulo}.${p.accion}`));

    const nuevos = expandirPermisos(semilla.permisos).filter(
      (p) => !yaDefinidos.has(`${p.modulo}.${p.accion}`),
    );

    if (nuevos.length > 0) {
      await prisma.rolPermiso.createMany({
        data: nuevos.map((p) => ({ rolId: rol.id, ...p })),
        skipDuplicates: true,
      });
    }
  }
  log(`${ROLES_SEMILLA.length} roles y ${MODULOS.length} módulos de permisos configurados.`);

  // ── Usuario administrador ────────────────────────────────────
  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { slug: 'administrador' } });

  const admin = await prisma.usuario.upsert({
    where: { email: EMAIL_ADMIN },
    create: {
      email: EMAIL_ADMIN,
      passwordHash: await bcrypt.hash(PASSWORD_ADMIN, 12),
      nombres: 'Administrador',
      apellidos: 'MEDIGEX',
      rolId: rolAdmin.id,
      debeCambiarPassword: true,
    },
    update: { rolId: rolAdmin.id, activo: true },
  });
  log(`Usuario administrador: ${admin.email}`);

  // ── Formas de pago ───────────────────────────────────────────
  const formasPago = [
    { nombre: 'Efectivo', tipo: 'EFECTIVO' as const, orden: 1 },
    { nombre: 'Tarjeta de débito', tipo: 'DEBITO' as const, orden: 2, requiereReferencia: true, comisionPorcentaje: 0.8 },
    { nombre: 'Tarjeta de crédito', tipo: 'CREDITO' as const, orden: 3, requiereReferencia: true, comisionPorcentaje: 2.5 },
    {
      nombre: 'Transferencia bancaria',
      tipo: 'TRANSFERENCIA' as const,
      orden: 4,
      requiereComprobante: true,
      requiereReferencia: true,
    },
    { nombre: 'Bono Isapre', tipo: 'ISAPRE' as const, orden: 5, requiereComprobante: true },
    { nombre: 'Bono Fonasa', tipo: 'FONASA' as const, orden: 6, requiereComprobante: true },
    { nombre: 'Cheque', tipo: 'CHEQUE' as const, orden: 7, requiereReferencia: true },
  ];

  for (const forma of formasPago) {
    await prisma.formaPago.upsert({ where: { nombre: forma.nombre }, create: forma, update: {} });
  }
  log(`${formasPago.length} formas de pago.`);

  // ── Previsiones ──────────────────────────────────────────────
  // La migración ya deja el juego base; aquí sólo se asegura que exista
  // en instalaciones nuevas creadas con `prisma db push`.
  const previsiones = [
    { codigo: 'PARTICULAR', nombre: 'Particular', tipo: 'PARTICULAR' as const, orden: 1 },
    { codigo: 'FONASA', nombre: 'Fonasa', tipo: 'FONASA' as const, orden: 2, requiereDetalle: true, etiquetaDetalle: 'Tramo (A, B, C o D)' },
    { codigo: 'ISAPRE_BANMEDICA', nombre: 'Isapre Banmédica', tipo: 'ISAPRE' as const, orden: 10, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_COLMENA', nombre: 'Isapre Colmena', tipo: 'ISAPRE' as const, orden: 11, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_CONSALUD', nombre: 'Isapre Consalud', tipo: 'ISAPRE' as const, orden: 12, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_CRUZ_BLANCA', nombre: 'Isapre Cruz Blanca', tipo: 'ISAPRE' as const, orden: 13, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_NUEVA_MASVIDA', nombre: 'Isapre Nueva Masvida', tipo: 'ISAPRE' as const, orden: 14, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_VIDA_TRES', nombre: 'Isapre Vida Tres', tipo: 'ISAPRE' as const, orden: 15, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_ESENCIAL', nombre: 'Isapre Esencial', tipo: 'ISAPRE' as const, orden: 16, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE_FUNDACION', nombre: 'Isapre Fundación', tipo: 'ISAPRE' as const, orden: 17, requiereDetalle: true, etiquetaDetalle: 'Nº de plan' },
    { codigo: 'ISAPRE', nombre: 'Isapre (sin especificar)', tipo: 'ISAPRE' as const, orden: 18, requiereDetalle: true, etiquetaDetalle: 'Nombre de la Isapre' },
    { codigo: 'SEGURO_COMPLEMENTARIO', nombre: 'Seguro complementario', tipo: 'SEGURO_COMPLEMENTARIO' as const, orden: 30, requiereDetalle: true, etiquetaDetalle: 'Compañía y póliza' },
    { codigo: 'OTRO', nombre: 'Otra previsión', tipo: 'OTRO' as const, orden: 90, requiereDetalle: true, etiquetaDetalle: 'Detalle' },
  ];

  for (const prevision of previsiones) {
    await prisma.prevision.upsert({ where: { codigo: prevision.codigo }, create: prevision, update: {} });
  }
  log(`${previsiones.length} previsiones.`);

  // ── Categorías de gasto ──────────────────────────────────────
  const categoriasGasto = [
    { nombre: 'Arriendo del local', tipo: 'ARRIENDO' as const },
    { nombre: 'Luz, agua e internet', tipo: 'SERVICIOS_BASICOS' as const },
    { nombre: 'Insumos clínicos', tipo: 'INSUMOS' as const },
    { nombre: 'Remuneraciones', tipo: 'REMUNERACIONES' as const },
    { nombre: 'Honorarios profesionales', tipo: 'HONORARIOS' as const },
    { nombre: 'Marketing y publicidad', tipo: 'MARKETING' as const },
    { nombre: 'Mantención de equipos', tipo: 'MANTENCION' as const },
    { nombre: 'Equipamiento', tipo: 'EQUIPAMIENTO' as const },
    { nombre: 'Impuestos y patentes', tipo: 'IMPUESTOS' as const },
    { nombre: 'Gastos generales', tipo: 'OPERACIONAL' as const },
  ];

  for (const categoria of categoriasGasto) {
    await prisma.categoriaGasto.upsert({ where: { nombre: categoria.nombre }, create: categoria, update: {} });
  }
  log(`${categoriasGasto.length} categorías de gasto.`);

  // ── Condiciones dentales ─────────────────────────────────────
  // Nomenclatura habitual en Chile. Es dato base, no de demostración: sin
  // catálogo el odontograma no se puede usar. Cada centro puede agregar las
  // suyas desde Configuración.
  const condiciones = [
    // Diagnósticos: en rojo, siguiendo la convención del odontograma
    { codigo: 'CARIES', nombre: 'Caries', categoria: 'DIAGNOSTICO' as const, color: '#B94642', porCara: true, orden: 1, servicio: null },
    { codigo: 'FRACTURA', nombre: 'Fractura', categoria: 'DIAGNOSTICO' as const, color: '#8C3432', porCara: true, orden: 2, servicio: null },
    { codigo: 'DESGASTE', nombre: 'Desgaste / atrición', categoria: 'DIAGNOSTICO' as const, color: '#CA933E', porCara: true, orden: 3, servicio: null },
    { codigo: 'RECIDIVA', nombre: 'Caries recidivante', categoria: 'DIAGNOSTICO' as const, color: '#9F1239', porCara: true, orden: 4, servicio: null },
    { codigo: 'AUSENTE', nombre: 'Pieza ausente', categoria: 'DIAGNOSTICO' as const, color: '#6E8790', porCara: false, orden: 10, servicio: null },
    { codigo: 'EXTRACCION_IND', nombre: 'Indicación de extracción', categoria: 'DIAGNOSTICO' as const, color: '#8C3432', porCara: false, orden: 11, servicio: null },
    { codigo: 'MOVILIDAD', nombre: 'Movilidad', categoria: 'DIAGNOSTICO' as const, color: '#CA933E', porCara: false, orden: 12, servicio: null },
    // Procedimientos: en verde cuando ya están hechos
    { codigo: 'OBTURACION', nombre: 'Obturación', categoria: 'PROCEDIMIENTO' as const, color: '#318454', porCara: true, orden: 20, servicio: 'OD-003' },
    { codigo: 'SELLANTE', nombre: 'Sellante', categoria: 'PROCEDIMIENTO' as const, color: '#5EC8B8', porCara: true, orden: 21, servicio: null },
    { codigo: 'CORONA', nombre: 'Corona', categoria: 'PROCEDIMIENTO' as const, color: '#2A6B80', porCara: false, orden: 22, servicio: null },
    { codigo: 'ENDODONCIA', nombre: 'Endodoncia', categoria: 'PROCEDIMIENTO' as const, color: '#155265', porCara: false, orden: 23, servicio: 'EN-001' },
    { codigo: 'EXTRACCION', nombre: 'Extracción realizada', categoria: 'PROCEDIMIENTO' as const, color: '#385863', porCara: false, orden: 24, servicio: 'OD-004' },
    { codigo: 'IMPLANTE', nombre: 'Implante', categoria: 'PROCEDIMIENTO' as const, color: '#6BB8C4', porCara: false, orden: 25, servicio: null },
    { codigo: 'PROTESIS', nombre: 'Prótesis', categoria: 'PROCEDIMIENTO' as const, color: '#95AEB7', porCara: false, orden: 26, servicio: null },
    { codigo: 'DESTARTRAJE', nombre: 'Destartraje', categoria: 'PROCEDIMIENTO' as const, color: '#318454', porCara: false, orden: 27, servicio: 'OD-002' },
  ];

  for (const { servicio, ...datos } of condiciones) {
    await prisma.condicionDental.upsert({ where: { codigo: datos.codigo }, create: datos, update: {} });
  }
  log(`${condiciones.length} condiciones dentales.`);

  // Enlaza cada procedimiento con el servicio que se le cobra al paciente, que
  // es lo que permite generar un presupuesto desde el odontograma.
  //
  // Va aquí y no en la sección de demostración: antes vivía después del
  // `return` de la semilla base, así que una instalación real se quedaba con
  // el catálogo dental sin enlazar y el botón «Armar presupuesto» sin nada que
  // presupuestar.
  //
  // Sólo rellena lo que está vacío. Si un administrador eligió otro servicio
  // desde Configuración, esa decisión manda y la semilla no la pisa.
  await enlazarCondicionesConServicios(condiciones);

  if (!CON_DEMO) {
    console.log('\n✅ Semilla base lista (sin datos de demostración).\n');
    return;
  }

  // ═══════════════════════════════════════════════════════════
  //  Datos de demostración
  // ═══════════════════════════════════════════════════════════

  // ── Boxes ────────────────────────────────────────────────────
  const boxes = [
    { codigo: 'B1', nombre: 'Box dental 1', tipo: 'BOX_DENTAL' as const, ubicacion: '1er piso', valorArriendoHora: 12000 },
    { codigo: 'B2', nombre: 'Box dental 2', tipo: 'BOX_DENTAL' as const, ubicacion: '1er piso', valorArriendoHora: 12000 },
    { codigo: 'B3', nombre: 'Box médico', tipo: 'BOX_MEDICO' as const, ubicacion: '2do piso', valorArriendoHora: 10000 },
    { codigo: 'RX', nombre: 'Sala de rayos X', tipo: 'SALA_RAYOS_X' as const, ubicacion: '1er piso', valorArriendoHora: 15000 },
    { codigo: 'PROC', nombre: 'Sala de procedimientos', tipo: 'SALA_PROCEDIMIENTOS' as const, ubicacion: '2do piso' },
  ];

  for (const box of boxes) {
    await prisma.box.upsert({ where: { codigo: box.codigo }, create: box, update: {} });
  }
  const boxB1 = await prisma.box.findUniqueOrThrow({ where: { codigo: 'B1' } });
  const boxB2 = await prisma.box.findUniqueOrThrow({ where: { codigo: 'B2' } });
  const boxB3 = await prisma.box.findUniqueOrThrow({ where: { codigo: 'B3' } });
  const boxRX = await prisma.box.findUniqueOrThrow({ where: { codigo: 'RX' } });
  log(`${boxes.length} boxes y salas.`);

  // ── Categorías de servicio ───────────────────────────────────
  const categoriasServicio = [
    { nombre: 'Odontología general', color: '#3384fb', orden: 1 },
    { nombre: 'Endodoncia', color: '#8b5cf6', orden: 2 },
    { nombre: 'Ortodoncia', color: '#ec4899', orden: 3 },
    { nombre: 'Estética dental', color: '#f59e0b', orden: 4 },
    { nombre: 'Imagenología', color: '#06b6d4', orden: 5 },
    { nombre: 'Consulta médica', color: '#10b981', orden: 6 },
  ];

  for (const categoria of categoriasServicio) {
    await prisma.categoriaServicio.upsert({ where: { nombre: categoria.nombre }, create: categoria, update: {} });
  }
  const catGeneral = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Odontología general' } });
  const catEndo = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Endodoncia' } });
  const catOrto = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Ortodoncia' } });
  const catEstetica = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Estética dental' } });
  const catImagen = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Imagenología' } });
  const catMedica = await prisma.categoriaServicio.findUniqueOrThrow({ where: { nombre: 'Consulta médica' } });

  // ── Servicios ────────────────────────────────────────────────
  const servicios = [
    { codigo: 'OD-001', nombre: 'Consulta odontológica', categoriaId: catGeneral.id, precio: 25000, costoEstimado: 3000, duracionMinutos: 30, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'OD-002', nombre: 'Destartraje (limpieza)', categoriaId: catGeneral.id, precio: 45000, costoEstimado: 6000, duracionMinutos: 45, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'OD-003', nombre: 'Obturación con resina', categoriaId: catGeneral.id, precio: 55000, costoEstimado: 9000, duracionMinutos: 45, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'OD-004', nombre: 'Extracción simple', categoriaId: catGeneral.id, precio: 60000, costoEstimado: 8000, duracionMinutos: 45, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'EN-001', nombre: 'Endodoncia unirradicular', categoriaId: catEndo.id, precio: 180000, costoEstimado: 25000, duracionMinutos: 90, tipoBoxRequerido: 'BOX_DENTAL' as const, comisionPorcentaje: 45 },
    { codigo: 'EN-002', nombre: 'Endodoncia multirradicular', categoriaId: catEndo.id, precio: 250000, costoEstimado: 35000, duracionMinutos: 120, tipoBoxRequerido: 'BOX_DENTAL' as const, comisionPorcentaje: 45 },
    { codigo: 'OR-001', nombre: 'Instalación de ortodoncia', categoriaId: catOrto.id, precio: 450000, costoEstimado: 90000, duracionMinutos: 90, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'OR-002', nombre: 'Control de ortodoncia', categoriaId: catOrto.id, precio: 35000, costoEstimado: 4000, duracionMinutos: 30, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'ES-001', nombre: 'Blanqueamiento dental', categoriaId: catEstetica.id, precio: 180000, costoEstimado: 40000, duracionMinutos: 60, tipoBoxRequerido: 'BOX_DENTAL' as const },
    { codigo: 'RX-001', nombre: 'Radiografía periapical', categoriaId: catImagen.id, precio: 15000, costoEstimado: 2000, duracionMinutos: 15, usaRayosX: true, tipoBoxRequerido: 'SALA_RAYOS_X' as const, comisionTipo: 'MONTO_FIJO' as const, comisionMontoFijo: 3000 },
    { codigo: 'RX-002', nombre: 'Radiografía panorámica', categoriaId: catImagen.id, precio: 35000, costoEstimado: 4000, duracionMinutos: 20, usaRayosX: true, tipoBoxRequerido: 'SALA_RAYOS_X' as const, comisionTipo: 'MONTO_FIJO' as const, comisionMontoFijo: 6000 },
    { codigo: 'MED-001', nombre: 'Consulta medicina general', categoriaId: catMedica.id, precio: 35000, costoEstimado: 2000, duracionMinutos: 30, tipoBoxRequerido: 'BOX_MEDICO' as const },
    { codigo: 'MED-002', nombre: 'Control médico', categoriaId: catMedica.id, precio: 25000, costoEstimado: 1500, duracionMinutos: 20, tipoBoxRequerido: 'BOX_MEDICO' as const },
  ];

  for (const servicio of servicios) {
    await prisma.servicio.upsert({ where: { codigo: servicio.codigo }, create: servicio, update: {} });
  }
  log(`${servicios.length} servicios en el catálogo.`);

  // Los servicios acaban de crearse, así que se reintenta el enlace: en una
  // base recién sembrada, cuando corrió la semilla base todavía no existían.
  await enlazarCondicionesConServicios(condiciones);

  // ── Proveedores ──────────────────────────────────────────────
  const proveedores = [
    { rut: '76543210-8', razonSocial: 'Dental Supply SpA', giro: 'Venta de insumos dentales', telefono: '+56 2 2345 6789', email: 'ventas@dentalsupply.cl' },
    { rut: '77112233-4', razonSocial: 'Insumos Médicos del Sur Ltda.', giro: 'Distribución de insumos médicos', telefono: '+56 2 2987 6543' },
  ];

  for (const proveedor of proveedores) {
    await prisma.proveedor.upsert({ where: { rut: proveedor.rut }, create: proveedor, update: {} });
  }
  const provDental = await prisma.proveedor.findUniqueOrThrow({ where: { rut: '76543210-8' } });

  // ── Inventario ───────────────────────────────────────────────
  const categoriasProducto = ['Material de obturación', 'Anestésicos', 'Protección y descartables', 'Instrumental', 'Ortodoncia'];
  for (const nombre of categoriasProducto) {
    await prisma.categoriaProducto.upsert({ where: { nombre }, create: { nombre }, update: {} });
  }
  const catObturacion = await prisma.categoriaProducto.findUniqueOrThrow({ where: { nombre: 'Material de obturación' } });
  const catAnestesia = await prisma.categoriaProducto.findUniqueOrThrow({ where: { nombre: 'Anestésicos' } });
  const catDescartable = await prisma.categoriaProducto.findUniqueOrThrow({ where: { nombre: 'Protección y descartables' } });

  const productos = [
    { sku: 'RES-A2', nombre: 'Resina compuesta A2', categoriaId: catObturacion.id, proveedorId: provDental.id, stock: 40, stockMinimo: 10, costo: 8500, unidadMedida: 'UNIDAD' as const },
    { sku: 'ADH-UNI', nombre: 'Adhesivo universal 5 ml', categoriaId: catObturacion.id, proveedorId: provDental.id, stock: 15, stockMinimo: 5, costo: 22000, unidadMedida: 'UNIDAD' as const },
    { sku: 'ANE-LID', nombre: 'Lidocaína 2% c/epinefrina', categoriaId: catAnestesia.id, proveedorId: provDental.id, stock: 120, stockMinimo: 30, costo: 900, unidadMedida: 'UNIDAD' as const, controlaLote: true },
    { sku: 'AGU-30G', nombre: 'Aguja dental 30G corta', categoriaId: catDescartable.id, proveedorId: provDental.id, stock: 300, stockMinimo: 100, costo: 180, unidadMedida: 'UNIDAD' as const },
    { sku: 'GUA-M', nombre: 'Guantes de nitrilo talla M', categoriaId: catDescartable.id, proveedorId: provDental.id, stock: 25, stockMinimo: 10, costo: 6500, unidadMedida: 'CAJA' as const },
    { sku: 'MAS-QUI', nombre: 'Mascarilla quirúrgica', categoriaId: catDescartable.id, proveedorId: provDental.id, stock: 8, stockMinimo: 10, costo: 3500, unidadMedida: 'CAJA' as const },
    { sku: 'CEP-INT', nombre: 'Cepillo interdental (venta)', categoriaId: catDescartable.id, proveedorId: provDental.id, stock: 50, stockMinimo: 15, costo: 1200, precioVenta: 2500, esVendible: true, unidadMedida: 'UNIDAD' as const },
    { sku: 'PAS-BLQ', nombre: 'Kit blanqueamiento domiciliario', categoriaId: catObturacion.id, proveedorId: provDental.id, stock: 12, stockMinimo: 4, costo: 28000, precioVenta: 55000, esVendible: true, unidadMedida: 'SET' as const },
  ];

  for (const p of productos) {
    const existente = await prisma.producto.findUnique({ where: { sku: p.sku } });
    if (existente) continue;

    const creado = await prisma.producto.create({
      data: {
        sku: p.sku,
        nombre: p.nombre,
        categoriaId: p.categoriaId,
        proveedorId: p.proveedorId,
        unidadMedida: p.unidadMedida,
        stockActual: p.stock,
        stockMinimo: p.stockMinimo,
        stockMaximo: p.stockMinimo * 6,
        costoPromedio: p.costo,
        precioVenta: p.precioVenta ?? 0,
        esVendible: p.esVendible ?? false,
        esInsumo: !p.esVendible,
        controlaLote: p.controlaLote ?? false,
      },
    });

    await prisma.movimientoStock.create({
      data: {
        productoId: creado.id,
        tipo: 'INVENTARIO_INICIAL',
        cantidad: p.stock,
        costoUnitario: p.costo,
        stockAnterior: 0,
        stockResultante: p.stock,
        motivo: 'Carga inicial de inventario',
        usuarioId: admin.id,
      },
    });
  }
  log(`${productos.length} productos con stock inicial.`);

  // ── Insumos por servicio ─────────────────────────────────────
  const obturacion = await prisma.servicio.findUniqueOrThrow({ where: { codigo: 'OD-003' } });
  const extraccion = await prisma.servicio.findUniqueOrThrow({ where: { codigo: 'OD-004' } });
  const resina = await prisma.producto.findUniqueOrThrow({ where: { sku: 'RES-A2' } });
  const adhesivo = await prisma.producto.findUniqueOrThrow({ where: { sku: 'ADH-UNI' } });
  const anestesia = await prisma.producto.findUniqueOrThrow({ where: { sku: 'ANE-LID' } });
  const aguja = await prisma.producto.findUniqueOrThrow({ where: { sku: 'AGU-30G' } });

  const insumos = [
    { servicioId: obturacion.id, productoId: resina.id, cantidad: 1 },
    { servicioId: obturacion.id, productoId: adhesivo.id, cantidad: 0.1 },
    { servicioId: obturacion.id, productoId: anestesia.id, cantidad: 1 },
    { servicioId: obturacion.id, productoId: aguja.id, cantidad: 1 },
    { servicioId: extraccion.id, productoId: anestesia.id, cantidad: 2 },
    { servicioId: extraccion.id, productoId: aguja.id, cantidad: 1 },
  ];

  for (const insumo of insumos) {
    await prisma.insumoServicio.upsert({
      where: { servicioId_productoId: { servicioId: insumo.servicioId, productoId: insumo.productoId } },
      create: insumo,
      update: {},
    });
  }
  log(`${insumos.length} insumos asociados a servicios.`);

  // ── Convenios ────────────────────────────────────────────────
  const convenios = [
    { codigo: 'CONSALUD', nombre: 'Isapre Consalud', tipo: 'ISAPRE' as const, descuentoPorcentaje: 10, coberturaPorcentaje: 50, topePorPrestacion: 60000 },
    { codigo: 'BANMEDICA', nombre: 'Isapre Banmédica', tipo: 'ISAPRE' as const, descuentoPorcentaje: 8, coberturaPorcentaje: 45 },
    { codigo: 'SEGCOMP', nombre: 'Seguro complementario Vida Segura', tipo: 'SEGURO_COMPLEMENTARIO' as const, coberturaPorcentaje: 70, topePorPrestacion: 120000 },
    { codigo: 'EMPRESAX', nombre: 'Convenio Empresa Andina S.A.', tipo: 'EMPRESA' as const, descuentoPorcentaje: 20 },
  ];

  for (const convenio of convenios) {
    await prisma.convenio.upsert({ where: { codigo: convenio.codigo }, create: convenio, update: {} });
  }
  const convConsalud = await prisma.convenio.findUniqueOrThrow({ where: { codigo: 'CONSALUD' } });
  log(`${convenios.length} convenios.`);

  // ── Profesionales ────────────────────────────────────────────
  const rolProfesional = await prisma.rol.findUniqueOrThrow({ where: { slug: 'profesional' } });
  const rolSecretaria = await prisma.rol.findUniqueOrThrow({ where: { slug: 'secretaria' } });
  const rolAsistente = await prisma.rol.findUniqueOrThrow({ where: { slug: 'asistente' } });

  const profesionalesDemo = [
    {
      rut: '15678234-5',
      nombres: 'Carolina',
      apellidos: 'Reyes Muñoz',
      especialidad: 'Odontología general',
      email: 'carolina.reyes@medigex.cl',
      colorAgenda: '#3384fb',
      modeloPago: 'COMISION' as const,
      comisionPorcentaje: 40,
      registroSuperintendencia: '123456',
    },
    {
      rut: '13456789-0',
      nombres: 'Andrés',
      apellidos: 'Fuentes Soto',
      especialidad: 'Endodoncia',
      email: 'andres.fuentes@medigex.cl',
      colorAgenda: '#8b5cf6',
      modeloPago: 'COMISION_Y_ARRIENDO' as const,
      comisionPorcentaje: 50,
      registroSuperintendencia: '234567',
    },
    {
      rut: '16789012-3',
      nombres: 'María José',
      apellidos: 'Vidal Rojas',
      especialidad: 'Ortodoncia',
      email: 'mj.vidal@medigex.cl',
      colorAgenda: '#ec4899',
      modeloPago: 'ARRIENDO' as const,
      comisionPorcentaje: 0,
      registroSuperintendencia: '345678',
    },
    {
      rut: '12345678-5',
      nombres: 'Rodrigo',
      apellidos: 'Castillo Pérez',
      especialidad: 'Medicina general',
      email: 'rodrigo.castillo@medigex.cl',
      colorAgenda: '#10b981',
      modeloPago: 'COMISION' as const,
      comisionPorcentaje: 45,
      registroSuperintendencia: '456789',
    },
  ];

  for (const p of profesionalesDemo) {
    await prisma.profesional.upsert({ where: { rut: p.rut }, create: p, update: {} });
  }

  const drCarolina = await prisma.profesional.findUniqueOrThrow({ where: { rut: '15678234-5' } });
  const drAndres = await prisma.profesional.findUniqueOrThrow({ where: { rut: '13456789-0' } });
  const drMariaJose = await prisma.profesional.findUniqueOrThrow({ where: { rut: '16789012-3' } });
  const drRodrigo = await prisma.profesional.findUniqueOrThrow({ where: { rut: '12345678-5' } });
  log(`${profesionalesDemo.length} profesionales.`);

  // ── Usuarios de cada perfil ──────────────────────────────────
  const usuariosDemo = [
    { email: 'carolina@medigex.cl', nombres: 'Carolina', apellidos: 'Reyes', rolId: rolProfesional.id, profesionalId: drCarolina.id },
    { email: 'andres@medigex.cl', nombres: 'Andrés', apellidos: 'Fuentes', rolId: rolProfesional.id, profesionalId: drAndres.id },
    { email: 'recepcion@medigex.cl', nombres: 'Paulina', apellidos: 'Soto', rolId: rolSecretaria.id, profesionalId: null },
    { email: 'asistente@medigex.cl', nombres: 'Javier', apellidos: 'Muñoz', rolId: rolAsistente.id, profesionalId: null },
  ];

  for (const u of usuariosDemo) {
    const usuario = await prisma.usuario.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash: await bcrypt.hash(PASSWORD_ADMIN, 12),
        nombres: u.nombres,
        apellidos: u.apellidos,
        rolId: u.rolId,
        debeCambiarPassword: true,
      },
      update: {},
    });

    if (u.profesionalId) {
      await prisma.profesional.update({ where: { id: u.profesionalId }, data: { usuarioId: usuario.id } });
    }
  }
  log(`${usuariosDemo.length} usuarios de demostración (misma contraseña que el admin).`);

  // ── Arriendo de box ──────────────────────────────────────────
  const arriendos = [
    { profesionalId: drAndres.id, boxId: boxB2.id, monto: 350000 },
    { profesionalId: drMariaJose.id, boxId: boxB1.id, monto: 450000 },
  ];

  for (const arriendo of arriendos) {
    const existente = await prisma.arriendoBox.findFirst({
      where: { profesionalId: arriendo.profesionalId, boxId: arriendo.boxId, activo: true },
    });
    if (!existente) {
      await prisma.arriendoBox.create({ data: { ...arriendo, periodicidad: 'MENSUAL' } });
    }
  }
  log(`${arriendos.length} contratos de arriendo de box.`);

  // ── Disponibilidad horaria ───────────────────────────────────
  const disponibilidades = [
    { profesionalId: drCarolina.id, boxId: boxB1.id, dias: [1, 2, 3, 4, 5], horaInicio: '09:00', horaFin: '13:00', duracionSlot: 30 },
    { profesionalId: drCarolina.id, boxId: boxB1.id, dias: [1, 3, 5], horaInicio: '15:00', horaFin: '19:00', duracionSlot: 30 },
    { profesionalId: drAndres.id, boxId: boxB2.id, dias: [2, 4], horaInicio: '09:00', horaFin: '18:00', duracionSlot: 60 },
    { profesionalId: drMariaJose.id, boxId: boxB1.id, dias: [6], horaInicio: '09:00', horaFin: '14:00', duracionSlot: 30 },
    { profesionalId: drRodrigo.id, boxId: boxB3.id, dias: [1, 2, 3, 4, 5], horaInicio: '08:30', horaFin: '13:30', duracionSlot: 20 },
  ];

  for (const d of disponibilidades) {
    for (const diaSemana of d.dias) {
      const existente = await prisma.disponibilidad.findFirst({
        where: { profesionalId: d.profesionalId, diaSemana, horaInicio: d.horaInicio },
      });
      if (!existente) {
        await prisma.disponibilidad.create({
          data: {
            profesionalId: d.profesionalId,
            boxId: d.boxId,
            diaSemana,
            horaInicio: d.horaInicio,
            horaFin: d.horaFin,
            duracionSlot: d.duracionSlot,
          },
        });
      }
    }
  }
  log('Disponibilidad horaria configurada.');

  // ── Pacientes ────────────────────────────────────────────────
  const previsionFonasa = await prisma.prevision.findUniqueOrThrow({ where: { codigo: 'FONASA' } });
  const previsionParticular = await prisma.prevision.findUniqueOrThrow({ where: { codigo: 'PARTICULAR' } });
  const previsionConsalud = await prisma.prevision.findUniqueOrThrow({ where: { codigo: 'ISAPRE_CONSALUD' } });

  const pacientesDemo = [
    {
      rut: '18234567-9',
      nombres: 'Camila Andrea',
      apellidoPaterno: 'Torres',
      apellidoMaterno: 'Leiva',
      fechaNacimiento: new Date('1992-04-18'),
      sexo: 'FEMENINO' as const,
      telefonoPrincipal: '+56 9 8765 4321',
      telefonoSecundario: '+56 2 2345 6789',
      email: 'camila.torres@ejemplo.cl',
      comuna: 'Providencia',
      ciudad: 'Santiago',
      previsionId: previsionConsalud.id,
      previsionDetalle: 'Plan 2B',
      convenioId: convConsalud.id,
      numeroAfiliado: 'CS-884512',
      alergias: 'Penicilina',
      comoNosConocio: 'Recomendación de un paciente',
    },
    {
      rut: '11223344-5',
      nombres: 'Jorge Luis',
      apellidoPaterno: 'Vargas',
      apellidoMaterno: 'Pino',
      fechaNacimiento: new Date('1975-11-02'),
      sexo: 'MASCULINO' as const,
      telefonoPrincipal: '+56 9 5544 3322',
      comuna: 'Ñuñoa',
      ciudad: 'Santiago',
      previsionId: previsionFonasa.id,
      previsionDetalle: 'Tramo B',
      antecedentesMedicos: 'Hipertensión arterial controlada',
      medicamentosActuales: 'Losartán 50 mg cada 24 h',
      comoNosConocio: 'Búsqueda en Google',
    },
    {
      rut: '20456789-1',
      nombres: 'Sofía',
      apellidoPaterno: 'Muñoz',
      apellidoMaterno: 'Carrasco',
      fechaNacimiento: new Date('2001-07-25'),
      sexo: 'FEMENINO' as const,
      telefonoPrincipal: '+56 9 1122 3344',
      email: 'sofia.munoz@ejemplo.cl',
      comuna: 'La Florida',
      ciudad: 'Santiago',
      previsionId: previsionParticular.id,
      vieneDeOtroCentro: true,
      centroOrigen: 'Clínica Dental Los Andes',
      profesionalOrigen: 'Dr. Patricio Silva',
      motivoDerivacion: 'Tratamiento de endodoncia en pieza 3.6 que no realizan en el centro de origen.',
      fechaDerivacion: new Date(Date.now() - 15 * 86_400_000),
      comoNosConocio: 'Derivación de otro centro',
    },
    {
      rut: '9876543-3',
      nombres: 'Rosa Elena',
      apellidoPaterno: 'Contreras',
      apellidoMaterno: 'Díaz',
      fechaNacimiento: new Date('1958-02-14'),
      sexo: 'FEMENINO' as const,
      telefonoPrincipal: '+56 9 6677 8899',
      comuna: 'Maipú',
      ciudad: 'Santiago',
      previsionId: previsionFonasa.id,
      previsionDetalle: 'Tramo A',
      antecedentesMedicos: 'Diabetes mellitus tipo 2',
      alergias: 'Ninguna conocida',
      contactoEmergenciaNombre: 'Luis Contreras',
      contactoEmergenciaTelefono: '+56 9 3344 5566',
      contactoEmergenciaRelacion: 'Hijo',
    },
  ];

  for (const p of pacientesDemo) {
    await prisma.paciente.upsert({
      where: { rut: p.rut },
      create: { ...p, creadoPorId: admin.id },
      update: {},
    });
  }

  const camila = await prisma.paciente.findUniqueOrThrow({ where: { rut: '18234567-9' } });
  const jorge = await prisma.paciente.findUniqueOrThrow({ where: { rut: '11223344-5' } });
  const sofia = await prisma.paciente.findUniqueOrThrow({ where: { rut: '20456789-1' } });
  log(`${pacientesDemo.length} pacientes de demostración.`);

  // ── Citas de los próximos días ───────────────────────────────
  const yaHayCitas = await prisma.cita.count();
  if (yaHayCitas === 0) {
    const consulta = await prisma.servicio.findUniqueOrThrow({ where: { codigo: 'OD-001' } });
    const limpieza = await prisma.servicio.findUniqueOrThrow({ where: { codigo: 'OD-002' } });
    const panoramica = await prisma.servicio.findUniqueOrThrow({ where: { codigo: 'RX-002' } });

    /** Devuelve una fecha en los próximos días hábiles, a la hora indicada. */
    const proximoDia = (offsetDias: number, hh: number, mm = 0) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDias);
      d.setHours(hh, mm, 0, 0);
      // Si cae domingo, lo movemos al lunes.
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
      return d;
    };

    const citas = [
      { pacienteId: camila.id, profesionalId: drCarolina.id, boxId: boxB1.id, servicios: [limpieza.id], inicio: proximoDia(0, 10, 0), duracion: 45, motivo: 'Limpieza semestral' },
      { pacienteId: jorge.id, profesionalId: drCarolina.id, boxId: boxB1.id, servicios: [consulta.id], inicio: proximoDia(0, 11, 0), duracion: 30, motivo: 'Dolor en molar inferior derecho' },
      { pacienteId: sofia.id, profesionalId: drAndres.id, boxId: boxB2.id, servicios: [], inicio: proximoDia(1, 9, 0), duracion: 90, motivo: 'Evaluación para endodoncia pieza 3.6' },
      { pacienteId: camila.id, profesionalId: drRodrigo.id, boxId: boxB3.id, servicios: [], inicio: proximoDia(2, 9, 0), duracion: 30, motivo: 'Control médico general' },
      // Sesión con dos procedimientos: consulta más radiografía.
      { pacienteId: jorge.id, profesionalId: drCarolina.id, boxId: boxRX.id, servicios: [consulta.id, panoramica.id], inicio: proximoDia(3, 12, 0), duracion: 50, motivo: 'Control con radiografía panorámica', usaRayosX: true },
    ];

    for (const c of citas) {
      await prisma.cita.create({
        data: {
          pacienteId: c.pacienteId,
          profesionalId: c.profesionalId,
          boxId: c.boxId,
          inicio: c.inicio,
          fin: new Date(c.inicio.getTime() + c.duracion * 60_000),
          motivoConsulta: c.motivo,
          usaRayosX: c.usaRayosX ?? false,
          estado: 'CONFIRMADA',
          creadoPorId: admin.id,
          servicios: {
            createMany: { data: c.servicios.map((servicioId, orden) => ({ servicioId, orden })) },
          },
        },
      });
    }
    log(`${citas.length} citas agendadas para los próximos días.`);
  }

  // ── Gastos de ejemplo ────────────────────────────────────────
  const yaHayGastos = await prisma.gasto.count();
  if (yaHayGastos === 0) {
    const catArriendo = await prisma.categoriaGasto.findUniqueOrThrow({ where: { nombre: 'Arriendo del local' } });
    const catServicios = await prisma.categoriaGasto.findUniqueOrThrow({ where: { nombre: 'Luz, agua e internet' } });
    const catInsumos = await prisma.categoriaGasto.findUniqueOrThrow({ where: { nombre: 'Insumos clínicos' } });

    const gastos = [
      { categoriaId: catArriendo.id, descripcion: 'Arriendo del local — mes en curso', total: 1_800_000, esRecurrente: true },
      { categoriaId: catServicios.id, descripcion: 'Cuenta de electricidad', total: 185_000, esRecurrente: true },
      { categoriaId: catServicios.id, descripcion: 'Internet y telefonía', total: 65_000, esRecurrente: true },
      { categoriaId: catInsumos.id, descripcion: 'Compra de insumos dentales', total: 640_000, proveedorId: provDental.id },
    ];

    for (const g of gastos) {
      const neto = Math.round(g.total / 1.19);
      await prisma.gasto.create({
        data: {
          categoriaId: g.categoriaId,
          proveedorId: g.proveedorId,
          descripcion: g.descripcion,
          tipoDocumento: 'FACTURA',
          neto,
          iva: g.total - neto,
          total: g.total,
          estado: 'PAGADO',
          fechaPago: new Date(),
          esRecurrente: g.esRecurrente ?? false,
          periodicidad: g.esRecurrente ? 'MENSUAL' : 'UNICA',
          registradoPorId: admin.id,
        },
      });
    }
    log(`${gastos.length} gastos de ejemplo.`);
  }



  console.log('\n✅ Semilla completa.\n');
  console.log('   ──────────────────────────────────────────');
  console.log(`   Usuario:    ${EMAIL_ADMIN}`);
  console.log(`   Contraseña: ${PASSWORD_ADMIN}`);
  console.log('   ──────────────────────────────────────────');
  console.log('   Cámbiala apenas ingreses (Usuarios → Contraseña).\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Error al sembrar la base de datos:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
