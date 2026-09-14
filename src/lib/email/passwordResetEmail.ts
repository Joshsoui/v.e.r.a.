// Verzendt de wachtwoord-reset-e-mail via Resend. Bewust een losse, kleine
// module (niet een generieke "verstuur-elke-e-mail"-abstractie) — er is nu
// precies één e-mailsoort in de applicatie; een bredere abstractie is
// vervolgwerk voor zodra er een tweede bijkomt (bv. een uitnodigingsflow).
//
// Faalt bewust NOOIT de aanroepende request: als Resend niet geconfigureerd
// is of de verzending mislukt, geeft deze functie dat terug als resultaat
// (nooit een throw) zodat forgot-password/route.ts altijd kan terugvallen op
// het loggen van de link.

import { Resend } from "resend";
import { env } from "@/lib/env";

export type SendResetEmailResult = "sent" | "not_configured" | "failed";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (!env.resendApiKey) return null;
  cachedClient ??= new Resend(env.resendApiKey);
  return cachedClient;
}

function buildText(resetUrl: string): string {
  return [
    "Je hebt een nieuw wachtwoord aangevraagd voor V.E.R.A.",
    "",
    `Stel je nieuwe wachtwoord in via deze link: ${resetUrl}`,
    "",
    "Deze link is 1 uur geldig en maar één keer te gebruiken.",
    "Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren — er verandert dan niets aan je account.",
  ].join("\n");
}

function buildHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1f2b;">
      <h2 style="color: #213c6c;">Wachtwoord opnieuw instellen</h2>
      <p>Je hebt een nieuw wachtwoord aangevraagd voor V.E.R.A. (Verslag- en Rapportage Assistent).</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2955a3; color: #ffffff; text-decoration: none; border-radius: 8px;">
          Nieuw wachtwoord instellen
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">
        Werkt de knop niet? Kopieer en plak deze link in je browser:<br />
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="font-size: 13px; color: #555;">
        Deze link is 1 uur geldig en maar één keer te gebruiken.
      </p>
      <p style="font-size: 13px; color: #888;">
        Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren — er verandert dan niets aan je account.
      </p>
    </div>
  `.trim();
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResetEmailResult> {
  const client = getClient();
  if (!client) return "not_configured";

  try {
    const { error } = await client.emails.send({
      from: env.resendFromEmail,
      to,
      subject: "Wachtwoord opnieuw instellen — V.E.R.A.",
      text: buildText(resetUrl),
      html: buildHtml(resetUrl),
    });
    if (error) {
      console.error("Resend gaf een fout terug bij het versturen van de wachtwoord-reset-e-mail:", error);
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error("Kon wachtwoord-reset-e-mail niet versturen via Resend:", err);
    return "failed";
  }
}
