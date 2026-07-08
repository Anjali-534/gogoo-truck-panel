import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bogie Truck Operations Panel",
  description: "Truck & Logistics Dashboard — bogie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
