import { cn } from '@/lib/cn';

/**
 * Símbolo de MEDIGEX: cruz inscrita en un círculo. Representa el punto de
 * atención, donde convergen médico, paciente y gestión.
 *
 * Geometría exacta de la norma gráfica (retícula de 72): círculo de radio 33
 * centrado, brazos de 8 de grosor y 32 de largo. No redibujar a ojo.
 */
export function Simbolo({
  tamano = 28,
  variante = 'color',
  className,
}: {
  tamano?: number;
  /** `color` sobre fondos claros · `negativo` sobre azul · `oscuro` en modo oscuro */
  variante?: 'color' | 'negativo' | 'oscuro' | 'tinta';
  className?: string;
}) {
  const relleno = {
    color: '#2A6B80',
    negativo: '#FFFFFF',
    oscuro: '#6BB8C4',
    tinta: '#12343F',
  }[variante];

  const cruz = {
    color: '#FFFFFF',
    negativo: '#2A6B80',
    oscuro: '#3B4247',
    tinta: '#FFFFFF',
  }[variante];

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 72 72"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="MEDIGEX"
    >
      <circle cx="36" cy="36" r="33" fill={relleno} />
      <rect x="32" y="20" width="8" height="32" fill={cruz} />
      <rect x="20" y="32" width="32" height="8" fill={cruz} />
    </svg>
  );
}

/**
 * Lockup completo: símbolo + wordmark en Geologica Bold con tracking amplio.
 * El tagline sólo aparece en las versiones grandes, como indica la norma.
 */
export function Logotipo({
  tamano = 'md',
  variante = 'color',
  conTagline = false,
  className,
}: {
  tamano?: 'sm' | 'md' | 'lg';
  variante?: 'color' | 'negativo' | 'oscuro' | 'tinta';
  conTagline?: boolean;
  className?: string;
}) {
  const medidas = {
    sm: { simbolo: 22, texto: 'text-sm', tagline: 'text-[9px]' },
    md: { simbolo: 30, texto: 'text-lg', tagline: 'text-[10px]' },
    lg: { simbolo: 44, texto: 'text-2xl', tagline: 'text-xs' },
  }[tamano];

  const colorTexto = {
    color: 'text-brand-600',
    negativo: 'text-white',
    oscuro: 'text-white',
    tinta: 'text-brand-900',
  }[variante];

  const colorTagline = {
    color: 'text-tinta-500',
    negativo: 'text-brand-100',
    oscuro: 'text-brand-400',
    tinta: 'text-tinta-500',
  }[variante];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Simbolo tamano={medidas.simbolo} variante={variante} />
      <span className="flex flex-col justify-center leading-none">
        <span className={cn('font-display font-bold tracking-marca', medidas.texto, colorTexto)}>MEDIGEX</span>
        {conTagline && (
          <span className={cn('mt-1 font-sans tracking-wide', medidas.tagline, colorTagline)}>
            Gestión clínica integral
          </span>
        )}
      </span>
    </span>
  );
}
