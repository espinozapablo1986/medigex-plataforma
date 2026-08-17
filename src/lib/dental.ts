/**
 * Notación dental FDI y geometría de las piezas.
 *
 * El primer dígito es el cuadrante y el segundo la posición desde la línea
 * media. Cuadrantes 1 a 4 para dentición permanente y 5 a 8 para temporal,
 * numerados en el sentido de las agujas del reloj vistos de frente:
 *
 *        1 · sup. derecho │ 2 · sup. izquierdo
 *        ────────────────┼─────────────────
 *        4 · inf. derecho │ 3 · inf. izquierdo
 *
 * Como el esquema se dibuja desde la perspectiva del profesional que mira al
 * paciente, el cuadrante 1 aparece a la izquierda de la pantalla.
 */

export type Arcada = 'superior' | 'inferior';
export type Lado = 'derecho' | 'izquierdo';

export interface Pieza {
  /** Notación FDI, ej. "1.8" */
  codigo: string;
  cuadrante: number;
  posicion: number;
  arcada: Arcada;
  lado: Lado;
  tipo: 'incisivo' | 'canino' | 'premolar' | 'molar';
  /** Los anteriores tienen borde incisal en vez de cara oclusal. */
  anterior: boolean;
  /** Cuántas raíces dibujar. */
  raices: number;
  /** Sólo los molares pueden tener compromiso de furca. */
  tieneFurca: boolean;
}

function tipoPorPosicion(posicion: number, temporal: boolean): Pieza['tipo'] {
  if (temporal) {
    // La dentición temporal no tiene premolares: 1-2 incisivos, 3 canino, 4-5 molares.
    if (posicion <= 2) return 'incisivo';
    if (posicion === 3) return 'canino';
    return 'molar';
  }
  if (posicion <= 2) return 'incisivo';
  if (posicion === 3) return 'canino';
  if (posicion <= 5) return 'premolar';
  return 'molar';
}

function raicesDe(tipo: Pieza['tipo'], arcada: Arcada, posicion: number): number {
  if (tipo === 'molar') return arcada === 'superior' ? 3 : 2;
  if (tipo === 'premolar') return arcada === 'superior' && posicion === 4 ? 2 : 1;
  return 1;
}

function construirPieza(cuadrante: number, posicion: number): Pieza {
  const temporal = cuadrante >= 5;
  const arcada: Arcada = cuadrante === 1 || cuadrante === 2 || cuadrante === 5 || cuadrante === 6
    ? 'superior'
    : 'inferior';
  const lado: Lado = cuadrante === 1 || cuadrante === 4 || cuadrante === 5 || cuadrante === 8
    ? 'derecho'
    : 'izquierdo';
  const tipo = tipoPorPosicion(posicion, temporal);

  return {
    codigo: `${cuadrante}.${posicion}`,
    cuadrante,
    posicion,
    arcada,
    lado,
    tipo,
    anterior: tipo === 'incisivo' || tipo === 'canino',
    raices: raicesDe(tipo, arcada, posicion),
    tieneFurca: tipo === 'molar',
  };
}

/** Del más posterior al más anterior, que es como se dibuja en pantalla. */
function cuadranteDescendente(cuadrante: number, hasta: number): Pieza[] {
  return Array.from({ length: hasta }, (_, i) => construirPieza(cuadrante, hasta - i));
}

function cuadranteAscendente(cuadrante: number, hasta: number): Pieza[] {
  return Array.from({ length: hasta }, (_, i) => construirPieza(cuadrante, i + 1));
}

/** Fila superior de la dentición permanente: 1.8 … 1.1 · 2.1 … 2.8 */
export const PERMANENTE_SUPERIOR = [...cuadranteDescendente(1, 8), ...cuadranteAscendente(2, 8)];
/** Fila inferior: 4.8 … 4.1 · 3.1 … 3.8 */
export const PERMANENTE_INFERIOR = [...cuadranteDescendente(4, 8), ...cuadranteAscendente(3, 8)];

/** Temporal: 5.5 … 5.1 · 6.1 … 6.5 arriba, 8.5 … 8.1 · 7.1 … 7.5 abajo */
export const TEMPORAL_SUPERIOR = [...cuadranteDescendente(5, 5), ...cuadranteAscendente(6, 5)];
export const TEMPORAL_INFERIOR = [...cuadranteDescendente(8, 5), ...cuadranteAscendente(7, 5)];

export function filasDe(denticion: 'PERMANENTE' | 'TEMPORAL') {
  return denticion === 'TEMPORAL'
    ? { superior: TEMPORAL_SUPERIOR, inferior: TEMPORAL_INFERIOR }
    : { superior: PERMANENTE_SUPERIOR, inferior: PERMANENTE_INFERIOR };
}

