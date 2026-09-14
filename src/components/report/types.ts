export type StatementCategory = "FEIT" | "VERKLARING" | "PROFESSIONELE_DUIDING";
export type ChapterStatus = "COMPLEET" | "ONVOLLEDIG" | "NIET_GECONTROLEERD";

export type ChapterDefinition = {
  key: string;
  title: string;
  order: number;
  instructions: string;
  requiredElements: string[];
};

export type WritingStyle = { key: string; label: string; description: string };

export type SourceDoc = {
  id: string;
  filename: string;
  sourceType: "TEKST" | "DOCX";
  charCount: number;
  createdAt: string;
};

export type Statement = {
  id: string;
  text: string;
  category: StatementCategory;
  sourceRefs: string[];
  origin: "AI" | "USER";
  sourceVerified: boolean;
};

export type Chapter = {
  id: string;
  key: string;
  title: string;
  order: number;
  statements: Statement[];
  missingInfo: string[];
  status: ChapterStatus;
  editedByUser: boolean;
  issues: string[];
};

export type ReportDetail = {
  id: string;
  title: string;
  status: string;
  currentStep: number;
  version: number;
  writingStyleKey: string | null;
  addChecklist: boolean;
  addConceptFootnote: boolean;
  expiresAt: string;
  contentDeletedAt: string | null;
  formatTemplate: {
    id: string;
    name: string;
    chapters: ChapterDefinition[];
    writingStyles: WritingStyle[];
  };
  sources: SourceDoc[];
  chapters: Chapter[];
};

export const CATEGORY_LABELS: Record<StatementCategory, string> = {
  FEIT: "Feit",
  VERKLARING: "Verklaring van betrokkene",
  PROFESSIONELE_DUIDING: "Professionele duiding",
};

export const STATUS_LABELS: Record<ChapterStatus, string> = {
  COMPLEET: "Compleet",
  ONVOLLEDIG: "Onvolledig",
  NIET_GECONTROLEERD: "Nog niet gecontroleerd",
};
