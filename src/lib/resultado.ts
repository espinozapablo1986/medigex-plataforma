/** Resultado estándar que devuelven todas las server actions del sistema. */
export type Resultado =
  | { ok: true; mensaje?: string }
  | { ok: false; error: string };

export const SIN_ESTADO: Resultado | null = null;

/** Envuelve una server action capturando errores para mostrarlos en el formulario. */
export async function intentar(fn: () => Promise<void | Resultado>, mensajeExito?: string): Promise<Resultado> {
  try {
    const r = await fn();
    if (r) return r;
    return { ok: true, mensaje: mensajeExito };
  } catch (error) {
    // `redirect()` de Next lanza una excepción de control que no debemos capturar
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String((error as { digest?: unknown }).digest ?? '');
      if (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND') throw error;
    }
    const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return { ok: false, error: mensaje };
  }
}

// ─────────────────────────────────────────────────────────────
//  Lectura de FormData
// ─────────────────────────────────────────────────────────────

export function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

export function textoOpcional(fd: FormData, campo: string): string | null {
  const v = texto(fd, campo);
  return v === '' ? null : v;
}

export function requerido(fd: FormData, campo: string, etiqueta: string): string {
  const v = texto(fd, campo);
  if (!v) throw new Error(`El campo "${etiqueta}" es obligatorio.`);
  return v;
}

export function entero(fd: FormData, campo: string, porDefecto = 0): number {
  const v = String(fd.get(campo) ?? '').replace(/[^\d-]/g, '');
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : porDefecto;
}

export function decimal(fd: FormData, campo: string, porDefecto = 0): number {
  const v = String(fd.get(campo) ?? '').replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : porDefecto;
}

export function booleano(fd: FormData, campo: string): boolean {
  const v = fd.get(campo);
  return v === 'on' || v === 'true' || v === '1';
}

export function fecha(fd: FormData, campo: string): Date | null {
  const v = texto(fd, campo);
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaRequerida(fd: FormData, campo: string, etiqueta: string): Date {
  const d = fecha(fd, campo);
  if (!d) throw new Error(`El campo "${etiqueta}" es obligatorio.`);
  return d;
}

export function enumOpcional<T extends string>(fd: FormData, campo: string, validos: readonly T[]): T | null {
  const v = texto(fd, campo);
  return validos.includes(v as T) ? (v as T) : null;
}
