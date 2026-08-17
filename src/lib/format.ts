/** Utilidades de formato y validación para Chile. */

// ─────────────────────────────────────────────────────────────
//  RUT
// ─────────────────────────────────────────────────────────────

/** Deja el RUT en formato canónico "12345678-9" (sin puntos, DV en mayúscula). */
export function normalizarRut(valor: string): string {
  const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/** Formatea con puntos: "12.345.678-9". */
export function formatearRut(valor?: string | null): string {
  if (!valor) return '';
  const canonico = normalizarRut(valor);
  const [cuerpo, dv] = canonico.split('-');
  if (!dv) return canonico;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

/** Calcula el dígito verificador (módulo 11). */
export function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function validarRut(valor?: string | null): boolean {
  if (!valor) return false;
  const canonico = normalizarRut(valor);
  const [cuerpo, dv] = canonico.split('-');
  if (!cuerpo || !dv || cuerpo.length < 7 || !/^\d+$/.test(cuerpo)) return false;
  return calcularDv(cuerpo) === dv;
}

// ─────────────────────────────────────────────────────────────
//  Dinero (CLP, sin decimales)
// ─────────────────────────────────────────────────────────────

const formateadorCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function clp(monto: number | null | undefined): string {
  return formateadorCLP.format(Math.round(monto ?? 0));
}

export function numero(valor: number | null | undefined, decimales = 0): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor ?? 0);
}

export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  return `${numero(valor ?? 0, decimales)}%`;
}

/**
 * Descompone un total bruto en neto + IVA.
 * En Chile los precios de lista suelen incluir IVA.
 */
export function desglosarIva(totalBruto: number, tasaIva: number, afecto = true) {
  if (!afecto || tasaIva <= 0) return { neto: Math.round(totalBruto), iva: 0, total: Math.round(totalBruto) };
  const neto = Math.round(totalBruto / (1 + tasaIva));
  const total = Math.round(totalBruto);
  return { neto, iva: total - neto, total };
}

// ─────────────────────────────────────────────────────────────
//  Fechas
// ─────────────────────────────────────────────────────────────

export const ZONA_HORARIA = process.env.TZ || 'America/Santiago';

export function fechaCorta(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function fechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function hora(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

export function fechaLarga(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Formato "yyyy-MM-dd" en hora local, apto para <input type="date">. */
export function isoFecha(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formato "yyyy-MM-ddTHH:mm" apto para <input type="datetime-local">. */
export function isoFechaHora(fecha: Date): string {
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = String(fecha.getMinutes()).padStart(2, '0');
  return `${isoFecha(fecha)}T${hh}:${mm}`;
}

export function calcularEdad(fechaNacimiento?: Date | string | null, edadRegistrada?: number | null): number | null {
  if (!fechaNacimiento) return edadRegistrada ?? null;
  const nac = typeof fechaNacimiento === 'string' ? new Date(fechaNacimiento) : fechaNacimiento;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "09:30" -> 570 minutos desde medianoche. */
export function horaAMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convierte enums SCREAMING_SNAKE en texto legible. */
export function humanizar(valor: string | null | undefined): string {
  if (!valor) return '—';
  const t = valor.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Recepción / Caja" -> "recepcion_caja". Útil para slugs e identificadores. */
export function slugificar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Quita tildes para poder buscar "jose" y encontrar "José". */
export function sinTildes(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function iniciales(nombres: string, apellidos?: string | null): string {
  const a = nombres?.trim()?.[0] ?? '';
  const b = apellidos?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}
