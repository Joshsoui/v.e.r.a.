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
