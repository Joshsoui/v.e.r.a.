import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "V.E.R.A. — Verslag- en Rapportage Assistent",
  description:
    "V.E.R.A. zet aantekeningen en evaluaties om in een gestructureerd conceptverslag volgens het juiste format en controleert welke informatie nog ontbreekt.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Het enkel uitlezen van headers() hier is wat Next.js nodig heeft om de
  // CSP-nonce (gezet door src/middleware.ts) automatisch toe te passen op
  // zijn eigen inline hydratatiescripts. Zonder deze read blijven die
  // scripts nonce-loos en blokkeert de browser ze onder een strikte
  // script-src 'self' CSP — dan hydrateert de app nooit en reageert geen
  // enkele knop.
  await headers();

  return (
    <html lang="nl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
