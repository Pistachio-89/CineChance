import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LayoutClient from './components/LayoutClient';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CineChance',
  description: 'Твой кинотрекер',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="w-full h-full" data-scroll-behavior="smooth">
      <body className={`bg-gray-950 text-white min-h-screen w-full ${inter.className}`}>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}