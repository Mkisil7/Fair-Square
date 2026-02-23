import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fair and Square',
  description: 'A Mobile-First Expense Splitter for Trips',
};

import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <main className="flex-1 w-full max-w-md mx-auto bg-white shadow-xl relative overflow-hidden flex flex-col">
          {children}
          <Analytics />
        </main>
      </body>
    </html>
  );
}
