import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "V.E.R.A. — Verslag- en Rapportage Assistent",
  description:
    "V.E.R.A. zet aantekeningen en evaluaties om in een gestructureerd conceptverslag volgens het juiste format en controleert welke informatie nog ontbreekt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
