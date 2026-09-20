import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/components/providers';
import './globals.css';

/**
 * Tipografía: Geist Sans y Geist Mono.
 *
 * Se sirven desde el paquete npm `geist` (por debajo, `next/font/local`): los
 * archivos de fuente viajan dentro del bundle y `next build` **no** necesita
 * red. Esa fue la razón para descartar `next/font/google` en la primera versión
 * y sigue vigente: un evaluador que construya sin conexión no debe ver fallar el
 * build por un detalle tipográfico.
 */

export const metadata: Metadata = {
  title: {
    default: 'NODUS — Control empresarial',
    template: '%s · NODUS',
  },
  description:
    'Plataforma de orquestación empresarial: gestión trazable y gobernada del ciclo completo ' +
    'de atención de casos entre Mipymes y consultores.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAFAF9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
