'use client';

import { cn } from '@/lib/cn';
import { CARAS_ESQUEMA, ladoDeLaCara, type Cara, type Pieza } from '@/lib/dental';

/**
 * Representación de una pieza dental: la silueta anatómica y, debajo, el
 * esquema de cinco caras que es donde realmente se marca.
 *
 * El esquema es un círculo dividido en cuatro sectores más un centro. Cada
 * sector corresponde a una cara y su posición depende del cuadrante: la
 * mesial siempre mira hacia la línea media, así que en el lado derecho de la
 * boca queda a la derecha del dibujo y en el izquierdo a la izquierda. Si se
 * dibujara siempre igual, las marcas quedarían espejadas respecto del
 * paciente.
 */

const ANCHO = 38;
const ALTO_SILUETA = 46;
const RADIO_EXT = 15;
const RADIO_INT = 6;

/** Ángulos de cada sector, en grados, con 0 a la derecha y creciendo horario. */
const SECTORES: Record<'arriba' | 'derecha' | 'abajo' | 'izquierda', [number, number]> = {
  arriba: [225, 315],
  derecha: [315, 405],
  abajo: [45, 135],
  izquierda: [135, 225],
};

function punto(cx: number, cy: number, radio: number, grados: number) {
  const rad = (grados * Math.PI) / 180;
  return [cx + radio * Math.cos(rad), cy + radio * Math.sin(rad)];
}

function sector(cx: number, cy: number, desde: number, hasta: number) {
  const [x1, y1] = punto(cx, cy, RADIO_INT, desde);
  const [x2, y2] = punto(cx, cy, RADIO_EXT, desde);
  const [x3, y3] = punto(cx, cy, RADIO_EXT, hasta);
  const [x4, y4] = punto(cx, cy, RADIO_INT, hasta);
  return [
    `M ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${RADIO_EXT} ${RADIO_EXT} 0 0 1 ${x3} ${y3}`,
    `L ${x4} ${y4}`,
    `A ${RADIO_INT} ${RADIO_INT} 0 0 0 ${x1} ${y1}`,
    'Z',
  ].join(' ');
}

/** Silueta simplificada: corona con la forma del tipo de diente y sus raíces. */
function Silueta({ pieza }: { pieza: Pieza }) {
  const arriba = pieza.arcada === 'superior';
  const altoRaiz = 22;
  const altoCorona = ALTO_SILUETA - altoRaiz;

  // En la arcada superior las raíces van arriba; en la inferior, abajo.
  const yRaiz = arriba ? 0 : altoCorona;
  const yCorona = arriba ? altoRaiz : 0;

  const anchoCorona = pieza.tipo === 'molar' ? 26 : pieza.tipo === 'premolar' ? 20 : 16;
  const xCorona = (ANCHO - anchoCorona) / 2;

  const raices = Array.from({ length: pieza.raices }, (_, i) => {
    const separacion = pieza.raices === 1 ? 0 : (i - (pieza.raices - 1) / 2) * (anchoCorona / pieza.raices);
    const xBase = ANCHO / 2 + separacion;
    const puntaY = arriba ? 2 : ALTO_SILUETA - 2;
    const baseY = arriba ? altoRaiz : altoCorona;
    return (
      <path
        key={i}
        d={`M ${xBase - 4} ${baseY} Q ${xBase - 2} ${(baseY + puntaY) / 2} ${xBase} ${puntaY}
            Q ${xBase + 2} ${(baseY + puntaY) / 2} ${xBase + 4} ${baseY} Z`}
        className="fill-white stroke-tinta-400"
        strokeWidth="1"
      />
    );
  });

  return (
    <g>
      {raices}
      <rect
        x={xCorona}
        y={yCorona}
        width={anchoCorona}
        height={altoCorona}
        rx={pieza.anterior ? 2 : 4}
        className="fill-white stroke-tinta-400"
        strokeWidth="1.2"
      />
      {/* Línea del cuello, donde termina la corona */}
      <line
        x1={xCorona}
        y1={arriba ? yRaiz + altoRaiz : altoCorona}
        x2={xCorona + anchoCorona}
        y2={arriba ? yRaiz + altoRaiz : altoCorona}
        className="stroke-tinta-300"
        strokeWidth="0.8"
      />
    </g>
  );
}

export interface MarcaCara {
  color: string;
  /** Un pendiente se dibuja con trama en vez de relleno pleno. */
  pendiente?: boolean;
  titulo?: string;
}

