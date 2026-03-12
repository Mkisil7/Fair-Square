import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fair and Square',
  description: 'A Mobile-First Expense Splitter for Trips',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 antialiased h-[100dvh] flex flex-col" suppressHydrationWarning>
        <main className="flex-1 w-full max-w-md mx-auto bg-white dark:bg-black shadow-xl relative overflow-hidden flex flex-col">
          {children}
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  );
}
