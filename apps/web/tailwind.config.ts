import type { Config } from 'tailwindcss';

/**
 * Sistema visual de NODUS — tokens.
 *
 * Los valores viven como variables CSS en `src/app/globals.css`; aquí sólo se
 * exponen a Tailwind. Tres familias de color que nunca se mezclan (ver
 * `docs/architecture/ui-redesign.md`):
 *
 *   - neutros  → estructura (≈85 % de la interfaz)
 *   - marca    → acción principal, selección, foco, progreso
 *   - alertas  → SLA, errores, confirmaciones — siempre con icono y texto
 *
 * Los estados del caso NO tienen color propio: se leen por texto, forma del
 * indicador y posición en el workflow.
 */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    // --- Radios: 4 · 6 · 8 · 10. `full` sólo avatares y puntos de estado. -----
    borderRadius: {
      none: '0',
      xs: '4px', // chips, kbd, contadores, pastilla de estado
      sm: '6px', // botones, inputs, ítems de menú y navegación
      DEFAULT: '6px',
      md: '8px', // paneles, tarjetas, popovers, tablas
      lg: '10px', // diálogos
      full: '9999px',
    },
    // --- Elevación: paneles planos con borde; sombra sólo en overlays. -------
    boxShadow: {
      none: 'none',
      'pop-sm': '0 8px 24px -8px rgb(18 18 18 / 0.14), 0 1px 3px rgb(18 18 18 / 0.06)',
      pop: '0 20px 48px -16px rgb(18 18 18 / 0.22), 0 2px 8px -2px rgb(18 18 18 / 0.08)',
      focus: '0 0 0 3px hsl(var(--brand) / 0.22)',
    },
    // --- Tipografía por roles (ver docs/architecture/nodus-design-system.md) --
    fontSize: {
      overline: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }], // 11
      caption: ['0.75rem', { lineHeight: '1rem' }], // 12
      label: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }], // 12
      'body-sm': ['0.8125rem', { lineHeight: '1.125rem' }], // 13
      body: ['0.875rem', { lineHeight: '1.25rem' }], // 14
      prose: ['0.9375rem', { lineHeight: '1.5rem' }], // 15 — relatos y propuestas
      h3: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }], // 14
      h2: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em', fontWeight: '600' }], // 16
      h1: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }], // 22
      display: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '600' }], // 28
      kpi: ['2rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '600' }], // 32
      hero: ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.03em', fontWeight: '600' }], // 44 — sólo login
      // Alias de la escala anterior, alineados con los roles.
      '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['0.9375rem', { lineHeight: '1.5rem' }],
    },
    extend: {
      colors: {
        // ---------------------------------------------------------- neutros --
        background: token('background'),
        foreground: token('foreground'),
        surface: token('card'),
        ink: {
          DEFAULT: token('foreground'),
          2: token('ink-2'),
        },
        border: token('border'),
        'border-subtle': token('border-subtle'),
        'border-strong': token('border-strong'),
        input: token('border-strong'),
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        subtle: {
          foreground: token('subtle-foreground'),
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('foreground'),
        },
        popover: {
          DEFAULT: token('card'),
          foreground: token('foreground'),
        },

        // ------------------------------------------------------------ marca --
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          soft: token('brand-soft'),
          foreground: token('brand-foreground'),
        },
        ring: token('brand'),

        // ---------------------------------------------------------- alertas --
        success: {
          DEFAULT: token('success'),
          soft: token('success-soft'),
          foreground: token('card'),
        },
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          foreground: token('card'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
          foreground: token('card'),
        },

        // ------------------------------------------- alias de compatibilidad --
        // Nombres de shadcn. Apuntan a los tokens nuevos para que nada pueda
        // quedar fuera del sistema aunque alguien los use.
        primary: {
          DEFAULT: token('brand'),
          foreground: token('brand-foreground'),
        },
        secondary: {
          DEFAULT: token('muted'),
          foreground: token('foreground'),
        },
        accent: {
          DEFAULT: token('brand-soft'),
          foreground: token('foreground'),
        },
        destructive: {
          DEFAULT: token('danger'),
          foreground: token('card'),
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: {
        page: '1440px',
        prose: '68ch',
      },
      letterSpacing: {
        brand: '0.16em', // palabra NODUS
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
