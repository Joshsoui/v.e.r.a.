// Deelt brondocumenten op in genummerde tekstsegmenten (alinea's) die als
// citeerbare eenheid dienen. De AI moet elke bewering onderbouwen met één of
// meer segment-id's (bv. "B2-4" = bron 2, alinea 4). Zo is elke bewering
// letterlijk herleidbaar tot een stuk brontekst — de kern van het
// zero-fabrication-gedrag.

export type SourceSegment = {
  id: string;
  sourceDocumentId: string;
  sourceLabel: string;
  index: number;
  text: string;
};

export type SourceForSegmentation = {
  id: string;
  filename: string;
  extractedText: string;
};

export function segmentSources(sources: SourceForSegmentation[]): SourceSegment[] {
  const segments: SourceSegment[] = [];

  sources.forEach((source, sourceIndex) => {
    const label = `Bron ${sourceIndex + 1} (${source.filename})`;
    const paragraphs = source.extractedText
      .split(/\n{2,}|\r\n\r\n/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Val terug op regel-per-regel als er geen dubbele newlines zijn.
    const units = paragraphs.length > 1 ? paragraphs : source.extractedText.split(/\n/).map((p) => p.trim()).filter(Boolean);

    units.forEach((text, unitIndex) => {
      segments.push({
        id: `B${sourceIndex + 1}-${unitIndex + 1}`,
        sourceDocumentId: source.id,
        sourceLabel: label,
        index: unitIndex + 1,
        text,
      });
    });
  });

  return segments;
}

export function formatSegmentsForPrompt(segments: SourceSegment[]): string {
  return segments
    .map((s) => `[${s.id}] (${s.sourceLabel}, alinea ${s.index})\n${s.text}`)
    .join("\n\n");
}

export type RegulationForSegmentation = { id: string; title: string; content: string };

/**
 * Segmenteert verordeningen op exact dezelfde manier als segmentSources(),
 * maar met een "V"-prefix (V1-3 = verordening 1, alinea 3) in plaats van "B"
 * — zo zijn casusbron-citaten en verordening-citaten aan hun ID altijd
 * meteen te onderscheiden, ook in de UI (SourceTextPanel/SourceRefsEditor).
 */
export function segmentRegulations(regulations: RegulationForSegmentation[]): SourceSegment[] {
  const segments: SourceSegment[] = [];

  regulations.forEach((regulation, regulationIndex) => {
    const label = `Verordening ${regulationIndex + 1} (${regulation.title})`;
    const paragraphs = regulation.content
      .split(/\n{2,}|\r\n\r\n/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const units =
      paragraphs.length > 1 ? paragraphs : regulation.content.split(/\n/).map((p) => p.trim()).filter(Boolean);

    units.forEach((text, unitIndex) => {
      segments.push({
        id: `V${regulationIndex + 1}-${unitIndex + 1}`,
        sourceDocumentId: regulation.id,
        sourceLabel: label,
        index: unitIndex + 1,
        text,
      });
    });
  });

  return segments;
}
