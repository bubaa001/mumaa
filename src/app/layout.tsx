import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MUMAA — A private world for two",
  description: "A private digital world shared between two people.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
