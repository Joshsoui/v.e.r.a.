import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageBreak,
  BorderStyle,
} from "docx";
import type { PersistedStatement } from "@/lib/reports/types";
import type { ChapterStatusValue } from "@/lib/validators";

const CATEGORY_LABELS: Record<PersistedStatement["category"], string> = {
  FEIT: "feit",
  VERKLARING: "verklaring van betrokkene",
  PROFESSIONELE_DUIDING: "professionele duiding",
};

const STATUS_LABELS: Record<ChapterStatusValue, string> = {
  COMPLEET: "Compleet",
  ONVOLLEDIG: "Onvolledig",
  NIET_GECONTROLEERD: "Nog niet gecontroleerd",
};

export type ExportChapter = {
  title: string;
  statements: PersistedStatement[];
  missingInfo: string[];
  status: ChapterStatusValue;
};

export type GenerateReportDocxInput = {
  documentTypeName: string;
  formatName: string;
  organizationName: string;
  municipality: string | null;
  title: string;
  version: number;
  addChecklist: boolean;
  addConceptFootnote: boolean;
  generatedAt: Date;
  chapters: ExportChapter[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function conceptFootnoteFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Concept – menselijke controle vereist",
            italics: true,
            size: 16,
            color: "888888",
          }),
        ],
      }),
    ],
  });
}

function buildTitlePage(input: GenerateReportDocxInput): Paragraph[] {
  const subtitleParts = [input.organizationName];
  if (input.municipality) subtitleParts.push(input.municipality);

  return [
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "CONCEPT", bold: true, color: "B00020", size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: input.documentTypeName, bold: true, size: 56 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: input.title, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [new TextRun({ text: subtitleParts.join(" — "), size: 24, color: "555555" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({ text: `Format: ${input.formatName}`, size: 20, color: "777777" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: `Versie ${input.version} — gegenereerd op ${DATE_FORMATTER.format(input.generatedAt)}`,
          size: 20,
          color: "777777",
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildChecklistPage(chapters: ExportChapter[]): Paragraph[] {
  const rows: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      text: "Checklist hoofdstukstatus",
    }),
  ];

  for (const chapter of chapters) {
    rows.push(
      new Paragraph({
        spacing: { before: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
        },
        children: [
          new TextRun({ text: `${chapter.title}: `, bold: true }),
          new TextRun({ text: STATUS_LABELS[chapter.status] }),
        ],
      }),
    );
    if (chapter.missingInfo.length > 0) {
      for (const item of chapter.missingInfo) {
        rows.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: item, color: "B00020" })],
          }),
        );
      }
    }
  }

  rows.push(new Paragraph({ children: [new PageBreak()] }));
  return rows;
}

function buildChapterSection(chapter: ExportChapter): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: chapter.title }),
  ];

  if (chapter.statements.length === 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Voor dit hoofdstuk is nog geen inhoud vastgelegd.",
            italics: true,
            color: "888888",
          }),
        ],
      }),
    );
  }

  for (const statement of chapter.statements) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({ text: statement.text })],
      }),
    );
    const refLabel =
      statement.sourceRefs.length > 0 ? statement.sourceRefs.join(", ") : "geen (handmatig toegevoegd)";
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40 },
        children: [
          new TextRun({
            text: `— ${CATEGORY_LABELS[statement.category]}, bron: ${refLabel}${
              statement.sourceVerified ? "" : " (niet geverifieerd)"
            }`,
            italics: true,
            size: 16,
            color: statement.sourceVerified ? "999999" : "B00020",
          }),
        ],
      }),
    );
  }

  if (chapter.missingInfo.length > 0) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200 },
        text: "Ontbrekende informatie",
      }),
    );
    for (const item of chapter.missingInfo) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: item, color: "B00020" })],
        }),
      );
    }
  }

  return paragraphs;
}

export async function generateReportDocx(input: GenerateReportDocxInput): Promise<Buffer> {
  const children: Paragraph[] = [...buildTitlePage(input)];

  if (input.addChecklist) {
    children.push(...buildChecklistPage(input.chapters));
  }

  input.chapters.forEach((chapter, idx) => {
    children.push(...buildChapterSection(chapter));
    if (idx < input.chapters.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: input.addConceptFootnote ? { default: conceptFootnoteFooter() } : undefined,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
