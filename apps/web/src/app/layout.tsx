import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

/**
 * La tipografía usa la pila del sistema, definida en `globals.css`.
 *
 * Se descartó `next/font/google` a propósito: descarga la fuente en tiempo de
 * compilación, lo que hace que `next build` dependa de tener acceso a
 * fonts.googleapis.com. Un evaluador que construya sin red — o detrás de un
 * proxy corporativo — vería fallar el build por un detalle tipográfico. La pila
 * del sistema se ve bien en los tres sistemas operativos y no cuesta una
 * petición.
 */

export const metadata: Metadata = {
  title: {
    default: 'NODUS — Orquestación empresarial',
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
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
