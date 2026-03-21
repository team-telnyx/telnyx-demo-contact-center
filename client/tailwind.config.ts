import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'telnyx-green': '#00a37a',
        'telnyx-green-light': '#00e3aa',
        'telnyx-green-vibrant': '#00E896',
        'telnyx-black': '#000000',
      },
      borderRadius: {
        btn: '12px',
        card: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
