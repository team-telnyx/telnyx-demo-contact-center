import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Contact Center',
  description: 'Telnyx-powered Contact Center Platform',
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('darkMode') === 'true') {
              document.documentElement.classList.add('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      <body className="bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
