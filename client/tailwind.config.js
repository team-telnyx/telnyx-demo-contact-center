/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Telnyx Brand Palette ─────────────────────── */
        tx: {
          green:       'var(--accent)',
          'green-hi':   'var(--accent-hover)',
          'green-dark': 'var(--accent-dark)',
          citron:       'var(--citron)',
          blue:         '#22d3ee',
          red:          '#ef4444',
          purple:       '#a78bfa',

          /* Surfaces — via CSS variables for theme switching */
          s0: 'var(--surface-0)',
          s1: 'var(--surface-1)',
          s2: 'var(--surface-2)',
          s3: 'var(--surface-3)',
          s4: 'var(--surface-4)',

          /* Borders */
          bsubtle: 'var(--border-subtle)',
          bdefault:'var(--border-default)',
          bstrong: 'var(--border-strong)',

          /* Text — high contrast */
          tp: 'var(--text-primary)',
          ts: 'var(--text-secondary)',
          tt: 'var(--text-tertiary)',
          ti: 'var(--text-inverse)',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'waveform': 'waveform-bar 1.2s ease-in-out infinite',
        'fade-in': 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-left': 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'call-pulse': 'call-pulse 2s infinite',
        'incoming-ring': 'incoming-ring 1.5s infinite',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'tx-sm': '0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px var(--border-subtle)',
        'tx-md': '0 4px 12px rgba(0,0,0,0.10), 0 0 0 1px var(--border-subtle)',
        'tx-lg': '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px var(--border-default)',
        'tx-xl': '0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px var(--border-default)',
        'tx-glow': '0 0 20px var(--accent-glow), 0 0 0 1px var(--border-strong)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
