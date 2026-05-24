import './globals.css';

export const metadata = {
  title: 'Telnyx Contact Center',
  description: 'Enterprise contact center powered by Telnyx',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tx-s0 text-tx-tp antialiased">{children}</body>
    </html>
  );
}
