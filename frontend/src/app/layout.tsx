'use client';
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { AuthProvider } from '../context/AuthContext';
import Header from '../components/Header';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <SessionProvider>
          <AuthProvider>
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
