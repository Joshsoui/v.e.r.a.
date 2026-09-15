# Privacyverklaring V.E.R.A. (sjabloon)

> **Let op — dit is een sjabloon, geen juridisch document.** De tekst is gebaseerd op hoe
> V.E.R.A. technisch met gegevens omgaat (zie `README.md`, hoofdstuk 4 en de map
> `docs/privacy-security/`), maar moet vóór publicatie worden gecontroleerd en aangevuld
> door de Functionaris Gegevensbescherming (FG) van de organisatie die V.E.R.A. gebruikt.
> Vervang alle tekst tussen `[haakjes]`.

## Privacyverklaring [naam organisatie/gemeente] — V.E.R.A.

Laatst bijgewerkt: [datum]

### 1. Wie is verantwoordelijk?

[Naam organisatie], gevestigd te [plaats], is verwerkingsverantwoordelijke voor de
persoonsgegevens die worden verwerkt bij het gebruik van V.E.R.A. (Verslag- en
Rapportage Assistent). Vragen over deze verklaring kunnen worden gesteld aan de
Functionaris Gegevensbescherming: [naam/contactgegevens FG].

### 2. Wat is V.E.R.A. en welke gegevens verwerkt het?

V.E.R.A. helpt professionals (bijvoorbeeld jeugdconsulenten) om aantekeningen en
evaluaties om te zetten in een gestructureerd conceptverslag. Daarbij worden de volgende
categorieën gegevens verwerkt:

- **Accountgegevens van medewerkers**: naam, e-mailadres, gehasht wachtwoord.
- **Dossierinhoud (tijdelijk)**: de brontekst/aantekeningen die een medewerker invoert of
  als `.docx`-bestand uploadt, en de daaruit gegenereerde hoofdstukteksten. Dit kan
  bijzondere persoonsgegevens van cliënten bevatten (bijvoorbeeld gezondheid, minderjarigen,
  sociale/justitiële gegevens), afhankelijk van wat de medewerker invoert.
- **Rapportmetadata (permanent)**: vakgebied, documenttype, status, hoofdstuktellers en
  tijdstempels. Deze metadata bevat **nooit** cliëntgegevens — rapporttitels worden
  automatisch gegenereerd uit documenttype en datum, nooit uit vrije tekst.
- **Technische/beveiligingsgegevens**: audit-logs (actie, tijdstip, gebruiker, een
  eenrichtings-hash van het IP-adres — nooit het IP zelf, nooit dossierinhoud).

### 3. Waarvoor gebruiken we deze gegevens?

Uitsluitend om medewerkers te ondersteunen bij het opstellen van conceptverslagen binnen
hun functie, en om de dienst veilig en betrouwbaar te laten werken (authenticatie,
misbruikpreventie, audit-logging). Gegevens worden niet gebruikt voor profilering,
geautomatiseerde besluitvorming over cliënten, of enig ander doel.

### 4. Wie heeft toegang / met wie delen we gegevens?

- **Medewerkers** zien uitsluitend rapporten van hun eigen organisatie
  (organisatie-isolatie, technisch afgedwongen op elke databasebevraging).
- **AI-verwerking**: de brontekst wordt voor het genereren van het conceptverslag
  verstuurd naar [naam AI-leverancier, bv. OpenAI], uitsluitend server-side, met
  `store: false` (de leverancier bewaart de invoer niet voor eigen doeleinden) en zonder
  gebruik van externe tools/websearch door het model. Zie de verwerkersovereenkomst met
  deze leverancier (bijlage bij deze verklaring / `docs/privacy-security/vwo-checklist.md`).
- **Hostingpartijen**: de database wordt gehost bij [Supabase] en de applicatie draait bij
  [Render]. Met beide partijen is een verwerkersovereenkomst vereist.
- Gegevens worden niet verkocht of gedeeld met derden voor commerciële doeleinden.

### 5. Hoe lang bewaren we gegevens?

- Dossierinhoud (brondocumenten en hoofdstukteksten) wordt bewaard tot een rapport
  verloopt: standaard [`REPORT_RETENTION_DAYS`, default 30] dagen na aanmaken. Daarna wordt
  de inhoud automatisch en onomkeerbaar verwijderd door een geautomatiseerd
  opschoonproces; alleen de metadata (zie hierboven) blijft bestaan.
- Deze bewaartermijn is een technische default uit de MVP-oplevering en moet nog worden
  afgestemd met het archiveringsbeleid van de organisatie (zie DPIA-sjabloon).
- Wachtwoord-resettokens zijn maximaal 1 uur geldig en worden nooit in leesbare vorm
  opgeslagen.

### 6. Hoe beveiligen we de gegevens?

Zie het beveiligingsoverzicht (`docs/privacy-security/beveiligingsmaatregelen-overzicht.md`)
voor een niet-technische samenvatting, en `README.md` hoofdstuk 4 voor het volledige
technische overzicht (versleuteling van wachtwoorden, CSRF-bescherming, toegangscontrole
per organisatie, audit-logging, beveiligde HTTP-headers, etc.).

### 7. Wat zijn de rechten van betrokkenen?

Cliënten van wie gegevens (mogelijk) in een conceptverslag voorkomen, hebben op grond van
de AVG recht op inzage, correctie, verwijdering, beperking en bezwaar. Verzoeken hierover
verlopen via de reguliere klachten-/verzoekprocedure van [naam organisatie], niet
rechtstreeks via V.E.R.A. — het systeem heeft geen apart cliëntportaal.

Medewerkers kunnen hun eigen accountgegevens en rapporten te allen tijde zelf verwijderen
via het account-menu in de applicatie (`DELETE /api/account/data` voor alle eigen
rapporten, of per rapport).

### 8. Klachten

Een betrokkene die een klacht heeft over de verwerking van zijn/haar gegevens, kan zich
wenden tot de FG van [naam organisatie] en heeft daarnaast het recht een klacht in te
dienen bij de Autoriteit Persoonsgegevens.

---

*Dit sjabloon dekt geen juridisch advies. Laat deze verklaring beoordelen door de FG en/of
juridische afdeling voordat deze wordt gepubliceerd.*
