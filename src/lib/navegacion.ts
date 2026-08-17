import type { SesionUsuario } from './auth';
import { claveP } from './permissions';

export interface ItemNav {
  href: string;
  texto: string;
  modulo: string;
  icono: string; // nombre de icono de lucide-react
}

export interface GrupoNav {
  titulo: string;
  items: ItemNav[];
}

export const NAVEGACION: GrupoNav[] = [
  {
    titulo: 'Operación diaria',
    items: [
      { href: '/', texto: 'Dashboard', modulo: 'dashboard', icono: 'LayoutDashboard' },
      { href: '/agenda', texto: 'Agenda', modulo: 'agenda', icono: 'CalendarDays' },
      { href: '/pacientes', texto: 'Pacientes', modulo: 'pacientes', icono: 'Users' },
      { href: '/interconsultas', texto: 'Interconsultas', modulo: 'interconsultas', icono: 'ArrowLeftRight' },
      { href: '/recetas', texto: 'Recetas', modulo: 'recetas', icono: 'Pill' },
    ],
  },
  {
    titulo: 'Comercial',
    items: [
      { href: '/presupuestos', texto: 'Presupuestos', modulo: 'presupuestos', icono: 'FileText' },
      { href: '/ventas', texto: 'Ventas', modulo: 'ventas', icono: 'ShoppingCart' },
      { href: '/pagos', texto: 'Pagos', modulo: 'pagos', icono: 'CreditCard' },
      { href: '/convenios', texto: 'Convenios', modulo: 'convenios', icono: 'Handshake' },
      { href: '/informes', texto: 'Informes de beneficio', modulo: 'informes_beneficio', icono: 'FileCheck' },
    ],
  },
  {
    titulo: 'Operaciones',
    items: [
      { href: '/inventario', texto: 'Inventario', modulo: 'inventario', icono: 'Package' },
      { href: '/gastos', texto: 'Gastos', modulo: 'gastos', icono: 'Receipt' },
      { href: '/liquidaciones', texto: 'Liquidaciones', modulo: 'liquidaciones', icono: 'Wallet' },
      { href: '/reportes', texto: 'Reportes', modulo: 'reportes', icono: 'BarChart3' },
    ],
  },
  {
    titulo: 'Maestros',
    items: [
      { href: '/profesionales', texto: 'Profesionales', modulo: 'profesionales', icono: 'Stethoscope' },
      { href: '/servicios', texto: 'Servicios', modulo: 'servicios', icono: 'ClipboardList' },
      { href: '/boxes', texto: 'Boxes y salas', modulo: 'boxes', icono: 'DoorOpen' },
      { href: '/proveedores', texto: 'Proveedores', modulo: 'proveedores', icono: 'Truck' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { href: '/usuarios', texto: 'Usuarios', modulo: 'usuarios', icono: 'UserCog' },
      { href: '/roles', texto: 'Roles y permisos', modulo: 'roles', icono: 'ShieldCheck' },
      { href: '/configuracion', texto: 'Configuración', modulo: 'configuracion', icono: 'Settings' },
    ],
  },
];

/** Filtra la navegación dejando sólo lo que el rol puede ver. */
export function navegacionVisible(sesion: SesionUsuario): GrupoNav[] {
  return NAVEGACION.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => sesion.permisos.has(claveP(item.modulo, 'ver'))),
  })).filter((grupo) => grupo.items.length > 0);
}
