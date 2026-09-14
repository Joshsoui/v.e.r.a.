"use client";

import { useRef, useState } from "react";
import { Button, Card, Label, Textarea, Alert, Badge } from "@/components/ui/primitives";
import type { ReportDetail } from "@/components/report/types";

export function StepBronnen({
  report,
  onUploadFiles,
  onUploadText,
  onDeleteSource,
  onAdvance,
}: {
  report: ReportDetail;
  onUploadFiles: (files: FileList) => Promise<void>;
  onUploadText: (text: string, filename: string) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onAdvance: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [pastedFilename, setPastedFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalChars = report.sources.reduce((sum, s) => sum + s.charCount, 0);

  async function handleFileChange() {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onUploadFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uploaden mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasteSubmit() {
    if (pastedText.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onUploadText(pastedText, pastedFilename || "Geplakte tekst");
      setPastedText("");
      setPastedFilename("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toevoegen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      await onDeleteSource(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Broninformatie</h2>
        <p className="text-sm text-gray-500">
          Upload gespreksnotities/aantekeningen als .docx-bestand, of plak tekst direct hieronder.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="fileUpload">Bestand uploaden (.docx)</Label>
        <input
          id="fileUpload"
          ref={fileInputRef}
          type="file"
          accept=".docx"
          multiple
          disabled={busy}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-vera-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-vera-700 hover:file:bg-vera-100"
        />
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Label htmlFor="pastedFilename">Of plak tekst (bijv. losse aantekeningen)</Label>
        <input
          id="pastedFilename"
          type="text"
          placeholder="Label (optioneel), bijv. 'Gespreksnotitie 14-09'"
          value={pastedFilename}
          onChange={(e) => setPastedFilename(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <Textarea
          rows={6}
          placeholder="Plak hier de aantekeningen of gespreksnotities..."
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
        />
        <Button variant="secondary" disabled={busy || pastedText.trim().length === 0} onClick={handlePasteSubmit}>
          Tekst toevoegen
        </Button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Toegevoegde bronnen</h3>
          <span className="text-xs text-gray-500">{totalChars.toLocaleString("nl-NL")} tekens totaal</span>
        </div>
        {report.sources.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen bronnen toegevoegd.</p>
        ) : (
          <ul className="space-y-2">
            {report.sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-gray-700">{s.filename}</span>{" "}
                  <Badge variant="neutral">{s.sourceType === "DOCX" ? ".docx" : "tekst"}</Badge>{" "}
                  <span className="text-xs text-gray-400">{s.charCount.toLocaleString("nl-NL")} tekens</span>
                </div>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-600"
                >
                  Verwijderen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button disabled={busy || report.sources.length === 0} onClick={onAdvance}>
        Verder naar VERA-analyse →
      </Button>
    </Card>
  );
}
