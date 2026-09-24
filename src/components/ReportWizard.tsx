"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, apiJson } from "@/lib/client/apiFetch";
import { Alert } from "@/components/ui/primitives";
import { StepIndicator } from "@/components/report/StepIndicator";
import { StepInstellingen } from "@/components/report/StepInstellingen";
import { StepBronnen } from "@/components/report/StepBronnen";
import { StepAnalyse } from "@/components/report/StepAnalyse";
import { StepControle } from "@/components/report/StepControle";
import { StepExport } from "@/components/report/StepExport";
import type { ReportDetail, Statement } from "@/components/report/types";

export function ReportWizard({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Op ReportWizard-niveau (niet in StepBronnen zelf) bijgehouden: StepBronnen
  // wordt volledig unmount/remount bij het wisselen van stap ({activeStep === 2
  // && <StepBronnen .../>}), dus lokale state daar zou een nog niet verwerkte
  // opname stilzwijgend kwijtraken zodra de gebruiker even naar een andere
  // stap navigeert. Hier overleeft het stapwisselingen — pas een volledige
  // paginaherlaad verliest 'm nog (audio wordt bewust nooit ergens
  // opgeslagen, ook niet tijdelijk op de server).
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [downloadedPending, setDownloadedPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ report: ReportDetail }>(`/api/reports/${reportId}`);
      setReport(data.report);
      setActiveStep((prev) => (prev === 1 ? data.report.currentStep : prev));
      return data.report;
    } catch (err) {
      if (err instanceof Error && err.message === "Niet gevonden.") {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : "Kon rapport niet laden.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    // Data ophalen bij het laden van de pagina is een legitiem gebruik van een
    // effect (zie react.dev/learn/you-might-not-need-an-effect#fetching-data);
    // de setState-aanroepen in load() gebeuren async, niet synchroon in de
    // effect-body zelf.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">Laden...</main>;
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alert variant="error">Dit rapport bestaat niet (meer) of je hebt er geen toegang toe.</Alert>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-vera-600 hover:underline">
          ← Terug naar overzicht
        </Link>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error && <Alert variant="error">{error}</Alert>}
      </main>
    );
  }

  const currentStep = report.currentStep;

  async function patchReport(patch: Record<string, unknown>) {
    await apiJson(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function handleSettingsSave(patch: {
    writingStyleKey?: string | null;
    addChecklist?: boolean;
    addConceptFootnote?: boolean;
    reference?: string | null;
    advanceTo?: number;
  }) {
    const { advanceTo, ...rest } = patch;
    await patchReport(advanceTo ? { ...rest, currentStep: advanceTo } : rest);
    if (advanceTo) setActiveStep(advanceTo);
  }

  async function handleUploadFiles(files: FileList) {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    await apiJson(`/api/reports/${reportId}/sources`, { method: "POST", body: formData });
    await load();
  }

  async function uploadAudioFile(file: File) {
    setAudioBusy(true);
    setAudioError(null);
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      await handleUploadFiles(dt.files);
      setPendingAudioFile(null);
      setDownloadedPending(false);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Transcriberen mislukt.");
      setPendingAudioFile(file);
    } finally {
      setAudioBusy(false);
    }
  }

  function retryPendingAudio() {
    if (pendingAudioFile) void uploadAudioFile(pendingAudioFile);
  }

  function downloadPendingAudio() {
    if (!pendingAudioFile) return;
    const url = URL.createObjectURL(pendingAudioFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = pendingAudioFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloadedPending(true);
  }

  function discardPendingAudio() {
    setPendingAudioFile(null);
    setDownloadedPending(false);
    setAudioError(null);
  }

  async function handleUploadText(text: string, filename: string) {
    const formData = new FormData();
    formData.append("text", text);
    formData.append("filename", filename);
    await apiJson(`/api/reports/${reportId}/sources`, { method: "POST", body: formData });
    await load();
  }

  async function handleDeleteSource(sourceId: string) {
    await apiJson(`/api/reports/${reportId}/sources/${sourceId}`, { method: "DELETE" });
    await load();
  }

  async function handleAdvanceFromSources() {
    await patchReport({ currentStep: Math.max(currentStep, 3) });
    setActiveStep(3);
  }

  async function handleAnalyze() {
    await apiJson(`/api/reports/${reportId}/analyze`, { method: "POST" });
    await load();
    setActiveStep(4);
  }

  async function handleSaveChapter(
    chapterId: string,
    statements: Statement[],
    missingInfo: string[],
    markReviewed: boolean,
  ) {
    await apiJson(`/api/reports/${reportId}/chapters/${chapterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statements, missingInfo, markReviewed }),
    });
    await load();
  }

  async function handleAdvanceFromControle() {
    await patchReport({ currentStep: Math.max(currentStep, 5) });
    setActiveStep(5);
  }

  async function handleExport() {
    const res = await apiFetch(`/api/reports/${reportId}/export`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Exporteren mislukt.");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? "verslag.docx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-vera-600 hover:underline">
        ← Terug naar overzicht
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold text-vera-800">
        {report.reference || report.title}
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        {report.reference ? `${report.title} — ${report.formatTemplate.name}` : report.formatTemplate.name}
      </p>

      {pendingAudioFile && activeStep !== 2 && (
        <div className="mb-4">
          <Alert variant="warning">
            Er staat nog een niet-verwerkte gespreksopname klaar (&quot;{pendingAudioFile.name}&quot;) — ga
            naar stap 2 (Broninformatie) om het opnieuw te proberen of te downloaden.
          </Alert>
        </div>
      )}

      <StepIndicator activeStep={activeStep} maxReachedStep={report.currentStep} onSelect={setActiveStep} />

      {activeStep === 1 && <StepInstellingen report={report} onSave={handleSettingsSave} />}
      {activeStep === 2 && (
        <StepBronnen
          report={report}
          onUploadFiles={handleUploadFiles}
          onUploadText={handleUploadText}
          onDeleteSource={handleDeleteSource}
          onAdvance={handleAdvanceFromSources}
          uploadAudioFile={uploadAudioFile}
          pendingAudioFile={pendingAudioFile}
          audioBusy={audioBusy}
          audioError={audioError}
          downloadedPending={downloadedPending}
          onRetryPendingAudio={retryPendingAudio}
          onDownloadPendingAudio={downloadPendingAudio}
          onDiscardPendingAudio={discardPendingAudio}
        />
      )}
      {activeStep === 3 && <StepAnalyse report={report} onAnalyze={handleAnalyze} />}
      {activeStep === 4 && (
        <StepControle report={report} onSaveChapter={handleSaveChapter} onAdvance={handleAdvanceFromControle} />
      )}
      {activeStep === 5 && <StepExport report={report} onExport={handleExport} />}
    </main>
  );
}
