import 'server-only';

import ExcelJS from 'exceljs';

/**
 * Lectura y escritura de planillas para las cargas masivas.
 *
 * Se aceptan `.xlsx` y `.csv` porque la gente guarda lo que su Excel le
 * ofrece por defecto, y en Chile eso a veces es CSV con punto y coma. Obligar
 * a un solo formato garantiza un archivo rechazado en el peor momento.
 */

export interface FilaPlanilla {
  /** Número de fila tal como se ve en Excel, para poder señalar el error. */
  fila: number;
  valores: Record<string, string>;
}

/** Encabezados esperados por cada tipo de carga. */
export interface ColumnaPlantilla {
  clave: string;
  titulo: string;
  ancho: number;
  ayuda: string;
  ejemplo: string | number;
  obligatoria?: boolean;
}

// ─────────────────────────────────────────────────────────────
//  Normalización de encabezados
// ─────────────────────────────────────────────────────────────

/**
 * Los encabezados se comparan sin tildes, sin mayúsculas y sin espacios
 * sobrantes: quien edita la plantilla en Excel casi siempre la retoca, y
 * rechazar «Stock Minimo» frente a «Stock mínimo» sería gratuitamente hostil.
 */
export function normalizarEncabezado(texto: string): string {
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function indiceDeColumnas(encabezados: string[], columnas: ColumnaPlantilla[]) {
  const normalizados = encabezados.map(normalizarEncabezado);
  const mapa = new Map<string, number>();
  for (const col of columnas) {
    const i = normalizados.indexOf(normalizarEncabezado(col.titulo));
    if (i >= 0) mapa.set(col.clave, i);
  }
  return mapa;
}

// ─────────────────────────────────────────────────────────────
//  Lectura
// ─────────────────────────────────────────────────────────────

function textoDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    // Celdas con fórmula, texto enriquecido o hipervínculo.
    const v = valor as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return '';
  }
  return String(valor).trim();
}

/** Divide una línea de CSV respetando las comillas dobles. */
function partirLineaCsv(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === separador && !entreComillas) {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

async function leerCsv(texto: string): Promise<string[][]> {
  // Excel en español guarda CSV con punto y coma; el resto del mundo con coma.
  // Se elige el separador que produzca más columnas en la cabecera.
  const limpio = texto.replace(/^\uFEFF/, ''); // marca de orden de bytes que agrega Excel
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return [];

  const separador = partirLineaCsv(lineas[0]!, ';').length >= partirLineaCsv(lineas[0]!, ',').length ? ';' : ',';
  return lineas.map((l) => partirLineaCsv(l, separador));
}

export const LIMITE_FILAS = 2000;

export interface LecturaPlanilla {
  filas: FilaPlanilla[];
  /** Columnas de la plantilla que no se encontraron en el archivo. */
  faltantes: string[];
  truncado: boolean;
}

/**
 * Lee la planilla y devuelve las filas ya emparejadas con las columnas
 * esperadas. No valida el contenido: de eso se encarga quien importa, que es
 * el que sabe qué es un valor válido.
 */
export async function leerPlanilla(
  archivo: File,
  columnas: ColumnaPlantilla[],
): Promise<LecturaPlanilla> {
  const buffer = Buffer.from(await archivo.arrayBuffer());
  let matriz: string[][];

  if (archivo.name.toLowerCase().endsWith('.csv')) {
    matriz = await leerCsv(buffer.toString('utf8'));
  } else {
    const libro = new ExcelJS.Workbook();
    // exceljs declara `load(Buffer)` contra una versión antigua de
    // @types/node, cuando Buffer todavía no era genérico. En ejecución recibe
    // exactamente el mismo objeto; el desajuste es sólo de tipos.
    await libro.xlsx.load(buffer as unknown as Parameters<typeof libro.xlsx.load>[0]);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new Error('La planilla no tiene ninguna hoja con datos.');

    matriz = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const valores: string[] = [];
      // `eachCell` con includeEmpty conserva la posición de las columnas
      // vacías; sin eso, una celda en blanco correría todo lo de su derecha.
      fila.eachCell({ includeEmpty: true }, (celda, n) => {
        valores[n - 1] = textoDeCelda(celda.value);
      });
      matriz.push(Array.from(valores, (v) => v ?? ''));
    });
  }

  if (matriz.length === 0) throw new Error('La planilla está vacía.');

  const [encabezados, ...cuerpo] = matriz;
  const indices = indiceDeColumnas(encabezados ?? [], columnas);

  const faltantes = columnas
    .filter((c) => c.obligatoria && !indices.has(c.clave))
    .map((c) => c.titulo);

  const truncado = cuerpo.length > LIMITE_FILAS;
  const filas: FilaPlanilla[] = [];

  cuerpo.slice(0, LIMITE_FILAS).forEach((fila, i) => {
    const valores: Record<string, string> = {};
    for (const col of columnas) {
      const idx = indices.get(col.clave);
      valores[col.clave] = idx === undefined ? '' : (fila[idx] ?? '').trim();
    }
    // Una fila completamente vacía es el relleno habitual al final del archivo.
    if (Object.values(valores).every((v) => v === '')) return;
    filas.push({ fila: i + 2, valores });
  });

  return { filas, faltantes, truncado };
}

