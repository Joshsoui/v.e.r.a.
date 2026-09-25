# DPIA-sjabloon: V.E.R.A. (Verslag- en Rapportage Assistent)

> Dit sjabloon volgt de structuur die het [DPIA-model van de Autoriteit Persoonsgegevens /
> NOREA](https://www.autoriteitpersoonsgegevens.nl/) gebruikelijk hanteert. De vakjes met
> `[…]` moeten door de organisatie zelf worden ingevuld; de rest is voor-ingevuld op basis
> van hoe V.E.R.A. daadwerkelijk is gebouwd (zie `README.md` hoofdstuk 3-4 voor de
> onderliggende techniek). **Dit vervangt geen formele DPIA-beoordeling door de FG.**

## 1. Beschrijving van de verwerking

**Wat**: V.E.R.A. structureert vrije aantekeningen/evaluaties van een professional
(bijvoorbeeld een jeugdconsulent) tot een conceptverslag volgens een vast format
(hoofdstukstructuur), met behulp van een taalmodel (AI). De professional controleert en
bewerkt het concept vóór export naar Word.

**Waarom nodig**: het documenttype (bv. "Onderzoeksverslag jeugdzorg") bevat per definitie
bijzondere persoonsgegevens (gezondheid, minderjarigen, mogelijk strafrechtelijke/
justitiële gegevens) van cliënten. Verwerking van bijzondere persoonsgegevens op grote
schaal, en de inzet van een geautomatiseerd taalmodel daarbij, vereist onder de AVG
(art. 35) een DPIA.

**Betrokkenen**: cliënten wier gegevens in de brontekst kunnen voorkomen; medewerkers
(accounts) die de applicatie gebruiken.

**Verwerkingsdoel**: ondersteuning bij het opstellen van conceptverslagen; geen
profilering of geautomatiseerde besluitvorming over cliënten (de AI genereert uitsluitend
een concepttekst op basis van wat de medewerker zelf invoert — "zero-fabrication": het
model verzint nooit informatie die niet in de brontekst staat, en markeert ontbrekende
informatie expliciet in plaats van deze aan te vullen).

**Betrokken systemen**: V.E.R.A.-applicatie (Next.js, gehost op [Render]), PostgreSQL-
database (gehost op [Supabase]), AI-leverancier ([OpenAI], Responses API), e-mailleverancier
voor wachtwoordreset ([Resend], optioneel).

## 2. Noodzaak en evenredigheid

- **Dataminimalisatie**: er zijn bewust geen aparte databasekolommen voor gevoelige
  identifiers (BSN, geboortedatum, volledig adres). Dergelijke gegevens kunnen alleen
  voorkomen binnen de vrije brontekst, die tijdelijk is (zie §4).
- **Doelbinding**: de brontekst wordt uitsluitend gebruikt om het conceptverslag te
  genereren; er is geen secundair gebruik (geen training van modellen op de data — de
  AI-aanroep gebruikt `store: false`, dus de leverancier bewaart de invoer niet).
- **Alternatieven overwogen**: [in te vullen — bv. volledig handmatig verslagleggen,
  on-premise taalmodel]. Afweging: [in te vullen].

## 3. Risico's voor betrokkenen

| # | Risico | Waarschijnlijkheid | Impact | Genomen maatregel |
|---|--------|---------------------|--------|--------------------|
| 1 | Onbevoegde toegang tot dossiers van een andere organisatie/gemeente | Laag | Hoog | Organisatie-isolatie op elke databasequery; IDOR-preventie met identieke generieke 404 bij niet-bestaand of niet-eigen rapport (getest, `tests/authz-idor.test.ts`) |
| 2 | Datalek bij de AI-leverancier | Laag–gemiddeld | Hoog | `store: false`, geen tools/websearch, server-side only API-key, verwerkersovereenkomst vereist vóór productiegebruik (zie VWO-checklist) |
| 3 | Te lange bewaring van gevoelige brontekst | Gemiddeld (zonder maatregel) | Gemiddeld–hoog | Automatische retentie-purge (standaard 30 dagen), alleen metadata blijft daarna over |
| 4 | Herleidbare informatie in rapporttitel/permanente metadata | Laag | Gemiddeld | Titels altijd automatisch gegenereerd (documenttype + datum), nooit uit vrije tekst; het vrije "eigen referentie"-veld wordt behandeld als tijdelijke inhoud en dus ook geleegd bij purge |
| 5 | Wachtwoord-brute-force / credential stuffing | Gemiddeld | Gemiddeld | bcrypt (12 rounds), rate limiting op login/registratie, generieke foutmeldingen (geen account-enumeratie) |
| 6 | AI "verzint" informatie die in het verslag als feit terechtkomt | Gemiddeld (zonder maatregel) | Hoog | Zero-fabrication-ontwerp: elke bewering moet herleidbaar zijn tot de brontekst; ontbrekende informatie wordt gemarkeerd i.p.v. aangevuld; medewerker controleert en bewerkt elk hoofdstuk vóór export (stap 4 van de workflow) |
| 7 | Onvoldoende toegangsbeheer binnen een organisatie (iedereen is beheerder) | Gemiddeld | Gemiddeld | Bekend MVP-gat, zie pre-productiechecklist in `README.md` §9 — rollenmodel/uitnodigingsflow nog uit te breiden |
| 8 | Ontbreken van 2FA | Gemiddeld | Gemiddeld | Nog niet geïmplementeerd — zie pre-productiechecklist |
| 9 | [Aanvullend risico specifiek voor eigen organisatie] | [...] | [...] | [...] |

## 4. Bewaartermijnen

| Gegevenscategorie | Bewaartermijn | Onderbouwing |
|---|---|---|
| Dossierinhoud (brontekst, hoofdstukteksten) | `REPORT_RETENTION_DAYS`, default 30 dagen na aanmaken rapport | Technische MVP-default; **moet** worden afgestemd met archiefwet/gemeentelijk beleid — zie actiepunt in §6 |
| Rapportmetadata (vakgebied, status, tijdstempels) | Onbeperkt (bevat geen cliëntgegevens) | Nodig voor verantwoording/statistiek zonder privacyrisico |
| Accountgegevens medewerker | Zolang het account actief is | Noodzakelijk voor toegang tot de dienst |
| Audit-logs | [in te vullen — huidige implementatie kent geen automatische purge van audit-logs] | Beveiligingsmonitoring/verantwoording |
| Wachtwoord-resettoken | 1 uur, of tot gebruikt | Beperkt misbruikvenster |

## 5. Betrokken verwerkers en doorgifte

| Verwerker | Rol | Verwerkersovereenkomst nodig? | Doorgifte buiten EER? |
|---|---|---|---|
| [OpenAI / gekozen AI-leverancier] | Verwerkt brontekst om conceptverslag te genereren | Ja — nog niet afgesloten | [Controleren: regio van verwerking/opslag van de gekozen leverancier] |
| [Supabase] | Hosting PostgreSQL-database | Ja — nog niet afgesloten | [Controleren: welke regio is gekozen bij het aanmaken van het Supabase-project] |
| [Render] | Hosting webservice | Ja — nog niet afgesloten | [Controleren: gekozen regio] |
| [Resend] (optioneel, wachtwoordreset) | Verzenden van resetlink-e-mails | Ja, indien geactiveerd | [Controleren] |

## 6. Actiepunten uit deze DPIA

- [ ] Verwerkersovereenkomsten afsluiten met alle bovenstaande partijen (zie
      `docs/privacy-security/vwo-checklist.md`).
- [ ] Bewaartermijn (`REPORT_RETENTION_DAYS`) formeel vaststellen i.o.m. archiefbeleid.
- [ ] Rollenmodel binnen een organisatie uitbreiden (niet iedereen beheerder).
- [ ] 2FA toevoegen vóór productiegebruik met bijzondere persoonsgegevens.
- [ ] Onafhankelijke penetratietest/security-review laten uitvoeren.
- [ ] Beoordeling en formele goedkeuring door de FG vastleggen (datum, naam, versie van
      deze DPIA).
- [ ] Regio van gegevensverwerking bij AI-leverancier, Supabase en Render bevestigen en
      vastleggen (doorgifte buiten de EER kan aanvullende waarborgen vereisen).

## 7. Beoordeling en akkoord

| Rol | Naam | Datum | Akkoord |
|---|---|---|---|
| Opsteller | [...] | [...] | |
| Functionaris Gegevensbescherming | [...] | [...] | |
| Proceseigenaar / verwerkingsverantwoordelijke | [...] | [...] | |
