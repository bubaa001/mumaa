import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-mumaa-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-mumaa-sans",
});

export const metadata: Metadata = {
  title: "MUMAA | A private world for two",
  description: "A private digital world shared between two people.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
