import type { Metadata } from "next";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: "Contact Center V2",
  description: "Next.js Contact Center Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <div id="modal-root"></div>
      </body>
    </html>
  );
}
