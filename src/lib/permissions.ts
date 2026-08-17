/**
 * Catálogo de módulos y acciones del sistema.
 *
 * La matriz de permisos se guarda en la tabla `rol_permisos` (una fila por
 * rol + módulo + acción), de modo que un administrador puede activar o
 * desactivar cualquier combinación desde Configuración > Roles sin tocar código.
 */

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'aprobar', 'anular'] as const;
export type Accion = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  exportar: 'Exportar',
  aprobar: 'Aprobar',
  anular: 'Anular',
};

export interface ModuloDef {
  slug: string;
  nombre: string;
  grupo: string;
  descripcion: string;
  acciones: Accion[];
}

export const MODULOS: ModuloDef[] = [
  // Clínico
  {
    slug: 'agenda',
    nombre: 'Agenda',
    grupo: 'Clínico',
    descripcion: 'Citas, disponibilidad de profesionales y de boxes',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    slug: 'pacientes',
    nombre: 'Pacientes',
    grupo: 'Clínico',
    descripcion: 'Fichas de pacientes y datos de contacto',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    slug: 'historia_clinica',
    nombre: 'Historia clínica',
    grupo: 'Clínico',
    descripcion: 'Atenciones, evoluciones, exámenes y adjuntos clínicos',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    slug: 'recetas',
    nombre: 'Recetas',
    grupo: 'Clínico',
    descripcion: 'Prescripciones digitales',
    acciones: ['ver', 'crear', 'editar', 'anular', 'exportar'],
  },
  {
    slug: 'interconsultas',
    nombre: 'Interconsultas',
    grupo: 'Clínico',
    descripcion: 'Derivaciones entre profesionales del centro',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },

  // Comercial
  {
    slug: 'presupuestos',
    nombre: 'Presupuestos',
    grupo: 'Comercial',
    descripcion: 'Presupuestos de servicios e insumos para pacientes',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar'],
  },
  {
    slug: 'ventas',
    nombre: 'Ventas',
    grupo: 'Comercial',
    descripcion: 'Ventas de servicios y productos',
    acciones: ['ver', 'crear', 'editar', 'anular', 'exportar'],
  },
  {
    slug: 'pagos',
    nombre: 'Pagos',
    grupo: 'Comercial',
    descripcion: 'Cobros, formas de pago y comprobantes',
    acciones: ['ver', 'crear', 'editar', 'anular', 'exportar'],
  },
  {
    slug: 'convenios',
    nombre: 'Convenios',
    grupo: 'Comercial',
    descripcion: 'Isapres, seguros complementarios y empresas en convenio',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'informes_beneficio',
    nombre: 'Informes de beneficio',
    grupo: 'Comercial',
    descripcion: 'Certificados de prestaciones para reembolso de Isapre o seguro',
    acciones: ['ver', 'crear', 'editar', 'anular', 'exportar'],
  },

  // Operaciones
  {
    slug: 'inventario',
    nombre: 'Inventario',
    grupo: 'Operaciones',
    descripcion: 'Productos, insumos, stock y movimientos',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    slug: 'gastos',
    nombre: 'Gastos',
    grupo: 'Operaciones',
    descripcion: 'Compras, gastos y documentos tributarios de proveedores',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar'],
  },
  {
    slug: 'liquidaciones',
    nombre: 'Liquidaciones',
    grupo: 'Operaciones',
    descripcion: 'Pago a profesionales y cobro de arriendo de box',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar'],
  },

  // Maestros
  {
    slug: 'profesionales',
    nombre: 'Profesionales',
    grupo: 'Maestros',
    descripcion: 'Fichas de profesionales, comisiones y arriendos',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'servicios',
    nombre: 'Servicios',
    grupo: 'Maestros',
    descripcion: 'Catálogo de servicios, precios y duraciones',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'boxes',
    nombre: 'Boxes y salas',
    grupo: 'Maestros',
    descripcion: 'Boxes, sala de rayos X y otras dependencias',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'proveedores',
    nombre: 'Proveedores',
    grupo: 'Maestros',
    descripcion: 'Proveedores de insumos y servicios',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },

  // Administración
  {
    slug: 'dashboard',
    nombre: 'Dashboard',
    grupo: 'Administración',
    descripcion: 'Panel con métricas de ingresos, gastos e IVA',
    acciones: ['ver', 'exportar'],
  },
  {
    slug: 'reportes',
    nombre: 'Reportes',
    grupo: 'Administración',
    descripcion: 'Reportes de venta, ticket medio, ranking de profesionales',
    acciones: ['ver', 'exportar'],
  },
  {
    slug: 'usuarios',
    nombre: 'Usuarios',
    grupo: 'Administración',
    descripcion: 'Cuentas de acceso al sistema',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'roles',
    nombre: 'Roles y permisos',
    grupo: 'Administración',
    descripcion: 'Perfiles de usuario y matriz de permisos',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    slug: 'configuracion',
    nombre: 'Configuración',
    grupo: 'Administración',
    descripcion: 'Datos del centro, IVA, horarios y formas de pago',
    acciones: ['ver', 'editar'],
  },
];

