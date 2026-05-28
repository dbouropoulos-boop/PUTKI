/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo Black"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        // CSS-variable-driven (light/dark aware)
        bg:            'var(--bg)',
        surface:       'var(--surface)',
        'surface-2':   'var(--surface-2)',
        ink:           'var(--ink)',
        'ink-2':       'var(--ink-2)',
        'ink-3':       'var(--ink-3)',
        'muted-text':  'var(--muted)',
        line:          'var(--line)',
        'line-strong': 'var(--line-strong)',
        'subtle-border': 'var(--line)',
        'border-strong': 'var(--line-strong)',
        // Ember accent (Phase 1)
        ember:         'var(--ember)',
        'ember-soft':  'var(--ember-soft)',
        'ember-strong':'var(--ember-strong)',
        // Brand alias now points to ember per Phase 1 spec
        'brand-blue':  'var(--brand-blue)',
        'mestari-accent': 'var(--mestari-accent)',
        'voita-accent':   'var(--voita-accent)',
        needle:        'var(--needle)',
        // Legacy Phase 1 names kept
        paper: 'var(--bg)',
        // Dial state palette (stable across themes)
        'dial-kylma':       '#2C5F8D',
        'dial-haalea':      '#7A7E83',
        'dial-kuuma':       '#E8924A',
        'dial-myrsky':      '#C8423C',
        'dial-kiirastuli':  '#8B1E1A',
        // Shadcn tokens
        background:    'hsl(var(--background))',
        foreground:    'hsl(var(--foreground))',
        card:          { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover:       { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary:       { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:     { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:         { DEFAULT: 'hsl(var(--muted-shadcn))', foreground: 'hsl(var(--muted-foreground))' },
        accent:        { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive:   { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border:        'hsl(var(--border-shadcn))',
        input:         'hsl(var(--input))',
        ring:          'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
