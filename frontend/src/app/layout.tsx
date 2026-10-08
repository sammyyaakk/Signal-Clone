import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Signal Desktop ships Inter; the system stack is the fallback while it loads.
const inter = Inter({
  subsets: ["latin"],
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Signal",
  description: "A Signal messenger clone",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
