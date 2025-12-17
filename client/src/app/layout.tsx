'use client';

import type { Metadata } from "next";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

// export const metadata: Metadata = {
//   title: "Contact Center V2",
//   description: "Next.js Contact Center Application",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Contact Center V2</title>
        <meta name="description" content="Next.js Contact Center Application" />
      </head>
      <body>
        <AuthProvider>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </AuthProvider>
        <div id="modal-root"></div>
      </body>
    </html>
  );
}
