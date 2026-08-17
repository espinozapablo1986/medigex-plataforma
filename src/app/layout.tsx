import type { Metadata, Viewport } from 'next';
import { Geologica, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google';

import './globals.css';

/**
 * Tipografías de la norma gráfica. `next/font` las descarga en el build y las
 * sirve desde el propio dominio: no hay petición a Google en tiempo de
 * ejecución ni riesgo de que el texto caiga a una fuente de sistema.
 */
const display = Geologica({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--fuente-display',
  display: 'swap',
});

const texto = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--fuente-texto',
  display: 'swap',
});

const datos = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--fuente-datos',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MEDIGEX',
    template: '%s · MEDIGEX',
  },
  description: 'MEDIGEX — gestión clínica integral',
  icons: {
    icon: [{ url: '/icono.svg', type: 'image/svg+xml' }],
    apple: '/icono.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2A6B80',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${display.variable} ${texto.variable} ${datos.variable}`}>
      <body>{children}</body>
    </html>
  );
}
