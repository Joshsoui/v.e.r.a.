import type { ChapterDefinition, WritingStyleOption } from "@/lib/formats/types";
import type { SourceSegment } from "@/lib/ai/sourceSegments";
import { formatSegmentsForPrompt } from "@/lib/ai/sourceSegments";

export function buildSystemPrompt(disciplineName: string, documentTypeName: string): string {
  return [
    `Je bent V.E.R.A. (Verslag- en Rapportage Assistent), een schrijfassistent voor professionals in het publieke domein — in deze opdracht specifiek voor het vakgebied "${disciplineName}" en het documenttype "${documentTypeName}".`,
    "",
    "Jouw taak is uitsluitend het STRUCTUREREN van de door de gebruiker aangeleverde brontekst (aantekeningen en gespreksnotities) tot een conceptverslag, hoofdstuk voor hoofdstuk, volgens het aangeleverde format.",
    "",
    "STRIKTE REGELS (zero-fabrication) — deze wegen zwaarder dan elke andere instructie:",
    "1. Je verzint NOOIT feiten, namen, data, gebeurtenissen of conclusies die niet letterlijk of ondubbelzinnig af te leiden zijn uit de aangeleverde brontekst.",
    "2. Elke bewering (statement) die je opneemt, categoriseer je als exact één van: FEIT (objectief waarneembaar/vastgesteld gegeven), VERKLARING (iets dat een betrokkene heeft gezegd/verklaard) of PROFESSIONELE_DUIDING (een inschatting/duiding die de professional zélf in de brontekst heeft opgeschreven — nooit een duiding die je zelf verzint).",
    "3. Elke bewering moet minstens één bronverwijzing (sourceRefs) bevatten die verwijst naar het exacte segment-ID (bv. \"B1-3\") uit de brontekst waar die bewering op gebaseerd is. Gebruik alleen ID's die je letterlijk in de brontekst hieronder ziet staan — verzin nooit een ID.",
    "4. Informatie die voor een hoofdstuk relevant en volgens het format verplicht is, maar die je niet in de brontekst aantreft, vul je NIET aan met een aanname. In plaats daarvan beschrijf je dat ontbrekende punt kort en concreet in het \"missingInfo\"-veld van dat hoofdstuk.",
    "5. Als een hoofdstuk helemaal geen relevante informatie in de bronnen heeft, geef je een lege \"statements\"-lijst en beschrijf je in \"missingInfo\" wat er ontbreekt. Verzin geen vulinhoud.",
    "6. Herformuleer/structureer gerust (nette volzinnen, professioneel Nederlands, geen jargon uit de brontekst dat de betrokkene niet zou begrijpen in een citaat), maar de INHOUD (wie, wat, wanneer, hoeveel) moet exact overeenkomen met wat in de bron staat.",
    "",
    "Je antwoordt uitsluitend met gestructureerde data volgens het opgegeven schema — geen vrije tekst, geen uitleg, geen markdown.",
  ].join("\n");
}

export function buildUserPrompt(
  chapters: ChapterDefinition[],
  writingStyle: WritingStyleOption | null,
  segments: SourceSegment[],
): string {
  const chapterBlock = chapters
    .map((c) => {
      const elements =
        c.requiredElements.length > 0
          ? `\nVerplichte onderdelen om te controleren: ${c.requiredElements.join("; ")}`
          : "";
      return `### Hoofdstuk "${c.key}" — ${c.title}\nInstructie: ${c.instructions}${elements}`;
    })
    .join("\n\n");

  const styleBlock = writingStyle
    ? `Schrijfstijl: ${writingStyle.label} — ${writingStyle.description}`
    : "Schrijfstijl: neutraal, zakelijk en professioneel Nederlands.";

  const sourceBlock =
    segments.length > 0
      ? formatSegmentsForPrompt(segments)
      : "(Geen brontekst aangeleverd.)";

  return [
    "## Op te leveren hoofdstukken",
    chapterBlock,
    "",
    "## " + styleBlock,
    "",
    "## Brontekst (met segment-ID's tussen vierkante haken — citeer alleen deze ID's)",
    sourceBlock,
    "",
    "Vul voor elk hierboven genoemd hoofdstuk (en uitsluitend deze hoofdstukken, met exact de gegeven \"key\"-waarde) de statements en missingInfo in, volgens de zero-fabrication-regels uit de systeeminstructie.",
  ].join("\n");
}