export const MODULOS_POR_SLUG = new Map(MODULOS.map((m) => [m.slug, m]));

export const GRUPOS_MODULO = ['Clínico', 'Comercial', 'Operaciones', 'Maestros', 'Administración'];

/** Clave usada en el mapa de permisos de la sesión. */
export function claveP(modulo: string, accion: string) {
  return `${modulo}.${accion}`;
}

// ─────────────────────────────────────────────────────────────
//  Roles precargados
// ─────────────────────────────────────────────────────────────

export interface RolSemilla {
  slug: string;
  nombre: string;
  descripcion: string;
  /** '*' = todas las acciones del módulo */
  permisos: Record<string, Accion[] | '*'>;
}

export const ROLES_SEMILLA: RolSemilla[] = [
  {
    slug: 'administrador',
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema, incluida la configuración y los reportes financieros.',
    permisos: Object.fromEntries(MODULOS.map((m) => [m.slug, '*' as const])),
  },
  {
    slug: 'profesional',
    nombre: 'Profesional (Médico / Odontólogo)',
    descripcion:
      'Atiende pacientes: ve su agenda, registra la historia clínica, emite recetas y presupuestos y deriva a otros profesionales.',
    permisos: {
      dashboard: ['ver'],
      agenda: ['ver', 'crear', 'editar'],
      pacientes: ['ver', 'crear', 'editar'],
      historia_clinica: ['ver', 'crear', 'editar', 'exportar'],
      recetas: ['ver', 'crear', 'editar', 'anular', 'exportar'],
      interconsultas: ['ver', 'crear', 'editar'],
      presupuestos: ['ver', 'crear', 'editar'],
      ventas: ['ver'],
      pagos: ['ver'],
      convenios: ['ver'],
      informes_beneficio: ['ver', 'crear', 'exportar'],
      inventario: ['ver'],
      servicios: ['ver'],
      profesionales: ['ver'],
      boxes: ['ver'],
      liquidaciones: ['ver'],
      reportes: ['ver'],
    },
  },
  {
    slug: 'secretaria',
    nombre: 'Secretaria / Recepción',
    descripcion:
      'Agenda horas, crea fichas de pacientes, arma presupuestos, cobra y registra pagos. No ve la historia clínica completa.',
    permisos: {
      dashboard: ['ver'],
      agenda: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
      pacientes: ['ver', 'crear', 'editar', 'exportar'],
      historia_clinica: ['ver'],
      interconsultas: ['ver', 'crear'],
      presupuestos: ['ver', 'crear', 'editar', 'exportar'],
      ventas: ['ver', 'crear', 'editar', 'exportar'],
      pagos: ['ver', 'crear', 'editar', 'exportar'],
      convenios: ['ver'],
      informes_beneficio: ['ver', 'crear', 'exportar'],
      servicios: ['ver'],
      profesionales: ['ver'],
      boxes: ['ver'],
      inventario: ['ver'],
      reportes: ['ver'],
    },
  },
  {
    slug: 'asistente',
    nombre: 'Asistente clínico',
    descripcion:
      'Apoya la atención: prepara boxes, controla insumos y registra consumo de inventario. Acceso clínico de solo lectura.',
    permisos: {
      agenda: ['ver'],
      pacientes: ['ver'],
      historia_clinica: ['ver'],
      inventario: ['ver', 'crear', 'editar'],
      servicios: ['ver'],
      boxes: ['ver'],
      proveedores: ['ver'],
    },
  },
];

/** Expande la definición de un rol semilla a filas de rol_permisos. */
export function expandirPermisos(permisos: RolSemilla['permisos']) {
  const filas: { modulo: string; accion: Accion; permitido: boolean }[] = [];
  for (const modulo of MODULOS) {
    const definido = permisos[modulo.slug];
    const permitidas: Accion[] = definido === '*' ? modulo.acciones : (definido ?? []);
    for (const accion of modulo.acciones) {
      filas.push({ modulo: modulo.slug, accion, permitido: permitidas.includes(accion) });
    }
  }
  return filas;
}