// ─────────────────────────────────────────────────────────────
//  Escritura de plantillas
// ─────────────────────────────────────────────────────────────

/**
 * Genera la plantilla de importación: una hoja con los encabezados y un
 * ejemplo, y otra con las instrucciones y los valores admitidos.
 *
 * La hoja de instrucciones no es adorno: sin ella, la primera importación de
 * cualquiera falla por escribir «unidad» donde se esperaba «UNIDAD».
 */
export async function generarPlantilla(opciones: {
  titulo: string;
  columnas: ColumnaPlantilla[];
  instrucciones: string[];
  /** Listas de valores admitidos: unidades de medida, categorías, etc. */
  listas?: { titulo: string; valores: string[] }[];
  /** Filas ya cargadas, para plantillas que salen prellenadas. */
  filas?: (string | number)[][];
}): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'MEDIGEX';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Datos');
  hoja.columns = opciones.columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));

  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6B80' } };
  cabecera.alignment = { vertical: 'middle' };
  cabecera.height = 22;

  if (opciones.filas && opciones.filas.length > 0) {
    for (const fila of opciones.filas) hoja.addRow(fila);
  } else {
    const ejemplo = hoja.addRow(opciones.columnas.map((c) => c.ejemplo));
    ejemplo.font = { italic: true, color: { argb: 'FF95AEB7' } };
  }

  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: opciones.columnas.length },
  };

  // ── Instrucciones ──
  const guia = libro.addWorksheet('Instrucciones');
  guia.columns = [{ width: 26 }, { width: 90 }];

  const titulo = guia.addRow([opciones.titulo]);
  titulo.font = { bold: true, size: 14, color: { argb: 'FF12343F' } };
  guia.addRow([]);

  for (const linea of opciones.instrucciones) {
    const r = guia.addRow(['', linea]);
    r.getCell(2).alignment = { wrapText: true };
  }

  guia.addRow([]);
  const encColumnas = guia.addRow(['Columna', 'Qué se espera']);
  encColumnas.font = { bold: true };
  for (const c of opciones.columnas) {
    const r = guia.addRow([c.titulo + (c.obligatoria ? ' *' : ''), c.ayuda]);
    r.getCell(2).alignment = { wrapText: true };
  }

  for (const lista of opciones.listas ?? []) {
    guia.addRow([]);
    const enc = guia.addRow([lista.titulo, '']);
    enc.font = { bold: true };
    const r = guia.addRow(['', lista.valores.join(' · ')]);
    r.getCell(2).alignment = { wrapText: true };
  }

  const salida = await libro.xlsx.writeBuffer();
  return Buffer.from(salida);
}
