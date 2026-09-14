"use client";

import { useState } from "react";
import { Button, Card, Alert } from "@/components/ui/primitives";
import type { ReportDetail } from "@/components/report/types";

export function StepAnalyse({
  report,
  onAnalyze,
}: {
  report: ReportDetail;
  onAnalyze: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onAnalyze();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI-analyse mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const alreadyAnalyzed = report.chapters.length > 0;

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">AI-analyse</h2>
        <p className="text-sm text-gray-500">
          V.E.R.A. structureert de {report.sources.length} aangeleverde bron(nen) tot een conceptverslag
          volgens het format &quot;{report.formatTemplate.name}&quot;. Elke bewering wordt gecategoriseerd
          (feit, verklaring of professionele duiding) en voorzien van een bronverwijzing. Informatie die
          niet in de bronnen staat, wordt gemarkeerd als ontbrekend — nooit aangevuld met aannames.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {alreadyAnalyzed && (
        <Alert variant="info">
          Er is al een analyse uitgevoerd voor dit rapport. Opnieuw analyseren overschrijft de huidige
          hoofdstukinhoud (handmatige bewerkingen gaan verloren).
        </Alert>
      )}

      <Button disabled={busy} onClick={run}>
        {busy ? "Analyse loopt... (dit kan even duren)" : alreadyAnalyzed ? "Opnieuw analyseren" : "Start AI-analyse"}
      </Button>
    </Card>
  );
}
