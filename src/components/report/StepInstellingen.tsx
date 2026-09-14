"use client";

import { useState } from "react";
import { Button, Card, Label, Alert } from "@/components/ui/primitives";
import type { ReportDetail } from "@/components/report/types";

export function StepInstellingen({
  report,
  onSave,
}: {
  report: ReportDetail;
  onSave: (patch: {
    writingStyleKey?: string | null;
    addChecklist?: boolean;
    addConceptFootnote?: boolean;
    advanceTo?: number;
  }) => Promise<void>;
}) {
  const [writingStyleKey, setWritingStyleKey] = useState(report.writingStyleKey ?? "");
  const [addChecklist, setAddChecklist] = useState(report.addChecklist);
  const [addConceptFootnote, setAddConceptFootnote] = useState(report.addConceptFootnote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(advance: boolean) {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        writingStyleKey: writingStyleKey || null,
        addChecklist,
        addConceptFootnote,
        advanceTo: advance ? Math.max(report.currentStep, 2) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Instellingen</h2>
        <p className="text-sm text-gray-500">
          Format: <span className="font-medium">{report.formatTemplate.name}</span>
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {report.formatTemplate.writingStyles.length > 0 && (
        <div>
          <Label htmlFor="writingStyle">Schrijfstijl</Label>
          <select
            id="writingStyle"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={writingStyleKey}
            onChange={(e) => setWritingStyleKey(e.target.value)}
          >
            {report.formatTemplate.writingStyles.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={addChecklist} onChange={(e) => setAddChecklist(e.target.checked)} />
          Checklist met hoofdstukstatus toevoegen aan export
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={addConceptFootnote}
            onChange={(e) => setAddConceptFootnote(e.target.checked)}
          />
          Voetnoot &quot;Concept – menselijke controle vereist&quot; toevoegen
        </label>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" disabled={saving} onClick={() => save(false)}>
          Opslaan
        </Button>
        <Button disabled={saving} onClick={() => save(true)}>
          Opslaan en verder naar broninformatie →
        </Button>
      </div>
    </Card>
  );
}