export function DientePieza({
  pieza,
  marcas,
  marcaPieza,
  seleccionadas,
  onCara,
  onPieza,
  ausente,
  deshabilitado,
}: {
  pieza: Pieza;
  /** Color por cara, según los registros ya guardados. */
  marcas: Partial<Record<Cara, MarcaCara>>;
  /** Marca que cubre la pieza entera (corona, extracción, implante…). */
  marcaPieza?: MarcaCara;
  seleccionadas: Cara[];
  onCara?: (cara: Cara) => void;
  onPieza?: () => void;
  ausente?: boolean;
  deshabilitado?: boolean;
}) {
  const arriba = pieza.arcada === 'superior';
  const cx = ANCHO / 2;
  const cyEsquema = RADIO_EXT + 2;

  const esquema = (
    <svg width={ANCHO} height={RADIO_EXT * 2 + 4} className="overflow-visible">
      {CARAS_ESQUEMA.map((cara) => {
        const lado = ladoDeLaCara(cara, pieza);
        const marca = marcas[cara];
        const elegida = seleccionadas.includes(cara);
        const comun = {
          className: cn(
            'transition',
            !deshabilitado && 'cursor-pointer hover:opacity-80',
            elegida && 'stroke-brand-600',
          ),
          strokeWidth: elegida ? 2 : 1,
          onClick: deshabilitado ? undefined : () => onCara?.(cara),
        };

        const relleno = marca ? marca.color : '#FFFFFF';
        const opacidad = marca?.pendiente ? 0.35 : 1;

        if (lado === 'centro') {
          return (
            <circle
              key={cara}
              cx={cx}
              cy={cyEsquema}
              r={RADIO_INT}
              fill={relleno}
              fillOpacity={opacidad}
              stroke={elegida ? '#2A6B80' : '#95AEB7'}
              {...comun}
            >
              {marca?.titulo && <title>{marca.titulo}</title>}
            </circle>
          );
        }

        const [desde, hasta] = SECTORES[lado];
        return (
          <path
            key={cara}
            d={sector(cx, cyEsquema, desde, hasta)}
            fill={relleno}
            fillOpacity={opacidad}
            stroke={elegida ? '#2A6B80' : '#95AEB7'}
            {...comun}
          >
            {marca?.titulo && <title>{marca.titulo}</title>}
          </path>
        );
      })}
    </svg>
  );

  const silueta = (
    <svg
      width={ANCHO}
      height={ALTO_SILUETA}
      onClick={deshabilitado ? undefined : onPieza}
      className={cn('overflow-visible', !deshabilitado && 'cursor-pointer')}
    >
      <Silueta pieza={pieza} />
      {marcaPieza && (
        <rect
          x={2}
          y={2}
          width={ANCHO - 4}
          height={ALTO_SILUETA - 4}
          fill={marcaPieza.color}
          fillOpacity={marcaPieza.pendiente ? 0.25 : 0.45}
          stroke={marcaPieza.color}
          strokeWidth="1.5"
        >
          {marcaPieza.titulo && <title>{marcaPieza.titulo}</title>}
        </rect>
      )}
      {ausente && (
        <>
          <line x1="4" y1="4" x2={ANCHO - 4} y2={ALTO_SILUETA - 4} className="stroke-error" strokeWidth="2" />
          <line x1={ANCHO - 4} y1="4" x2="4" y2={ALTO_SILUETA - 4} className="stroke-error" strokeWidth="2" />
        </>
      )}
    </svg>
  );

  const numero = (
    <span
      onClick={deshabilitado ? undefined : onPieza}
      className={cn(
        'select-none text-center font-mono text-[10px] tabular-nums',
        marcaPieza || ausente ? 'font-semibold text-brand-700' : 'text-tinta-500',
        !deshabilitado && 'cursor-pointer hover:text-brand-600',
      )}
    >
      {pieza.codigo}
    </span>
  );

  // En la arcada superior el diente va arriba y el esquema abajo; en la
  // inferior se invierte, para que ambos esquemas queden juntos al centro.
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5" style={{ width: ANCHO }}>
      {arriba ? (
        <>
          {silueta}
          {esquema}
          {numero}
        </>
      ) : (
        <>
          {numero}
          {esquema}
          {silueta}
        </>
      )}
    </div>
  );
}
