"use client";

import { useState } from "react";
import { Button, Card, Alert, Badge } from "@/components/ui/primitives";
import { STATUS_LABELS, type ReportDetail } from "@/components/report/types";

export function StepExport({
  report,
  onExport,
}: {
  report: ReportDetail;
  onExport: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomplete = report.chapters.filter((c) => c.status !== "COMPLEET");

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onExport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exporteren mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Export</h2>
        <p className="text-sm text-gray-500">
          Genereer een professioneel Word-document (.docx) van dit conceptverslag, versie {report.version + 1}.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {incomplete.length > 0 && (
        <Alert variant="warning">
          <p className="mb-2">Niet alle hoofdstukken zijn compleet:</p>
          <ul className="list-inside list-disc space-y-1">
            {incomplete.map((c) => (
              <li key={c.id}>
                {c.title} — <Badge variant="warning">{STATUS_LABELS[c.status]}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2">Je kunt alsnog exporteren; het document blijft een concept.</p>
        </Alert>
      )}

      <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
        <p>Checklist in export: {report.addChecklist ? "Ja" : "Nee"}</p>
        <p>Voetnoot &quot;Concept – menselijke controle vereist&quot;: {report.addConceptFootnote ? "Ja" : "Nee"}</p>
        <p className="mt-1 text-gray-400">Dit stel je in bij stap 1 (Instellingen).</p>
      </div>

      <Button disabled={busy} onClick={run}>
        {busy ? "Document wordt gegenereerd..." : "Exporteren als Word-document"}
      </Button>
    </Card>
  );
}
