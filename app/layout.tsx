import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gogoo Truck Operations Panel",
  description: "Truck & Logistics Dashboard — gogoo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
