import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'BoroBhai - Bengali Civic AI Assistant',
  description: 'Get help with government documentation and civic processes in Bengali',
  keywords: 'Bengali, AI, civic, government, documentation, Bangladesh',
  viewport: 'width=device-width, initial-scale=1',
  authors: [{ name: 'BoroBhai Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1f2937" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-white dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}
