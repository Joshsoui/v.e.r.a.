# Checklist verwerkersovereenkomsten (VWO's) — V.E.R.A.

V.E.R.A. maakt gebruik van externe partijen die (mogelijk) persoonsgegevens verwerken
namens de organisatie die V.E.R.A. inzet. Voor elk van deze partijen is, vóórdat er met
echte cliëntgegevens wordt gewerkt, een verwerkersovereenkomst (VWO) op grond van art. 28
AVG vereist. Deze checklist somt op welke partijen dat zijn, wat ze precies verwerken, en
waar in de configuratie dat terug te vinden is.

| Verwerker | Wat verwerkt deze partij? | Waar in de code/config? | VWO afgesloten? |
|---|---|---|---|
| **AI-leverancier** (standaard: OpenAI, `OPENAI_MODEL`) | Ontvangt de brontekst (aantekeningen/evaluaties) om het conceptverslag te structureren. Uitsluitend server-side aangeroepen, met `store: false` (leverancier bewaart de invoer niet). | `src/lib/ai/openaiProvider.ts`, `src/lib/ai/provider.ts` | [ ] |
| **Database-hosting** (standaard: Supabase) | Slaat alle persistente data op: accounts, rapporten, bronnen, hoofdstukken, audit-logs. | `DATABASE_URL` / `DIRECT_URL` in `.env`, `prisma/schema.prisma` | [ ] |
| **Applicatie-hosting** (Render) | Draait de webservice; heeft in-memory/runtime toegang tot alle verwerkte data en omgevingsvariabelen (incl. geheimen). | `render.yaml` | [ ] |
| **E-mailleverancier** (Resend, optioneel) | Verzendt wachtwoord-resetlinks naar het e-mailadres van de medewerker. Geen dossierinhoud. Alleen actief als `RESEND_API_KEY` is ingesteld — anders wordt de resetlink alleen gelogd. | `src/lib/email/passwordResetEmail.ts`, `RESEND_API_KEY` | [ ] N.v.t. zolang `RESEND_API_KEY` leeg is |

## Aandachtspunten per overeenkomst

Neem in elke VWO in ieder geval het volgende op (of controleer dat de standaard-VWO van de
leverancier dit al dekt):

- **Doelbinding**: gegevens mogen uitsluitend worden gebruikt om de afgesproken dienst te
  leveren, niet voor eigen doeleinden van de verwerker (bv. modeltraining). Controleer
  expliciet of de gekozen AI-leverancier en het gekozen model/abonnement dit garanderen,
  naast de `store: false`-instelling die deze applicatie al afdwingt.
- **Subverwerkers**: welke subverwerkers zet de partij zelf in, en is daar toestemming
  voor nodig?
- **Locatie van verwerking/opslag**: binnen de EER, of is er sprake van doorgifte
  daarbuiten? Zo ja: op basis van welke waarborg (bv. EU Standard Contractual Clauses)?
- **Bewaartermijn bij de verwerker**: hoe lang bewaart de verwerker de data (bv.
  request-logs bij de AI-leverancier), en is dat in lijn met het eigen retentiebeleid
  (`REPORT_RETENTION_DAYS`)?
- **Meldplicht datalekken**: binnen welke termijn meldt de verwerker een datalek aan de
  organisatie? (Nodig om zelf binnen 72 uur bij de AP te kunnen melden.)
- **Audit-/inzagerecht**: heeft de organisatie het recht om de naleving te controleren
  (zelf, of via een certificering zoals ISO 27001/SOC 2 van de verwerker)?
- **Einde van de overeenkomst**: wordt data verwijderd of geretourneerd bij beëindiging?

## Status

- [ ] Alle bovenstaande VWO's zijn afgesloten en gearchiveerd (bv. bij de FG of
      inkoopafdeling).
- [ ] De gekozen regio's voor AI-leverancier, database en hosting zijn gecontroleerd en
      vastgelegd in de DPIA (`docs/privacy-security/dpia-sjabloon.md`, §5).
- [ ] Deze checklist is opnieuw doorlopen bij elke wijziging van leverancier (bv. een
      andere `AIProvider`-implementatie, zie `src/lib/ai/index.ts`).
