# V.E.R.A. — Verslag- en Rapportage Assistent

> Maak kennis met V.E.R.A., de Verslag- en Rapportage Assistent voor professionals in het
> publieke domein. V.E.R.A. zet aantekeningen en evaluaties om in een gestructureerd
> conceptverslag volgens het juiste format en controleert welke informatie nog ontbreekt.

Deze repository bevat een productieklare **MVP** van V.E.R.A., met als eerste concrete
usecase de **jeugdconsulent bij gemeenten** en het documenttype **Onderzoeksverslag**. De
architectuur is bewust modulair opgezet zodat andere vakgebieden en documenttypen later
toegevoegd kunnen worden via database-configuratie — niet door de applicatie te
herschrijven. Inmiddels zijn ook **Wmo**, **Participatie**, **Schuldhulpverlening** en
**Leerplicht** geseed (zie `prisma/seed.ts`), elk met een eigen standaardformat. Daarnaast
kan elke organisatie zelf een **eigen Word-sjabloon uploaden** (stap 1 van de workflow) —
de koppen in dat sjabloon worden automatisch de hoofdstukstructuur waarin de AI de
aantekeningen structureert (zie hoofdstuk 2 en 3).

---

## Inhoudsopgave

1. [Technisch plan](#1-technisch-plan)
2. [Workflow (5 stappen)](#2-workflow-5-stappen)
3. [Zero-fabrication AI-gedrag](#3-zero-fabrication-ai-gedrag)
4. [Privacy & security](#4-privacy--security)
5. [Belangrijke aannames en keuzes](#5-belangrijke-aannames-en-keuzes)
6. [Lokaal ontwikkelen](#6-lokaal-ontwikkelen)
7. [Testen](#7-testen)
8. [Render deploymenthandleiding](#8-render-deploymenthandleiding)
9. [Pre-productie checklist (echte cliëntgegevens)](#9-pre-productie-checklist-echte-cliëntgegevens)
10. [Samenvatting: status, commando's, env vars](#10-samenvatting-status-commandos-env-vars)

---

## 1. Technisch plan

### Stack

| Onderdeel        | Keuze                                                                 |
|-------------------|------------------------------------------------------------------------|
| Framework         | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4                 |
| Database          | PostgreSQL via Prisma 7, gehost op Supabase                           |
| AI                | OpenAI Responses API, Structured Outputs (strict JSON-schema), server-side only |
| Auth              | Eigen implementatie: bcrypt + JWT-sessiecookie (jose) + CSRF double-submit |
| Word-export       | `docx` (server-side generatie)                                        |
| .docx-inlezen     | `mammoth`                                                              |
| Tests             | Vitest (59 tests) + losse eval-harness voor promptkwaliteit           |
| Deploy             | Render (Node webservice) via `render.yaml`-blueprint                  |

### Architectuur — modulair en data-gedreven

De kern van de modulariteit zit in vier tabellen:

```
Discipline (vakgebied, bv. "jeugd")
  └─ DocumentType (bv. "onderzoeksverslag")
       └─ FormatTemplate (bv. "Standaardformat", of een gemeentevariant)
            ├─ chapters:        hoofdstukstructuur + AI-instructies + verplichte onderdelen
            ├─ writingStyles:   selecteerbare schrijfstijlen
            └─ validatorRules:  deterministische (niet-AI) volledigheidsregels per hoofdstuk
```

Een nieuw vakgebied, documenttype of gemeentevariant toevoegen = een nieuwe rij in
`FormatTemplate` (zie `prisma/seed.ts` voor een volledig voorbeeld). Er hoeft geen
applicatiecode gewijzigd te worden. De configuratie-types staan in
`src/lib/formats/types.ts` (zod-schema's die de JSON-kolommen valideren).

`FormatTemplate.organizationId` maakt onderscheid tussen **gedeelde** formats (`null` —
zichtbaar voor iedereen, zoals de seed-formats) en **organisatie-eigen** formats
(niet-`null` — alleen zichtbaar voor die organisatie). Dat laatste is precies hoe
sjabloon-upload werkt: `POST /api/formats/from-template` (`src/lib/formats/templateExtraction.ts`)
haalt de Word-koppen (Kop 1/Kop 2/Kop 3) uit een geüpload .docx-bestand met `mammoth`,
neemt het hoogste kopniveau als hoofdstukken, en slaat dat op als een nieuwe, org-eigen
`FormatTemplate` — met generieke validator-regels (`buildGenericValidatorRules`, minimaal 1
bewering per hoofdstuk) omdat we voor een willekeurig sjabloon geen domeinkennis hebben.
Het geüploade sjabloon wordt zo letterlijk de structuur waarin de AI de aantekeningen
opmaakt, met dezelfde zero-fabrication-waarborgen als elk ander format (hoofdstuk 3).

### AIProvider-abstractie

Alle AI-aanroepen lopen via de interface `AIProvider` (`src/lib/ai/provider.ts`). De enige
huidige implementatie is `OpenAIProvider` (`src/lib/ai/openaiProvider.ts`). Een andere
LLM-provider toevoegen betekent: een nieuwe klasse die `AIProvider` implementeert en een
aanpassing in de fabrieksfunctie `getAIProvider()` (`src/lib/ai/index.ts`) — de rest van de
applicatie (validators, API-routes, UI) hoeft niet te wijzigen.

### Belangrijkste mapstructuur

```
prisma/schema.prisma        Datamodel
prisma/seed.ts               Seed: 5 vakgebieden (Jeugd, Wmo, Participatie, Schuldhulp, Leerplicht)
prisma.config.ts             Prisma 7 config (migraties via DIRECT_URL)
src/lib/ai/                  AIProvider-interface, OpenAI-implementatie, schema, prompt, segmentatie
src/lib/formats/             Config-types voor FormatTemplate + sjabloon-upload-extractie (templateExtraction.ts)
src/lib/validators/          Deterministische (niet-AI) volledigheidsvalidatie
src/lib/auth/                Wachtwoorden, sessie-JWT, CSRF, guard-helpers
src/lib/security/            Rate limiting, audit-logging
src/lib/upload/               Uploadvalidatie + .docx-tekstextractie
src/lib/docx/                 Word-exportgenerator
src/lib/reports/              Rapport-toegang (IDOR-veilig), titel-/retentielogica
src/app/api/                  Alle Route Handlers (REST-achtige JSON-API)
src/app/(pages)               Auth-pagina's, dashboard, rapport-wizard (5 stappen)
src/components/report/        UI voor de 5 workflow-stappen
tests/                        Vitest-testsuite
fixtures/cases/                20 fictieve jeugd-casussen (testmateriaal)
scripts/eval-harness.ts        Los promptkwaliteit-evaluatiescript (echte API-calls, niet in CI)
scripts/purge-expired.ts       Retentie-purge (privacy-by-design)
scripts/generate-fixtures.ts   Genereerde de 20 fictieve casussen (eenmalig gedraaid)
```

---

## 2. Workflow (5 stappen)

De rapport-wizard (`src/components/ReportWizard.tsx`) implementeert de vijf stappen als
tabs binnen één pagina per rapport (`/reports/[id]`), met een voortgangsindicator die alleen
al bereikte stappen aanklikbaar maakt:

1. **Instellingen** — vakgebied, documenttype, format (gemeente/variant) en schrijfstijl
   kiezen (`/reports/new`), plus checklist-/voetnoot-opties. Zodra een format gekozen is,
   toont de pagina een preview van de hoofdstukstructuur die dat format oplevert. Hier kan
   een organisatie ook **een eigen .docx-sjabloon uploaden**: de Word-koppen (Kop 1/Kop 2)
   in dat sjabloon worden automatisch een nieuw, org-eigen format (zie "Sjabloon-upload" in
   hoofdstuk 3), dat meteen als optie verschijnt bij het gekozen documenttype. Optioneel kan
   hier ook een **eigen referentie** worden ingevuld (bv. "zaak Timo B.") — puur om rapporten
   in het dashboard uit elkaar te houden; dit is, net als de brontekst, tijdelijke inhoud die
   bij de retentie-purge wordt geleegd (zie hoofdstuk 4), nooit de permanente `title`.
2. **Broninformatie** — aantekeningen plakken of `.docx`-bestanden uploaden, met validatie
   op bestandsgrootte, aantal bestanden en totale invoerlengte, en een live tekenteller
   tegen `MAX_TOTAL_INPUT_CHARS` terwijl je typt/plakt.
3. **VERA-analyse** — de AI structureert de bronnen tot een conceptverslag volgens het
   gekozen format (zie hoofdstuk 3).
4. **Controle en bewerking** — elk hoofdstuk heeft een status
   (compleet/onvolledig/nog niet gecontroleerd); deterministische validators tonen
   aandachtspunten; de gebruiker kan tekst bewerken, beweringen toevoegen/verwijderen en
   ontbrekende-informatiepunten beheren. Een inklapbaar paneel toont de volledige brontekst
   (per segment-id) zonder dat je terug hoeft naar stap 2. Bronverwijzingen per bewering zijn
   rechtstreeks bewerkbaar (chips + een selector met alleen geldige segment-id's); een
   ongeldige verwijzing wordt direct zichtbaar gemarkeerd. Een bewerkte AI-bewering kan met
   één klik worden teruggezet naar de oorspronkelijke AI-tekst ("↺ Terug naar AI-versie").
5. **Export** — Word-document met titelpagina, versienummer, optionele checklist en
   optionele voetnoot "Concept – menselijke controle vereist".

---

## 3. Zero-fabrication AI-gedrag

Dit is het meest kritieke onderdeel van V.E.R.A. en op meerdere niveaus afgedwongen:

1. **Promptniveau** (`src/lib/ai/prompt.ts`): expliciete instructie dat de AI nooit feiten
   mag verzinnen en elke bewering moet categoriseren als **feit**, **verklaring** (van
   betrokkene) of **professionele duiding**.
2. **Brontekst-segmentatie** (`src/lib/ai/sourceSegments.ts`): elk brondocument wordt
   opgedeeld in genummerde alinea's (`B1-1`, `B1-2`, `B2-1`, ...). De AI moet elke bewering
   voorzien van één of meer van deze segment-id's als bronverwijzing.
3. **Structureel afgedwongen op schema-niveau** (`src/lib/ai/schema.ts`): het JSON-schema
   dat naar OpenAI Structured Outputs gaat, wordt **per aanroep** gebouwd met:
   - `key` beperkt tot een `enum` van exact de hoofdstukken van het gekozen format —
     de AI kan geen hoofdstukken verzinnen.
   - `sourceRefs` beperkt tot een `enum` van de daadwerkelijk bestaande segment-id's van
     die aanroep — de AI kan **geen niet-bestaande bronverwijzing citeren**; dit wordt
     door OpenAI's strict mode zelf al geweigerd, vóórdat de applicatie er iets mee doet.
   - Elke bewering heeft verplicht minstens één bronverwijzing (`sourceRefs.min(1)`).
4. **Deterministische defense-in-depth** (`src/lib/validators/findUnverifiedSourceRefs`):
   ook al zou een schema-afwijking toch optreden (bv. bij een toekomstige provider die
   enums minder strikt afdwingt), dan wordt elke bronverwijzing na ontvangst nogmaals
   gecontroleerd tegen de echte segmenten. Statements met een niet-geverifieerde
   bronverwijzing worden in de UI en in de export zichtbaar gemarkeerd
   (`sourceVerified: false`, rood in de export).
5. **Ontbrekende info wordt nooit aangevuld**: elk hoofdstuk heeft een `missingInfo`-veld;
   de AI-instructie is expliciet dat ontbrekende, voor het format relevante informatie
   daar beschreven wordt — nooit met een aanname ingevuld.
6. **Schema-synchronisatie gegarandeerd**: het zod-schema en het OpenAI-schema zijn
   **hetzelfde object** — het OpenAI-schema wordt met zods eigen `z.toJSONSchema()`
   rechtstreeks uit het zod-schema gegenereerd (`toStrictJsonSchema()`), niet los
   onderhouden. `tests/schema-sync.test.ts` bevestigt dit expliciet, inclusief een test die
   aantoont dat een schema met `.optional()` (in plaats van `.nullable()`) terecht wordt
   afgewezen, omdat dat OpenEI's "alle properties verplicht"-eis voor strict mode zou
   breken.

---

## 4. Privacy & security

### Privacy-by-design

- **Dossierinhoud is tijdelijk.** `SourceDocument` (brontekst) en de inhoud van
  `ReportChapter` (`statements`, `missingInfo`) worden alleen bewaard zolang het rapport
  niet verlopen is. Elk `Report` heeft een expliciete `expiresAt`
  (`REPORT_RETENTION_DAYS`, standaard 30 dagen na aanmaken).
- **Retentie-purge** (`scripts/purge-expired.ts`, `npm run purge:expired`): verwijdert bij
  verlopen rapporten de brondocumenten volledig en leegt de hoofdstukinhoud. De
  `Report`-rij zelf blijft bestaan met uitsluitend **metadata** (organisatie, status,
  hoofdstuktellers, tijdstempels) — precies zoals gevraagd: "metadata permanent, zonder
  inhoud". Dit script is bewust **geen** aparte Render-achtergrondservice (de opdracht
  vraagt om één webservice, database extern); het is bedoeld om handmatig of via een
  externe scheduler periodiek gedraaid te worden.
- **Rapporttitels bevatten nooit cliëntgegevens.** Titels worden automatisch gegenereerd
  uit documenttype + datum (`generateReportTitle()`), nooit uit vrije, door de gebruiker
  getypte tekst. Zo is ook de permanente metadata nooit herleidbaar tot een individu.
- **Eigen referentie (`Report.reference`) is expliciet tijdelijke inhoud, geen metadata.**
  Dit optionele, vrij in te vullen veld (bv. "zaak Timo B.") bestaat puur om rapporten in
  het dashboard uit elkaar te houden — in tegenstelling tot de titel is het wél vrije,
  door de gebruiker getypte tekst, en kan dus in theorie herleidbare informatie bevatten.
  Daarom wordt het, net als brondocumenten en hoofdstukinhoud, door de retentie-purge
  geleegd (op `null` gezet) zodra een rapport verloopt — het blijft nooit als metadata
  achter.
- **Bewust geen losse gevoelige velden.** Er zijn geen database-kolommen voor BSN,
  geboortedatum, volledig adres, etc. Dergelijke gegevens kunnen alleen voorkomen binnen
  de vrije brontekst — en die brontekst is onderdeel van de tijdelijke, verwijderbare
  inhoud, nooit van de permanente metadata.
- **Zelfbedieningsendpoint**: `DELETE /api/account/data` verwijdert alle eigen rapporten
  (inclusief bronnen en hoofdstukinhoud, via cascade) van de ingelogde gebruiker — nooit
  data van collega's. Ook een los rapport is te verwijderen via `DELETE /api/reports/:id`.
  Beide zijn ook vanuit de UI bereikbaar: het account-menu op het dashboard voor alle
  eigen data, en een "Verwijderen"-knop per rapport in de rapportenlijst voor een los
  rapport.

### Auth & autorisatie

- Registratie/login met bcrypt (12 salt-rounds) en een JWT-sessiecookie (httpOnly, secure
  in productie, SameSite=Lax, 12 uur geldig, ondertekend met `AUTH_SECRET`).
- **CSRF-bescherming**: double-submit-cookiepatroon. Elke state-wijzigende request moet de
  waarde van een niet-httpOnly `vera_csrf`-cookie terugsturen in de `x-csrf-token`-header;
  dit wordt op elke mutatie-route gecontroleerd (`verifyCsrf()` / `requireSession()`).
- **IDOR-preventie**: alle rapport-opvragingen lopen via één centrale functie
  (`getReportOrThrow()`, `src/lib/reports/access.ts`) die altijd op `organizationId`
  filtert. Bestaat het rapport niet, of hoort het bij een andere organisatie? Dan is de
  response in **beide gevallen exact dezelfde generieke 404** — nooit een 403 die zou
  verraden dat het rapport wél bestaat. Dit is getest in `tests/authz-idor.test.ts`,
  inclusief een expliciete test dat een IDOR-poging en een "bestaat niet"-poging identiek
  zijn.
- **Organisatie-isolatie**: elke query voor rapporten/bronnen/hoofdstukken is gescoped op
  `organizationId` uit de sessie, nooit op een door de client meegegeven waarde.
- Veilige, niet-lekkende foutmeldingen: `handleApiError()` logt de volledige fout
  server-side en geeft de client altijd een generieke boodschap — nooit een stacktrace,
  databasefout of ander intern detail (getest in `tests/api-errors.test.ts`).
- **Audit-logging** (`AuditLog`-tabel): actie, entiteitstype/-id, organisatie, gebruiker en
  een SHA-256-hash van het IP (nooit het IP zelf) — **uitdrukkelijk nooit dossierinhoud**.
- Veilige HTTP-headers (`next.config.mjs`): Content-Security-Policy, X-Frame-Options: DENY,
  X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy en (in productie)
  Strict-Transport-Security.

### AI-aanroepen

- Uitsluitend server-side aangeroepen; `OPENAI_API_KEY` komt nooit bij de client of in de
  database.
- Structured Outputs met `strict: true`, `store: false`, geen tools/web search.
- Server-side timeout (`OPENAI_TIMEOUT_MS`) en een maximale invoerlengte
  (`MAX_TOTAL_INPUT_CHARS`) vóór elke AI-aanroep.
- Rate limiting per gebruiker (`RATE_LIMIT_AI_MAX` per `RATE_LIMIT_AI_WINDOW_MS`), plus
  aparte, strengere rate limiting op login/registratie tegen credential-stuffing.

---

## 5. Belangrijke aannames en keuzes

Deze repository was bij aanvang leeg — de MVP is volledig vanaf nul opgebouwd volgens de
opgegeven spec. Onderstaande keuzes/aannames zijn daarbij gemaakt:

1. **Prisma 7-architectuur.** Prisma 7 (de huidige stabiele major-versie) staat
   `url`/`directUrl` niet meer toe in `schema.prisma` — dat moet nu via
   `prisma.config.ts` (voor migraties, met `DIRECT_URL`) en een expliciete driver-adapter
   in de `PrismaClient`-constructor (voor de app, met `DATABASE_URL`, via
   `@prisma/adapter-pg`). Functioneel is dit precies wat gevraagd werd (migraties via de
   directe connectie, de app via de pooled/Supavisor-connectie) — alleen technisch anders
   geconfigureerd omdat Prisma 7 dit vereist. Zie `prisma.config.ts` en
   `src/lib/db/prisma.ts`.
2. **Toolchain-versies iets teruggezet t.o.v. "nieuwste".** `npm install` gaf initieel
   TypeScript 7.0 en ESLint 10.10 (de nieuwste op dat moment) — `typescript-eslint`
   ondersteunt op dit moment alleen TypeScript `<6.0` en ESLint `^8 || ^9`. Voor een
   werkende lint-toolchain zijn TypeScript en ESLint teruggezet naar de nieuwste versies
   die dat wél ondersteunen (**TypeScript 5.9.3**, **ESLint 9.39.5**). Prisma stond met
   `npm install prisma` op `8.0.0-rc.15` (een release candidate onder de `latest`-tag) —
   voor een productieklare MVP is bewust vastgepind op de laatste **stabiele**
   hoofdversie, **Prisma 7.10.0**.
3. **`zod-to-json-schema` niet gebruikt.** Zod 4 heeft een ingebouwde `z.toJSONSchema()`.
   Die rechtstreeks gebruiken (in plaats van een los pakket) garandeert dat het
   OpenAI-schema en het zod-validatieschema per definitie hetzelfde object zijn — geen
   aparte conversielaag die uit sync kan raken.
4. **Eén organisatie per registratie.** Elke registratie maakt een nieuwe `Organization` +
   de eerste gebruiker als `BEHEERDER`. Collega's uitnodigen binnen dezelfde organisatie
   (met een aparte rol/rechten-flow) valt buiten de scope van deze MVP en is een logische
   vervolgstap.
5. **Eén wizard-pagina i.p.v. vijf aparte routes.** De vijf workflowstappen zijn
   geïmplementeerd als tabs binnen `/reports/[id]`, met server-side opgeslagen
   voortgang (`currentStep`) i.p.v. vijf losse pagina-URL's. Functioneel identiek aan de
   gevraagde strikte 5-stappen-flow, met minder routing-overhead.
6. **Hoofdstukstatus "nog niet gecontroleerd" blijft staan tot expliciete actie.** Na
   AI-analyse staat elk hoofdstuk op `NIET_GECONTROLEERD`, ook als de deterministische
   validator het al als compleet zou beoordelen — de opdracht vraagt om menselijke
   controle, dus die stap mag niet impliciet als "gedaan" gelden. De validator-uitkomst
   (`issues`) wordt wel meteen getoond. Zodra de gebruiker een hoofdstuk expliciet als
   gecontroleerd markeert (of opnieuw bewerkt), wordt de status opnieuw berekend.
7. **Rate limiting is in-memory (single-instance).** Voor een MVP op één Render-instance is
   dit voldoende en voorkomt het een externe dependency (Redis e.d.). Bij horizontale
   schaling moet dit vervangen worden door een gedeelde store — zie code-comment in
   `src/lib/security/rateLimit.ts`.
8. **`AUTH_SECRET` behandeld als een even gevoelige secret als de drie genoemde.** De
   opdracht noemt expliciet `DATABASE_URL`, `DIRECT_URL` en `OPENAI_API_KEY` als
   `sync:false`. `AUTH_SECRET` (ondertekent sessiecookies) is minstens zo gevoelig; in
   `render.yaml` staat die daarom op `generateValue: true`, zodat Render 'm automatisch en
   veilig genereert — dus geen extra handmatige stap voor jou nodig.
9. **Geen wachtwoord-reset/e-mailverificatie.** Buiten scope voor de MVP; wordt genoemd in
   de pre-productiechecklist.
10. **`OPENAI_MODEL` default `gpt-4.1-mini`.** Configureerbaar via env var; controleer bij
    deploy of dit model nog beschikbaar is en Structured Outputs ondersteunt via de
    Responses API — het AI-modellenlandschap verandert snel.
11. **Render-regio `frankfurt` en plan `starter`** als redelijke defaults voor een
    Nederlandse gemeentelijke toepassing (EU-dataresidentie); pas aan naar wens in
    `render.yaml` of het Render-dashboard.
12. **Build-time devDependencies staan bewust in `dependencies`.** `NODE_ENV=production`
    (die we zelf als env var instellen) zorgt ervoor dat `npm install` devDependencies
    overslaat. Omdat `next build` zelf tools als TypeScript, Tailwind/PostCSS en de Prisma
    CLI nodig heeft, staan die in `dependencies` — alleen test-only tooling (`vitest`,
    `eslint`, ...) blijft in `devDependencies`. Om te voorkomen dat Next's eigen
    typecheck-stap tijdens de build daardoor over `tests/` struikelt (die `vitest`
    importeren), typecheckt `next build` alleen `src/`/`prisma`/`scripts`
    (`tsconfig.json`), terwijl `npm run typecheck` het hele project incl. tests
    controleert via `tsconfig.test.json`. Dit is lokaal expliciet nagebouwd met een
    productie-only `npm install` vóór het pushen.
13. **Supabase direct connection is IPv6-only.** Render's build-omgeving ondersteunt geen
    uitgaand IPv6, dus de poort-5432 "Direct connection" van Supabase (nodig voor
    `DIRECT_URL`/migraties) is vanaf Render onbereikbaar. Gebruik in plaats daarvan
    Supabase's **Session pooler**-string (zelfde host als de transaction pooler, ook
    IPv4, maar poort 5432 met volledige sessie-/prepared-statement-ondersteuning) voor
    `DIRECT_URL`. Zowel `DATABASE_URL` als `DIRECT_URL` gebruiken bij een Supavisor-pooler
    (transaction én session) de gebruikersnaam `postgres.<project-ref>`, niet alleen
    `postgres` — dat laatste geeft een P1000-authenticatiefout.
14. **CSP met per-request nonce i.p.v. een statische policy.** Next.js' App
    Router injecteert zelf inline `<script>`-tags voor de RSC-hydratatiepayload.
    Een statische `script-src 'self'` (zonder `unsafe-inline` of nonce)
    blokkeert die scripts, waardoor de pagina wél laadt maar nooit hydrateert
    — geen enkele knop reageert dan. Opgelost met `src/middleware.ts` die per
    request een nonce genereert en die in de CSP-header zet; de root layout
    leest `headers()` uit (nodig om Next.js zijn eigen scripts van die nonce
    te laten voorzien). Kost een kleine prestatie-aftrek (alle pagina's zijn
    nu dynamisch i.p.v. statisch prerenderd), maar dat weegt niet op tegen
    een kapotte UI. Lokaal geverifieerd door de gebouwde HTML te inspecteren
    op nonce-consistentie vóór het pushen.
15. **Sjabloon-upload herkent alleen Word-kopstijlen, geen platte opmaak.** De
    hoofdstukextractie uit een geüpload .docx-sjabloon (`headingsToChapterDefinitions`)
    leest de officiële Word-kopstijlen (Kop 1/Kop 2/Kop 3) uit; een sjabloon met alleen
    vetgedrukte tekst zonder kopstijl levert geen hoofdstukken op (met een duidelijke
    foutmelding die daarnaar verwijst). Dit is een bewuste, eenvoudige eerste versie —
    een layout-heuristiek (bv. korte, vetgedrukte regels als fallback) zou vervolgwerk zijn.
    Ook krijgt elk hoofdstuk uit een sjabloon generieke AI-instructies en generieke
    validator-regels (minimaal 1 bewering, geen verplichte categorie) — voor de seed-formats
    is dat domeinspecifiek uitgeschreven, voor een willekeurig geüpload sjabloon kan dat niet.
    Sub-kopjes (een dieper kopniveau dan het hoogste in het document) worden genegeerd,
    niet als apart hoofdstuk behandeld.

---

## 6. Lokaal ontwikkelen

```bash
npm install
cp .env.example .env
# vul .env in: minimaal DATABASE_URL, DIRECT_URL (lokale Postgres of Supabase),
# AUTH_SECRET en (voor de AI-analyse) een echte OPENAI_API_KEY.

npx prisma migrate dev --name init   # eerste keer; maakt/actualiseert het schema
npm run db:seed                       # vult de 5 vakgebieden (Jeugd, Wmo, Participatie, Schuldhulp, Leerplicht)

npm run dev                           # start op http://localhost:3000
```

Lokaal testen zonder Supabase kan prima tegen een lokale Postgres (bv. via Docker of een
lokaal geïnstalleerde `postgres`-server) — vul dan gewoon een lokale connectiestring in
voor zowel `DATABASE_URL` als `DIRECT_URL`.

---

## 7. Testen

```bash
npm run lint         # ESLint
npm run typecheck     # tsc --noEmit
npm run build          # next build (compileert + type-checkt + genereert de routetabel)
npm test               # Vitest — 65 tests
```

De testsuite (`tests/`) dekt:

- **Schema-synchronisatie** (`schema-sync.test.ts`) — zod ↔ OpenAI-schema, inclusief de
  enum-beperking op hoofdstukken én bronverwijzingen.
- **Sjabloon-extractie** (`template-extraction.test.ts`) — Word-koppen uit een (met de
  `docx`-package gegenereerd) testdocument halen, alleen het hoogste kopniveau meenemen,
  unieke hoofdstuk-keys ook bij dubbele titels.
- **Deterministische validators** (`validators.test.ts`) — hoofdstukstatus, detectie van
  niet-bestaande bronverwijzingen, hoofdstuk-key-volledigheid.
- **Uploadvalidatie** (`upload-validation.test.ts`) — bestandsgrootte, type, aantal,
  totale invoerlengte.
- **Word-export** (`docx-export.test.ts`) — genereert een geldig Office Open
  XML/ZIP-package, met en zonder checklist/voetnoot.
- **API-foutafhandeling** (`api-errors.test.ts`) — interne fouten lekken nooit naar de
  client; generieke 404's voor niet-gevonden/IDOR.
- **Rate limiting** (`rate-limit.test.ts`) — venster, reset, aparte sleutels per
  gebruiker/IP.
- **CSRF** (`csrf.test.ts`) en **sessies** (`session.test.ts`, `password.test.ts`).
- **Autorisatie/IDOR en organisatie-scheiding** (`authz-idor.test.ts`) — draait tegen een
  echte (lokale) testdatabase; bevestigt dat cross-organisatie-toegang en een
  niet-bestaand rapport **exact dezelfde** generieke 404 geven, en dat lijst-queries nooit
  data van een andere organisatie lekken.

Voor `authz-idor.test.ts` is een draaiende Postgres nodig voor de connectiestring in
`.env.test` (zelfde schema als productie, `npx prisma migrate deploy` met die
`DIRECT_URL`/`DATABASE_URL`). In deze ontwikkelomgeving is dat een lokale Postgres-instance
op poort 5433; pas `.env.test` aan naar jouw eigen test-database.

### Eval-harness (promptkwaliteit — géén CI, géén onderdeel van `npm test`)

```bash
npm run eval                # alle 20 fictieve casussen, ECHTE OpenAI-calls (kosten geld)
npm run eval -- --limit=3   # alleen de eerste 3, voor snel/goedkoop testen
```

Draait de 20 fictieve casussen in `fixtures/cases/` tegen de echte OpenAI API en rapporteert
per casus: aantal beweringen, verdeling feit/verklaring/professionele duiding, aantal
gesignaleerde ontbrekende-informatiepunten, en — het belangrijkste — het aantal
niet-geverifieerde bronverwijzingen (fabricatie-risico; hoort door de schema-enum op 0 uit
te komen). Resultaten worden ook weggeschreven naar `eval-results/*.json`.

---

## 8. Render deploymenthandleiding

### 8.1 Supabase voorbereiden

1. Maak (of open) je Supabase-project op [supabase.com](https://supabase.com).
2. Ga naar **Project Settings → Database → Connection string**.
3. Kopieer de **"Transaction pooler"**-string (poort **6543**) — dit wordt `DATABASE_URL`.
   Voeg aan het eind `?pgbouncer=true` toe als dat nog niet in de string staat.
   Voorbeeld: `postgresql://postgres.xxxx:WACHTWOORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
4. Kopieer ook de **"Direct connection"**-string (poort **5432**) — dit wordt `DIRECT_URL`.
   Voorbeeld: `postgresql://postgres:WACHTWOORD@db.xxxx.supabase.co:5432/postgres`
5. Zorg dat het wachtwoord in beide strings het echte databasewachtwoord is (niet de
   placeholder `[YOUR-PASSWORD]` uit de Supabase-UI).

### 8.2 Repository naar GitHub

6. Zorg dat deze repository (met alle code) op GitHub staat — dat is al het geval voor deze
   sessie (`Joshsoui/v.e.r.a.`, branch zoals aangegeven in de opdracht).

### 8.3 Render-service aanmaken via Blueprint

7. Log in op [render.com](https://render.com) en ga naar **New → Blueprint**.
8. Selecteer deze GitHub-repository. Render leest automatisch `render.yaml` in en stelt de
   webservice `vera-rapportage-assistent` voor (Node runtime, build- en startcommando,
   health check op `/api/health`).
9. Klik **Apply** om de service aan te maken. Render genereert meteen automatisch een
   waarde voor `AUTH_SECRET` (staat op `generateValue: true`) — daar hoef je niets voor te
   doen.

### 8.4 Secrets invullen

10. Ga naar de nieuwe service → **Environment**.
11. Vul in:
    - `DATABASE_URL` → de pooled Supabase-string uit stap 3.
    - `DIRECT_URL` → de directe Supabase-string uit stap 4.
    - `OPENAI_API_KEY` → jouw OpenAI API-sleutel.
12. Sla op. Render start automatisch een nieuwe deploy (`npm install` →
    `npx prisma migrate deploy` → `npm run build` → `npm run start`).

### 8.5 Controleren

13. Wacht tot de deploy op **"Live"** staat.
14. Open `https://<jouw-service>.onrender.com/api/health` — dit hoort `{"status":"ok"}`
    terug te geven (bevestigt dat de databaseverbinding werkt).
15. Open de root-URL, registreer een organisatie en doorloop de 5-stappen-workflow.

### 8.6 Overige env vars (optioneel aan te passen)

`NODE_ENV`, `AUTH_COOKIE_NAME`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `APP_BASE_URL` en alle
`RATE_LIMIT_*`/`MAX_*`/`REPORT_RETENTION_DAYS`-variabelen staan al met werkende defaults in
`render.yaml`. Wijzig ze in het Render-dashboard (of in `render.yaml` + opnieuw deployen)
als je andere limieten of een ander model wilt.

### 8.7 Retentie-purge periodiek draaien

`npm run purge:expired` (zie hoofdstuk 4) is bewust geen aparte Render-service. Plan 'm
periodiek in — bijvoorbeeld via een [Render Cron Job](https://render.com/docs/cronjobs) in
hetzelfde project (buiten deze blueprint om, zodat de blueprint zelf bij "1 webservice,
geen databases-blok" blijft), of via een externe scheduler die inlogt op de service.

---

## 9. Pre-productie checklist (echte cliëntgegevens)

Deze MVP is functioneel compleet, maar **werk pas met echte cliëntgegevens nadat onderstaande
punten zijn afgevinkt** — dit vraagt organisatorische/juridische stappen die buiten de scope
van een softwareoplevering vallen:

- [ ] **Verwerkersovereenkomst (VWO)** met OpenAI (of de gekozen AI-provider) afgesloten,
      passend bij het verwerken van (bijzondere) persoonsgegevens van jeugdigen.
- [ ] **Verwerkersovereenkomst met Supabase** (of de gekozen hostingpartij voor de
      database) en met Render.
- [ ] **DPIA (Data Protection Impact Assessment)** uitgevoerd — een onderzoeksverslag
      jeugdzorg bevat per definitie bijzondere persoonsgegevens; dit vereist een DPIA onder
      de AVG.
- [ ] **Functionaris Gegevensbescherming (FG)** van de gemeente heeft de toepassing
      beoordeeld en akkoord gegeven.
- [ ] **Bewaartermijn** (`REPORT_RETENTION_DAYS`) afgestemd met de archiefwet/gemeentelijk
      beleid — de huidige default (30 dagen) is een technisch redelijke MVP-waarde, geen
      juridisch onderbouwde bewaartermijn.
- [ ] **Toegangsbeheer**: rollen/rechten binnen een organisatie (nu: iedere geregistreerde
      gebruiker is `BEHEERDER` van zijn eigen, eigen-gemaakte organisatie) uitgebreid met
      een uitnodigingsflow en eventueel fijnmaziger rechtenmodel per team.
- [ ] **Wachtwoordbeleid** aangescherpt (nu: minimaal 10 tekens, geen 2FA,
      geen wachtwoord-reset-flow) — voeg minimaal 2FA en een reset-flow toe vóór
      productiegebruik.
- [ ] **Logging/monitoring** aangesloten op het beveiligingsmonitoring-proces van de
      gemeente (nu: audit-logs alleen in de eigen database, geen externe SIEM-koppeling).
- [ ] **Penetratietest / security-review** door een onafhankelijke partij, aanvullend op de
      geautomatiseerde testsuite in deze repository.
- [ ] **Rate limiting** vervangen door een gedeelde (multi-instance-bestendige) store als
      er meer dan één Render-instance gedraaid gaat worden.
- [ ] **Model-/leverancierskeuze OpenAI** heroverwogen tegen het actuele beleid van de
      organisatie rond AI en (bijzondere) persoonsgegevens (regio van verwerking,
      dataretentiebeleid van de AI-leverancier, etc. — naast de `store:false`-instelling
      die deze applicatie al afdwingt).

---

## 10. Samenvatting: status, commando's, env vars

### Wat werkt

- Volledige 5-stappen-workflow: instellingen → bronnen → VERA-analyse → controle/bewerking →
  Word-export. Inclusief een hoofdstukstructuur-preview bij formatkeuze, een live
  tekenteller tegen de invoerlimiet, een inklapbare brontekst-weergave en bewerkbare
  bronverwijzingen met "terug naar AI-versie" tijdens de controle-stap, en een optioneel
  eigen-referentieveld om rapporten in het dashboard uit elkaar te houden.
- 5 geseede vakgebieden (Jeugd, Wmo, Participatie, Schuldhulpverlening, Leerplicht), elk met
  een eigen standaardformat, plus sjabloon-upload waarmee een organisatie een eigen
  .docx-sjabloon kan uploaden dat automatisch een nieuw, org-eigen format wordt.
- Registratie/login/logout, CSRF-bescherming, IDOR-veilige organisatie-isolatie,
  zelfbedieningsverwijdering van eigen data (ook per los rapport, vanuit het dashboard).
- Zero-fabrication AI-integratie met structureel (schema-niveau) afgedwongen
  brontraceerbaarheid, plus deterministische fallback-controle.
- Deterministische hoofdstukvalidatie, configureerbaar per format.
- Word-export met titelpagina, versienummer, optionele checklist en conceptvoetnoot.
- Retentie-purge-script voor privacy-by-design.
- 65 automatische tests, allemaal groen; losse eval-harness voor promptkwaliteit; 20
  fictieve testcasussen.
- `next build`, `npm run lint`, `npm run typecheck` allemaal foutloos.
- Handmatige end-to-end smoke-test uitgevoerd tegen de gebouwde productie-server
  (`npm run start`): registratie, login, CSRF-afwijzing, rapport aanmaken, bron uploaden,
  AI-analyse (gecontroleerde 502 bij een ongeldige sleutel — geen crash/lek), IDOR-check
  (404), rate limiting op login (429 na de limiet), en de beveiligingsheaders — allemaal
  zoals verwacht.

### Gedraaide commando's (chronologisch, samengevat)

```bash
npm install next react react-dom zod bcryptjs jose openai docx mammoth
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss postcss \
  autoprefixer prisma eslint eslint-config-next vitest tsx @types/bcryptjs \
  @vitest/coverage-v8 --legacy-peer-deps
npm install -D @tailwindcss/postcss --legacy-peer-deps
npm uninstall zod-to-json-schema
npm install prisma@7.10.0 @prisma/client@7.10.0 --legacy-peer-deps
npm install @prisma/adapter-pg pg --legacy-peer-deps
npm install -D @types/pg --legacy-peer-deps
npm install -D typescript@5.9.3 --legacy-peer-deps      # typescript-eslint-compatibiliteit
npm install -D eslint@9.39.5 --legacy-peer-deps          # typescript-eslint-compatibiliteit
npm install -D vite@^7 --legacy-peer-deps                 # vitest 5-peer-dependency

npx prisma migrate dev --name init     # lokale migratie (ook gebruikt voor .env.test-db)
npm run db:seed
node scripts/generate-fixtures.ts (via tsx)     # 20 fictieve casussen

npm run lint
npm run typecheck
npm run build
npm test                                # 59/59 groen

npm run start (op een test-poort) + curl-smoketest van de volledige flow
```

### Environment variables

**Vul je zelf in op Render** (staan op `sync:false` in `render.yaml`):

| Variabele        | Waarde                                                        |
|-------------------|-----------------------------------------------------------------|
| `DATABASE_URL`    | Supabase **pooled** connection string (poort 6543, `?pgbouncer=true`) |
| `DIRECT_URL`      | Supabase **directe** connection string (poort 5432)             |
| `OPENAI_API_KEY`  | Jouw OpenAI API-sleutel                                          |

**Automatisch geregeld, geen actie nodig:**

| Variabele     | Hoe                                             |
|----------------|---------------------------------------------------|
| `AUTH_SECRET`  | `generateValue: true` — Render genereert 'm zelf |

**Al met werkende defaults in `render.yaml`** (pas aan indien gewenst):

`NODE_ENV`, `AUTH_COOKIE_NAME`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `APP_BASE_URL`,
`RATE_LIMIT_AI_MAX`, `RATE_LIMIT_AI_WINDOW_MS`, `RATE_LIMIT_AUTH_MAX`,
`RATE_LIMIT_AUTH_WINDOW_MS`, `MAX_UPLOAD_FILE_SIZE_BYTES`, `MAX_SOURCE_FILES_PER_REPORT`,
`MAX_TOTAL_INPUT_CHARS`, `REPORT_RETENTION_DAYS`.

Zie `.env.example` voor de volledige lijst met toelichting per variabele (voor lokaal
gebruik).