export function todasLasPiezas(denticion: 'PERMANENTE' | 'TEMPORAL'): Pieza[] {
  const { superior, inferior } = filasDe(denticion);
  return [...superior, ...inferior];
}

const INDICE = new Map<string, Pieza>(
  [...todasLasPiezas('PERMANENTE'), ...todasLasPiezas('TEMPORAL')].map((p) => [p.codigo, p]),
);

export function buscarPieza(codigo: string): Pieza | undefined {
  return INDICE.get(codigo);
}

// ─────────────────────────────────────────────────────────────
//  Caras
// ─────────────────────────────────────────────────────────────

export const CARAS = [
  'VESTIBULAR',
  'PALATINO_LINGUAL',
  'MESIAL',
  'DISTAL',
  'OCLUSAL_INCISAL',
  'CERVICAL',
  'RAIZ',
  'PIEZA_COMPLETA',
] as const;

export type Cara = (typeof CARAS)[number];

/** Las cinco caras que se marcan sobre el esquema. */
export const CARAS_ESQUEMA: Cara[] = [
  'VESTIBULAR',
  'MESIAL',
  'OCLUSAL_INCISAL',
  'DISTAL',
  'PALATINO_LINGUAL',
];

export function nombreCara(cara: Cara, pieza?: Pieza): string {
  switch (cara) {
    case 'VESTIBULAR':
      return 'Vestibular';
    case 'PALATINO_LINGUAL':
      // En la arcada superior se llama palatino; en la inferior, lingual.
      return pieza?.arcada === 'inferior' ? 'Lingual' : 'Palatino';
    case 'MESIAL':
      return 'Mesial';
    case 'DISTAL':
      return 'Distal';
    case 'OCLUSAL_INCISAL':
      return pieza?.anterior ? 'Incisal' : 'Oclusal';
    case 'CERVICAL':
      return 'Cervical';
    case 'RAIZ':
      return 'Raíz';
    case 'PIEZA_COMPLETA':
      return 'Pieza completa';
  }
}

export function abreviaturaCara(cara: Cara, pieza?: Pieza): string {
  switch (cara) {
    case 'VESTIBULAR':
      return 'V';
    case 'PALATINO_LINGUAL':
      return pieza?.arcada === 'inferior' ? 'L' : 'P';
    case 'MESIAL':
      return 'M';
    case 'DISTAL':
      return 'D';
    case 'OCLUSAL_INCISAL':
      return pieza?.anterior ? 'I' : 'O';
    case 'CERVICAL':
      return 'C';
    case 'RAIZ':
      return 'R';
    case 'PIEZA_COMPLETA':
      return '—';
  }
}

/**
 * Posición de cada cara dentro del esquema de la pieza.
 *
 * La mesial es la que mira a la línea media, así que en el lado derecho de la
 * boca queda a la derecha del dibujo y en el izquierdo a la izquierda. Si se
 * ignora esto, las marcas quedan espejadas respecto de la realidad.
 */
export function ladoDeLaCara(cara: Cara, pieza: Pieza): 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'centro' {
  const mesialALaDerecha = pieza.lado === 'derecho';

  switch (cara) {
    case 'VESTIBULAR':
      return pieza.arcada === 'superior' ? 'arriba' : 'abajo';
    case 'PALATINO_LINGUAL':
      return pieza.arcada === 'superior' ? 'abajo' : 'arriba';
    case 'MESIAL':
      return mesialALaDerecha ? 'derecha' : 'izquierda';
    case 'DISTAL':
      return mesialALaDerecha ? 'izquierda' : 'derecha';
    default:
      return 'centro';
  }
}

// ─────────────────────────────────────────────────────────────
//  Periodontograma
// ─────────────────────────────────────────────────────────────

export const SITIOS = ['MESIAL', 'CENTRAL', 'DISTAL'] as const;
export const CARAS_PERIODONTALES = ['VESTIBULAR', 'PALATINO_LINGUAL'] as const;

/**
 * Nivel de inserción clínica: profundidad de sondaje más margen gingival.
 *
 * El margen se registra positivo cuando la encía cubre el límite
 * amelocementario y negativo cuando hay recesión, de modo que la suma da
 * directamente la pérdida de inserción.
 */
export function nivelInsercion(profundidad: number, margen: number): number {
  return profundidad + margen;
}

/** Una bolsa se considera patológica desde los 4 mm. */
export function esBolsaPatologica(profundidad: number): boolean {
  return profundidad >= 4;
}

export function severidadBolsa(profundidad: number): 'sana' | 'leve' | 'moderada' | 'severa' {
  if (profundidad <= 3) return 'sana';
  if (profundidad === 4) return 'leve';
  if (profundidad <= 6) return 'moderada';
  return 'severa';
}
