# Beveiligingsmaatregelen V.E.R.A. — overzicht voor FG / security officer

Dit document vat de technische beveiligings- en privacymaatregelen van V.E.R.A. **niet-
technisch** samen, voor gebruik bij een DPIA-beoordeling, FG-toetsing of security-audit.
Voor de volledige technische onderbouwing en broncodeverwijzingen, zie `README.md`
hoofdstuk 4 ("Privacy & security").

## Privacy-by-design

| Maatregel | Wat betekent dit in de praktijk? |
|---|---|
| Tijdelijke dossierinhoud | Aantekeningen en verslagteksten worden automatisch en onomkeerbaar verwijderd zodra een rapport verloopt (standaard na 30 dagen); alleen niet-herleidbare metadata blijft over. |
| Geen losse gevoelige velden | Er bestaan geen aparte databasevelden voor BSN, geboortedatum e.d. — dergelijke gegevens kunnen alleen in de tijdelijke, vrije brontekst voorkomen. |
| Automatisch gegenereerde titels | Rapporttitels bevatten nooit door een medewerker getypte (mogelijk herleidbare) tekst. |
| Zelfbediening | Medewerkers kunnen eigen rapporten en accountgegevens zelf en direct verwijderen, zonder tussenkomst van beheer. |

## Toegangsbeveiliging

| Maatregel | Wat betekent dit in de praktijk? |
|---|---|
| Wachtwoorden | Nooit leesbaar opgeslagen (industriestandaard hashing, bcrypt). |
| Sessies | Verlopen automatisch na 12 uur; sessiecookie is niet uitleesbaar door JavaScript en alleen over HTTPS in productie. |
| Organisatie-isolatie | Een medewerker kan uitsluitend rapporten van de eigen organisatie zien of bewerken — technisch afgedwongen op elke bevraging, niet alleen in de gebruikersinterface. |
| Anti-enumeratie | Het systeem laat nooit aan een aanvaller zien of een e-mailadres of rapport-ID wél bestaat maar ontoegankelijk is, versus niet bestaat. |
| Misbruikpreventie | Herhaalde onjuiste inlogpogingen worden automatisch vertraagd/geblokkeerd. |

## Betrouwbaarheid van AI-gegenereerde tekst

| Maatregel | Wat betekent dit in de praktijk? |
|---|---|
| Zero-fabrication-ontwerp | De AI mag uitsluitend herformuleren/structureren wat in de brontekst staat; het mag nooit informatie verzinnen die daar niet in staat. |
| Verplichte menselijke controle | Elk hoofdstuk moet door de medewerker gecontroleerd worden voordat het rapport geëxporteerd kan worden; ontbrekende informatie wordt expliciet gemarkeerd in plaats van stilzwijgend aangevuld. |
| Geen training op cliëntgegevens | De AI-leverancier is geconfigureerd om de verstuurde tekst niet te bewaren of te gebruiken voor het trainen van modellen. |

## Logging en verantwoording

| Maatregel | Wat betekent dit in de praktijk? |
|---|---|
| Audit-logging | Belangrijke acties (bv. rapport aangemaakt/geëxporteerd) worden gelogd met wie, wat en wanneer — nooit met de inhoud van het dossier zelf. |
| IP-adressen | Worden nooit in leesbare vorm opgeslagen, alleen als onomkeerbare hash (voor het detecteren van patronen, niet voor het herleiden van een individu). |
| Foutafhandeling | Technische foutmeldingen (bv. databasefouten) worden nooit aan de gebruiker getoond — alleen server-side gelogd. |

## Beveiligde infrastructuur

| Maatregel | Wat betekent dit in de praktijk? |
|---|---|
| Beveiligde HTTP-headers | Beschermen tegen veelvoorkomende webaanvallen (clickjacking, content-sniffing, etc.). |
| Server-side AI-sleutel | De sleutel voor de AI-leverancier is nooit zichtbaar voor de browser of opgeslagen in de database. |
| Invoerlimieten | Bestandsgrootte, aantal bestanden en tekstlengte zijn begrensd om misbruik en overbelasting te voorkomen. |

## Bekende openstaande punten (zie ook `README.md` §9)

Deze punten zijn **bewust nog niet** onderdeel van de huidige MVP-oplevering en vereisen
een organisatorische of aanvullende technische stap vóór gebruik met echte
cliëntgegevens:

- Verwerkersovereenkomsten met AI-leverancier, database- en hostingpartij.
- Formele DPIA-goedkeuring door de FG.
- Tweefactorauthenticatie (2FA).
- Fijnmaziger rollen-/rechtenmodel binnen een organisatie.
- Onafhankelijke penetratietest.
- Aansluiting van logging op het beveiligingsmonitoringsproces van de organisatie.

Zie `docs/privacy-security/dpia-sjabloon.md` en `docs/privacy-security/vwo-checklist.md`
voor de bijbehorende actiepunten.
