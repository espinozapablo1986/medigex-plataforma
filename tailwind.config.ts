import type { Config } from 'tailwindcss';

/**
 * Norma gráfica MEDIGEX v1.0 (agosto 2026).
 *
 * Los seis colores de marca son valores fijos; las rampas se construyeron
 * alrededor de ellos manteniendo el matiz, de modo que los tonos canónicos
 * caen en posiciones exactas:
 *
 *   brand-600  #2A6B80  azul quirófano — principal, acciones, titulares
 *   brand-400  #6BB8C4  aqua           — acento, estados, hover
 *   brand-900  #12343F  tinta          — texto y fondos profundos
 *   tinta-50   #F4F7F8  marfil         — fondos y superficies
 *   tinta-500  #6E8790  acero          — texto secundario en modo oscuro
 *   grafito    #3B4247                 — base del modo oscuro
 *
 * Proporción de uso buscada: 60 % marfil/blanco, 25 % quirófano y tinta,
 * 10 % aqua, 5 % semánticos.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul quirófano y su rampa
        brand: {
          50: '#EEF9FD',
          100: '#DEF0F8',
          200: '#C1E1ED',
          300: '#9BCADB',
          400: '#6BB8C4', // aqua
          500: '#44879E',
          600: '#2A6B80', // azul quirófano
          700: '#155265',
          800: '#0E4251',
          900: '#12343F', // tinta
        },

        // Neutros de marca: del marfil a la tinta, con el mismo matiz frío
        tinta: {
          50: '#F4F7F8', // marfil
          100: '#E7F0F4',
          200: '#D5E2E7',
          300: '#BCCED5',
          400: '#95AEB7',
          500: '#6E8790', // acero
          600: '#506E79',
          700: '#385863',
          800: '#244550',
          900: '#12343F', // tinta
        },

        aqua: '#6BB8C4',
        marfil: '#F4F7F8',
        acero: '#6E8790',
        grafito: '#3B4247',

        // Reservados para estados del sistema; nunca decorativos.
        exito: {
          fondo: '#D9EEDF',
          borde: '#A0CAAD',
          DEFAULT: '#318454',
          texto: '#115531',
        },
        alerta: {
          fondo: '#FBECD9',
          borde: '#E9C89B',
          DEFAULT: '#CA933E',
          texto: '#724D0B',
        },
        error: {
          fondo: '#FFE4E1',
          borde: '#F5B9B4',
          DEFAULT: '#B94642',
          texto: '#8C3432',
        },
      },

      fontFamily: {
        // Display: logotipo, titulares y cifras destacadas
        display: ['var(--fuente-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Texto: párrafos, UI, tablas y formularios
        sans: ['var(--fuente-texto)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Datos clínicos, folios y códigos
        mono: ['var(--fuente-datos)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Escala del manual: cuerpo 15/1.6, datos 13, H2 20, H1 30
        dato: ['0.8125rem', { lineHeight: '1.45' }],
        base: ['0.9375rem', { lineHeight: '1.6' }],
        h2: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        h1: ['1.875rem', { lineHeight: '1.15', fontWeight: '700' }],
      },

      /**
       * «Esquinas rectas en superficies y botones; el radio se reserva para
       * etiquetas y avatares.» Se anulan los radios intermedios en el tema,
       * así toda la interfaz obedece la norma sin tocar cada componente.
       */
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '2px', // iconografía: esquinas con radio 2
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px', // etiquetas de estado y avatares
      },

      // «Sombra máxima: 0 2px 8px al 8%.»
      boxShadow: {
        sm: '0 1px 3px rgb(18 52 63 / 0.06)',
        DEFAULT: '0 2px 8px rgb(18 52 63 / 0.08)',
        md: '0 2px 8px rgb(18 52 63 / 0.08)',
        lg: '0 2px 8px rgb(18 52 63 / 0.08)',
        xl: '0 2px 8px rgb(18 52 63 / 0.08)',
        none: 'none',
      },

      letterSpacing: {
        // El logotipo y las mayúsculas van con tracking amplio
        marca: '0.14em',
      },
    },
  },
  plugins: [],
};

export default config;
