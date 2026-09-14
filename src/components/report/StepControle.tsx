"use client";

import { useState } from "react";
import { Button, Card, Alert, Badge, Textarea } from "@/components/ui/primitives";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Chapter,
  type ReportDetail,
  type Statement,
  type StatementCategory,
} from "@/components/report/types";

function statusBadgeVariant(status: Chapter["status"]): "success" | "warning" | "neutral" {
  if (status === "COMPLEET") return "success";
  if (status === "ONVOLLEDIG") return "warning";
  return "neutral";
}

function newStatement(): Statement {
  return {
    id: `tmp-${Math.random().toString(36).slice(2)}`,
    text: "",
    category: "FEIT",
    sourceRefs: [],
    origin: "USER",
    sourceVerified: true,
  };
}

function ChapterEditor({
  chapter,
  onSave,
}: {
  chapter: Chapter;
  onSave: (chapterId: string, statements: Statement[], missingInfo: string[], markReviewed: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(chapter.status !== "COMPLEET");
  const [statements, setStatements] = useState<Statement[]>(chapter.statements);
  const [missingInfo, setMissingInfo] = useState<string[]>(chapter.missingInfo);
  const [newMissingItem, setNewMissingItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStatement(id: string, patch: Partial<Statement>) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStatement(id: string) {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  }

  function addMissingItem() {
    if (newMissingItem.trim().length === 0) return;
    setMissingInfo((prev) => [...prev, newMissingItem.trim()]);
    setNewMissingItem("");
  }

  function removeMissingItem(index: number) {
    setMissingInfo((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(markReviewed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const cleanStatements = statements
        .filter((s) => s.text.trim().length > 0)
        .map((s) => ({ ...s, id: s.id.startsWith("tmp-") ? undefined : s.id }) as Statement);
      await onSave(chapter.id, cleanStatements, missingInfo, markReviewed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
          {chapter.issues.length > 0 && (
            <p className="text-xs text-amber-700">
              {chapter.issues.length} {chapter.issues.length === 1 ? "aandachtspunt" : "aandachtspunten"}
            </p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(chapter.status)}>{STATUS_LABELS[chapter.status]}</Badge>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {error && <Alert variant="error">{error}</Alert>}

          {chapter.issues.length > 0 && (
            <Alert variant="warning">
              <ul className="list-inside list-disc space-y-1">
                {chapter.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="space-y-3">
            {statements.map((s) => (
              <div key={s.id} className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <select
                    value={s.category}
                    onChange={(e) => updateStatement(s.id, { category: e.target.value as StatementCategory })}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Badge variant={s.origin === "AI" ? "neutral" : "success"}>
                    {s.origin === "AI" ? "AI-gegenereerd" : "Handmatig"}
                  </Badge>
                  {s.sourceRefs.length > 0 && (
                    <Badge variant={s.sourceVerified ? "neutral" : "danger"}>
                      bron: {s.sourceRefs.join(", ")}
                      {!s.sourceVerified && " (niet geverifieerd)"}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => removeStatement(s.id)}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Verwijderen
                  </button>
                </div>
                <Textarea
                  rows={2}
                  value={s.text}
                  onChange={(e) => updateStatement(s.id, { text: e.target.value })}
                />
              </div>
            ))}
            <Button variant="secondary" onClick={() => setStatements((prev) => [...prev, newStatement()])}>
              + Bewering toevoegen
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Ontbrekende informatie</h4>
            {missingInfo.length === 0 ? (
              <p className="text-sm text-gray-500">Geen openstaande punten.</p>
            ) : (
              <ul className="mb-2 space-y-1">
                {missingInfo.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-amber-700">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeMissingItem(i)} className="text-xs text-red-600 hover:underline">
                      Verwijderen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMissingItem}
                onChange={(e) => setNewMissingItem(e.target.value)}
                placeholder="Nieuw openstaand punt..."
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <Button variant="secondary" onClick={addMissingItem}>
                Toevoegen
              </Button>
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <Button variant="secondary" disabled={busy} onClick={() => save(false)}>
              Wijzigingen opslaan
            </Button>
            <Button disabled={busy} onClick={() => save(true)}>
              Opslaan en markeren als gecontroleerd
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function StepControle({
  report,
  onSaveChapter,
  onAdvance,
}: {
  report: ReportDetail;
  onSaveChapter: (
    chapterId: string,
    statements: Statement[],
    missingInfo: string[],
    markReviewed: boolean,
  ) => Promise<void>;
  onAdvance: () => Promise<void>;
}) {
  if (report.chapters.length === 0) {
    return (
      <Card>
        <Alert variant="info">Doorloop eerst stap 3 (VERA-analyse) om hoofdstukken te genereren.</Alert>
      </Card>
    );
  }

  const allReviewed = report.chapters.every((c) => c.status !== "NIET_GECONTROLEERD");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Controle en bewerking</h2>
        <p className="text-sm text-gray-500">
          Controleer elk hoofdstuk, pas indien nodig tekst aan en markeer het als gecontroleerd.
        </p>
      </div>

      {report.chapters.map((chapter) => (
        <ChapterEditor key={chapter.id} chapter={chapter} onSave={onSaveChapter} />
      ))}

      {!allReviewed && <Alert variant="warning">Niet alle hoofdstukken zijn al gecontroleerd.</Alert>}

      <Button onClick={onAdvance}>Verder naar export →</Button>
    </div>
  );
}
