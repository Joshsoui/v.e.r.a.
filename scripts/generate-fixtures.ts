// Genereert 20 volledig fictieve jeugd-casussen (aantekeningen/gespreksnotities)
// als statische testfixtures in fixtures/cases/. Eenmalig gedraaid; het
// resultaat wordt gecommit en dient als testmateriaal voor de eval-harness
// (scripts/eval-harness.ts) en voor handmatig testen van de workflow.
//
// BELANGRIJK: alle namen, adressen, scholen en gebeurtenissen hieronder zijn
// verzonnen. Elke gelijkenis met bestaande personen berust op toeval.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const FIRST_NAMES_CHILD = [
  "Sem", "Noa", "Luca", "Fenna", "Daan", "Yara", "Milan", "Zoë", "Bram", "Evi",
  "Thijs", "Lieke", "Finn", "Merel", "Jesse", "Anne", "Ravi", "Sara", "Owen", "Roos",
];
const FIRST_NAMES_PARENT = [
  "Linda", "Mark", "Esther", "Ahmed", "Karin", "Peter", "Fatima", "Rob", "Sandra", "Erik",
];
const PLACES = [
  "Rivierenwijk", "Zuiderpark", "Oosterveld", "Nieuwland", "Bosrand", "Centrum-Noord",
  "Westerkwartier", "De Akkers", "Molenbuurt", "Kloosterveen",
];
const SCHOOLS = [
  "basisschool De Wingerd", "basisschool Het Kompas", "SBO De Brug",
  "basisschool Op Dreef", "basisschool De Vuurvogel",
];
const REASONS = [
  {
    key: "verzuim",
    aanleiding:
      "de school heeft een zorgmelding gedaan vanwege oplopend schoolverzuim van de afgelopen twee maanden",
    signalen: "regelmatig te laat, meerdere hele dagen afwezig zonder geldige reden",
  },
  {
    key: "gedrag",
    aanleiding:
      "leerkrachten geven aan dat het kind op school steeds vaker boos wordt en moeite heeft met grenzen",
    signalen: "driftbuien in de klas, moeite met samen spelen, teruggetrokken gedrag op het plein",
  },
  {
    key: "thuissituatie",
    aanleiding:
      "er is een melding binnengekomen over spanningen thuis na een echtscheiding van de ouders",
    signalen: "kind maakt onrustige indruk, wisselt vaak van stemming, spreekt weinig over thuis",
  },
  {
    key: "ontwikkeling",
    aanleiding:
      "het consultatiebureau signaleert een achterstand in de taalontwikkeling en vraagt om nader onderzoek",
    signalen: "beperkte woordenschat voor de leeftijd, moeite met volgen van instructies",
  },
];
const NETWORK_COMPLETE = [
  "Er is contact geweest met beide ouders, de mentor van school en de huisarts.",
  "Grootouders van moederskant zijn betrokken bij de opvang na school.",
];

function pick<T>(arr: T[], seed: number): T {
  const item = arr[seed % arr.length];
  if (item === undefined) throw new Error("pick: lege array");
  return item;
}

function buildCase(index: number) {
  const seed = index;
  const child = pick(FIRST_NAMES_CHILD, seed);
  const parent1 = pick(FIRST_NAMES_PARENT, seed + 3);
  const parent2 = pick(FIRST_NAMES_PARENT, seed + 7);
  const place = pick(PLACES, seed + 1);
  const school = pick(SCHOOLS, seed + 2);
  const reason = pick(REASONS, seed);
  const age = 6 + (seed % 10);
  const hasCompleteNetwork = seed % 3 !== 0; // ~1/3 van de casussen mist bewust info
  const hasProfessionalDuiding = seed % 2 === 0;

  const paragraphs: string[] = [];

  paragraphs.push(
    `Aanleiding voor dit onderzoek: ${reason.aanleiding}. Het gaat om ${child}, ${age} jaar, woonachtig in ${place}. ${child} zit op ${school}.`,
  );

  paragraphs.push(
    `Gesprek met ouder ${parent1} op ${new Date(2026, seed % 12, 3 + (seed % 20)).toLocaleDateString("nl-NL")}: ${parent1} vertelt dat het gezin de afgelopen periode extra druk heeft ervaren. ${parent1} zegt: "We proberen er zoveel mogelijk voor ${child} te zijn, maar het is thuis niet altijd rustig." ${parent1} geeft aan open te staan voor ondersteuning.`,
  );

  paragraphs.push(
    `Signalen op school (informatie van leerkracht, telefonisch doorgegeven): ${reason.signalen}. De leerkracht geeft aan dit al enkele weken te observeren en heeft dit eerder besproken met ${parent1}.`,
  );

  if (hasCompleteNetwork) {
    paragraphs.push(`Netwerk en overige betrokkenen: ${pick(NETWORK_COMPLETE, seed)}`);
  } else {
    paragraphs.push(
      `Netwerk en overige betrokkenen: contact met de tweede ouder, ${parent2}, is nog niet gelukt; ${parent2} heeft tot nu toe niet gereageerd op telefonische en schriftelijke uitnodigingen.`,
    );
  }

  if (hasProfessionalDuiding) {
    paragraphs.push(
      `Professionele inschatting jeugdconsulent: op basis van de gesprekken en signalen lijkt er sprake van verhoogde spanning in het gezinssysteem die doorwerkt in het functioneren van ${child}. Nader onderzoek naar de gezinssituatie is aangewezen voordat een vervolgadvies gegeven kan worden.`,
    );
  }

  paragraphs.push(
    `Gesprek met ${child} zelf (kindgesprek, leeftijdsadequaat gevoerd): ${child} vertelt dat ${
      seed % 2 === 0 ? "het thuis weleens spannend is" : "het op school niet altijd fijn voelt"
    }. ${child} geeft aan het leuk te vinden om te voetballen en tijd door te brengen met een vriendje/vriendinnetje uit de klas.`,
  );

  if (seed % 4 === 0 && hasCompleteNetwork) {
    paragraphs.push(
      `Aanvullende notitie: informatie over de rol van school in de sociale ontwikkeling van ${child} buiten de gesignaleerde problematiek is nog niet volledig in beeld; dit moet nog worden nagevraagd bij de mentor.`,
    );
  }

  return {
    id: `case-${String(index + 1).padStart(2, "0")}`,
    title: `Fictieve casus ${index + 1} — ${child} (${age} jr.), ${reason.key}`,
    disciplineCode: "jeugd",
    documentTypeCode: "onderzoeksverslag",
    sourceText: paragraphs.join("\n\n"),
  };
}

function main() {
  const outDir = path.join(process.cwd(), "fixtures", "cases");
  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < 20; i++) {
    const testCase = buildCase(i);
    const filePath = path.join(outDir, `${testCase.id}.json`);
    writeFileSync(filePath, JSON.stringify(testCase, null, 2) + "\n", "utf-8");
    console.log(`Geschreven: ${filePath}`);
  }
}

main();
