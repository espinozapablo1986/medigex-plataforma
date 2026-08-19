import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EtiquetasTabla } from './etiquetas-tabla';

// ─────────────────────────────────────────────────────────────
//  Encabezado de página
// ─────────────────────────────────────────────────────────────

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  volver,
  ayuda,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  volver?: { href: string; texto: string };
  /**
   * Slug de la guía del módulo. Pone un «?» junto al título que lleva al
   * paso a paso, que es donde alguien se pregunta cómo se usa esto: mandarlo
   * a buscar en un menú de ayuda aparte es perderlo.
   */
  ayuda?: string;
}) {
  return (
    <div className="mb-6">
      {volver && (
        <Link href={volver.href} className="mb-2 inline-flex items-center gap-1 text-sm text-tinta-500 hover:text-brand-600">
          ← {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-h1 text-brand-900">{titulo}</h1>
            {ayuda && (
              <Link
                href={`/ayuda/${ayuda}`}
                title={`Cómo se usa ${titulo}`}
                aria-label={`Cómo se usa ${titulo}`}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-tinta-300 text-xs font-semibold text-tinta-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
              >
                ?
              </Link>
            )}
          </div>
          {descripcion && <p className="mt-1 text-sm text-tinta-500">{descripcion}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tarjetas
// ─────────────────────────────────────────────────────────────

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  className,
  sinPadding,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  sinPadding?: boolean;
}) {
  return (
    <section className={cn('tarjeta', className)}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-tinta-200 px-4 py-3">
          <div>
            {titulo && <h2 className="text-sm font-semibold text-tinta-900">{titulo}</h2>}
            {descripcion && <p className="text-xs text-tinta-500">{descripcion}</p>}
          </div>
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={sinPadding ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Metrica({
  etiqueta,
  valor,
  detalle,
  tono = 'neutro',
  icono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: 'neutro' | 'positivo' | 'negativo' | 'marca' | 'alerta';
  icono?: ReactNode;
}) {
  const tonos = {
    neutro: 'text-brand-900',
    positivo: 'text-exito',
    negativo: 'text-error',
    marca: 'text-brand-600',
    alerta: 'text-alerta',
  } as const;

  return (
    <div className="tarjeta p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-tinta-500">{etiqueta}</p>
        {icono && <span className="text-tinta-300">{icono}</span>}
      </div>
      <p className={cn('mt-2 font-display text-2xl font-bold tabular-nums', tonos[tono])}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta-500">{detalle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Botones y enlaces con estilo de botón
// ─────────────────────────────────────────────────────────────

const VARIANTES = {
  primario: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secundario: 'bg-white text-brand-900 border border-tinta-300 hover:bg-tinta-50 shadow-sm',
  peligro: 'bg-error text-white hover:bg-error-texto shadow-sm',
  exito: 'bg-exito text-white hover:bg-exito-texto shadow-sm',
  fantasma: 'text-tinta-600 hover:bg-tinta-100',
} as const;

const TAMANOS = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
} as const;

export type VarianteBoton = keyof typeof VARIANTES;

export function clasesBoton(variante: VarianteBoton = 'primario', tamano: keyof typeof TAMANOS = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-1.5 font-medium transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTES[variante],
    TAMANOS[tamano],
  );
}

export function EnlaceBoton({
  href,
  children,
  variante = 'primario',
  tamano = 'md',
  className,
  target,
}: {
  href: string;
  children: ReactNode;
  variante?: VarianteBoton;
  tamano?: keyof typeof TAMANOS;
  className?: string;
  target?: string;
}) {
  return (
    <Link href={href} target={target} className={cn(clasesBoton(variante, tamano), className)}>
      {children}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
//  Badges / estados
// ─────────────────────────────────────────────────────────────

// Los tonos verde, ámbar y rojo son los semánticos de la norma gráfica y
// están reservados para estados del sistema, nunca para decorar.
const TONOS_BADGE = {
  gris: 'bg-tinta-100 text-tinta-700 ring-tinta-200',
  azul: 'bg-brand-50 text-brand-700 ring-brand-200',
  verde: 'bg-exito-fondo text-exito-texto ring-exito-borde',
  ambar: 'bg-alerta-fondo text-alerta-texto ring-alerta-borde',
  rojo: 'bg-error-fondo text-error-texto ring-error-borde',
  morado: 'bg-brand-100 text-brand-700 ring-brand-300',
} as const;

export type TonoBadge = keyof typeof TONOS_BADGE;

export function Badge({ children, tono = 'gris' }: { children: ReactNode; tono?: TonoBadge }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONOS_BADGE[tono],
      )}
    >
      {children}
    </span>
  );
}

/** Mapa de estados de todo el sistema a un tono de badge. */
export const TONO_ESTADO: Record<string, TonoBadge> = {
  // Citas
  AGENDADA: 'azul',
  CONFIRMADA: 'verde',
  EN_SALA_ESPERA: 'ambar',
  EN_ATENCION: 'morado',
  ATENDIDA: 'verde',
  NO_ASISTIO: 'rojo',
  CANCELADA: 'rojo',
  REAGENDADA: 'gris',
  // Documentos comerciales
  BORRADOR: 'gris',
  ENVIADO: 'azul',
  ACEPTADO: 'verde',
  RECHAZADO: 'rojo',
  VENCIDO: 'ambar',
  FACTURADO: 'morado',
  PENDIENTE: 'ambar',
  PARCIAL: 'ambar',
  PAGADA: 'verde',
  PAGADO: 'verde',
  ANULADA: 'rojo',
  ANULADO: 'rojo',
  CONFIRMADO: 'verde',
  APROBADA: 'azul',
  // Interconsultas / exámenes
  ACEPTADA: 'verde',
  COMPLETADA: 'verde',
  SOLICITADO: 'ambar',
  TOMADO: 'azul',
  CON_RESULTADO: 'verde',
  // Prioridad
  URGENTE: 'rojo',
  ALTA: 'ambar',
  NORMAL: 'gris',
  BAJA: 'gris',
};

export function BadgeEstado({ estado }: { estado: string }) {
  return <Badge tono={TONO_ESTADO[estado] ?? 'gris'}>{estado.replace(/_/g, ' ').toLowerCase()}</Badge>;
}

// ─────────────────────────────────────────────────────────────
//  Estado vacío / avisos
// ─────────────────────────────────────────────────────────────

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-tinta-300 bg-tinta-50/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-tinta-700">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-md text-sm text-tinta-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: 'info' | 'exito' | 'alerta' | 'error';
  titulo?: string;
  children: ReactNode;
}) {
  const estilos = {
    info: 'border-brand-300 bg-brand-50 text-brand-800',
    exito: 'border-exito-borde bg-exito-fondo text-exito-texto',
    alerta: 'border-alerta-borde bg-alerta-fondo text-alerta-texto',
    error: 'border-error-borde bg-error-fondo text-error-texto',
  } as const;

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', estilos[tono])}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Formularios
// ─────────────────────────────────────────────────────────────

export function Campo({
  etiqueta,
  children,
  ayuda,
  requerido,
  className,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
  requerido?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="etiqueta">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tinta-400">{ayuda}</span>}
    </label>
  );
}

export function Grilla({ cols = 2, children }: { cols?: 1 | 2 | 3 | 4; children: ReactNode }) {
  const clases = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  } as const;
  return <div className={cn('grid gap-4', clases[cols])}>{children}</div>;
}

export function Definicion({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-tinta-400">{termino}</dt>
      <dd className="mt-0.5 text-sm text-tinta-800">{children || '—'}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tabla
// ─────────────────────────────────────────────────────────────

export function ContenedorTabla({
  children,
  tarjetasEnMovil = true,
}: {
  children: ReactNode;
  /**
   * En pantallas angostas cada fila se muestra como una tarjeta con las
   * etiquetas de su columna. Se puede desactivar en tablas que se leen mejor
   * como rejilla, por ejemplo el periodontograma.
   */
  tarjetasEnMovil?: boolean;
}) {
  return (
    <div className={cn('scroll-fino', tarjetasEnMovil ? 'md:overflow-x-auto' : 'overflow-x-auto')}>
      <table className={cn('tabla', tarjetasEnMovil && 'tabla-tarjetas')}>{children}</table>
      {tarjetasEnMovil && <EtiquetasTabla />}
    </div>
  );
}

export function Paginador({
  pagina,
  totalPaginas,
  total,
  base,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  base: string; // querystring ya construido, sin "pagina"
}) {
  if (totalPaginas <= 1) {
    return <p className="px-4 py-3 text-xs text-tinta-500">{total} registro{total === 1 ? '' : 's'}</p>;
  }
  const separador = base.includes('?') ? '&' : '?';
  return (
    <div className="flex items-center justify-between gap-3 border-t border-tinta-200 px-4 py-3">
      <p className="text-xs text-tinta-500">
        Página {pagina} de {totalPaginas} · {total} registros
      </p>
      <div className="flex gap-2">
        {pagina > 1 && (
          <Link href={`${base}${separador}pagina=${pagina - 1}`} className={clasesBoton('secundario', 'sm')}>
            Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link href={`${base}${separador}pagina=${pagina + 1}`} className={clasesBoton('secundario', 'sm')}>
            Siguiente
          </Link>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Navegación por pestañas (basada en enlaces)
// ─────────────────────────────────────────────────────────────

export function Pestanas({
  items,
  activo,
}: {
  items: { href: string; texto: string; contador?: number }[];
  activo: string;
}) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-tinta-200 scroll-fino">
      {items.map((item) => {
        const esActivo = item.href === activo;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
              esActivo
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-tinta-500 hover:border-tinta-300 hover:text-tinta-700',
            )}
          >
            {item.texto}
            {item.contador !== undefined && (
              <span className="ml-1.5 rounded-full bg-tinta-100 px-1.5 py-0.5 text-xs text-tinta-600">
                {item.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Avatar({ texto, color }: { texto: string; color?: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color ?? '#64748b' }}
    >
      {texto}
    </span>
  );
}
