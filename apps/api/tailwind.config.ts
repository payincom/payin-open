import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './client/**/*.{ts,tsx}',
    './src/routes/**/*.{ts,tsx}',
    './src/checkout/**/*.{ts,tsx}',  // Local checkout components - reliable scanning
    '../../packages/shared/src/**/*.{ts,tsx}',  // Kept for backward compatibility
  ],
  safelist: [
    // === Core utility classes ===
    'hidden',

    // === Container and layout ===
    'max-w-7xl',           // Page container max-width
    'min-h-screen',        // Full viewport height

    // === Spacing (margin/padding) ===
    // Decimal sizes
    'w-1.5', 'h-1.5',
    'gap-1.5', 'gap-2', 'gap-3', 'gap-8',
    'mt-0.5',
    'px-2.5', 'py-0.5',

    // Standard sizes
    'h-4', 'h-5', 'h-12', 'h-16',
    'w-4', 'w-5', 'w-8',
    'mb-1', 'mb-2', 'mb-4', 'mb-6',
    'mt-2', 'mt-6', 'mt-8', 'mt-12',
    'pt-4', 'pt-6',
    'px-3', 'px-4', 'px-6',
    'py-1', 'py-6', 'py-8',

    // Space-y variants
    'space-y-3', 'space-y-4', 'space-y-6',

    // Text/line-height
    'leading-relaxed',

    // === sm breakpoint (640px+) ===
    'sm:flex',
    'sm:px-6',
    'sm:text-5xl',

    // === lg breakpoint (1024px+) ===
    'lg:px-8',
    'lg:py-12',
    'lg:grid-cols-12',
    'lg:gap-12',
    'lg:col-span-5',
    'lg:col-span-7',
    'lg:sticky',
    'lg:top-8',
    'lg:hidden',
    'lg:block',
    'lg:p-8',
    'lg:text-5xl',
  ],
  theme: {
    screens: {
      sm: '40rem',    // 640px
      md: '48rem',    // 768px
      lg: '64rem',    // 1024px
      xl: '80rem',    // 1280px
      '2xl': '96rem', // 1536px
    },
    extend: {
      maxWidth: {
        '7xl': '80rem',  // Ensure max-w-7xl is defined
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
