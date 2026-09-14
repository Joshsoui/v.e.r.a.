import type { WritingStyleOption, ValidatorRuleSet, FormatValidatorRules } from "@/lib/formats/types";

/** Generieke schrijfstijlen, herbruikbaar voor elk format (seed of sjabloon-upload). */
export const defaultWritingStyles: WritingStyleOption[] = [
  {
    key: "zakelijk",
    label: "Zakelijk en formeel",
    description: "Formele, zakelijke schrijfstijl passend bij een officieel gemeentelijk document.",
  },
  {
    key: "toegankelijk",
    label: "Toegankelijk (B1)",
    description: "Eenvoudig en toegankelijk Nederlands (streefniveau B1), goed leesbaar voor cliënten.",
  },
  {
    key: "uitgebreid",
    label: "Uitgebreid onderbouwd",
    description:
      "Uitgebreide, gedetailleerde onderbouwing met nadruk op zorgvuldige weergave van alle nuances uit de bron.",
  },
];

const genericRule: ValidatorRuleSet = {
  minStatements: 1,
  requiredCategories: [],
  requiredKeywords: [],
  forbidMissingInfo: true,
};

/**
 * Generieke validator-regels: minimaal 1 bewering per hoofdstuk, geen
 * verplichte categorie/trefwoorden. Gebruikt voor uit een sjabloon
 * gegenereerde formats, waarvoor we geen domeinkennis hebben om striktere
 * regels op te stellen.
 */
export function buildGenericValidatorRules(chapterKeys: string[]): FormatValidatorRules {
  return Object.fromEntries(chapterKeys.map((key) => [key, genericRule]));
}
