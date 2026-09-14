"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Card, Label, Alert } from "@/components/ui/primitives";

type WritingStyle = { key: string; label: string; description: string };
type FormatTemplate = {
  id: string;
  name: string;
  municipality: string | null;
  isDefault: boolean;
  writingStyles: WritingStyle[];
};
type DocumentType = { id: string; code: string; name: string; formatTemplates: FormatTemplate[] };
type Discipline = { id: string; code: string; name: string; documentTypes: DocumentType[] };

export default function NewReportPage() {
  const router = useRouter();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [disciplineId, setDisciplineId] = useState<string>("");
  const [documentTypeId, setDocumentTypeId] = useState<string>("");
  const [formatTemplateId, setFormatTemplateId] = useState<string>("");
  const [writingStyleKey, setWritingStyleKey] = useState<string>("");
  const [addChecklist, setAddChecklist] = useState(true);
  const [addConceptFootnote, setAddConceptFootnote] = useState(true);

  useEffect(() => {
    apiJson<{ disciplines: Discipline[] }>("/api/formats")
      .then((data) => {
        setDisciplines(data.disciplines);
        const firstDiscipline = data.disciplines[0];
        if (firstDiscipline) {
          setDisciplineId(firstDiscipline.id);
          const firstDocType = firstDiscipline.documentTypes[0];
          if (firstDocType) {
            setDocumentTypeId(firstDocType.id);
            const firstFormat = firstDocType.formatTemplates[0];
            if (firstFormat) {
              setFormatTemplateId(firstFormat.id);
              setWritingStyleKey(firstFormat.writingStyles[0]?.key ?? "");
            }
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Kon formats niet laden."))
      .finally(() => setLoading(false));
  }, []);

  const discipline = disciplines.find((d) => d.id === disciplineId);
  const documentTypes = discipline?.documentTypes ?? [];
  const documentType = documentTypes.find((d) => d.id === documentTypeId);
  const formatTemplates = documentType?.formatTemplates ?? [];
  const formatTemplate = formatTemplates.find((f) => f.id === formatTemplateId);
  const writingStyles = formatTemplate?.writingStyles ?? [];

  async function onSubmit() {
    if (!formatTemplateId) {
      setError("Kies eerst een vakgebied, documenttype en format.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { report } = await apiJson<{ report: { id: string } }>("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatTemplateId,
          writingStyleKey: writingStyleKey || null,
          addChecklist,
          addConceptFootnote,
        }),
      });
      router.push(`/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon rapport niet aanmaken.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-vera-600 hover:underline">
        ← Terug naar overzicht
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold text-vera-800">Nieuw rapport — Instellingen</h1>
      <p className="mb-6 text-sm text-gray-500">Stap 1 van 5: kies vakgebied, documenttype, format en schrijfstijl.</p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Formats laden...</p>
      ) : disciplines.length === 0 ? (
        <Alert variant="warning">Er zijn nog geen formats geconfigureerd. Neem contact op met een beheerder.</Alert>
      ) : (
        <Card className="space-y-5">
          <div>
            <Label htmlFor="discipline">Vakgebied</Label>
            <select
              id="discipline"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={disciplineId}
              onChange={(e) => {
                const d = disciplines.find((x) => x.id === e.target.value);
                setDisciplineId(e.target.value);
                const firstDocType = d?.documentTypes[0];
                setDocumentTypeId(firstDocType?.id ?? "");
                const firstFormat = firstDocType?.formatTemplates[0];
                setFormatTemplateId(firstFormat?.id ?? "");
                setWritingStyleKey(firstFormat?.writingStyles[0]?.key ?? "");
              }}
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="documentType">Documenttype</Label>
            <select
              id="documentType"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={documentTypeId}
              onChange={(e) => {
                const dt = documentTypes.find((x) => x.id === e.target.value);
                setDocumentTypeId(e.target.value);
                const firstFormat = dt?.formatTemplates[0];
                setFormatTemplateId(firstFormat?.id ?? "");
                setWritingStyleKey(firstFormat?.writingStyles[0]?.key ?? "");
              }}
            >
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="format">Format (gemeente/variant)</Label>
            <select
              id="format"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={formatTemplateId}
              onChange={(e) => {
                const f = formatTemplates.find((x) => x.id === e.target.value);
                setFormatTemplateId(e.target.value);
                setWritingStyleKey(f?.writingStyles[0]?.key ?? "");
              }}
            >
              {formatTemplates.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.municipality ? ` (${f.municipality})` : ""}
                </option>
              ))}
            </select>
          </div>

          {writingStyles.length > 0 && (
            <div>
              <Label htmlFor="writingStyle">Schrijfstijl</Label>
              <select
                id="writingStyle"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={writingStyleKey}
                onChange={(e) => setWritingStyleKey(e.target.value)}
              >
                {writingStyles.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {writingStyles.find((w) => w.key === writingStyleKey)?.description}
              </p>
            </div>
          )}

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={addChecklist}
                onChange={(e) => setAddChecklist(e.target.checked)}
              />
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

          <Button onClick={onSubmit} disabled={submitting} className="w-full">
            {submitting ? "Bezig..." : "Rapport aanmaken en verder"}
          </Button>
        </Card>
      )}
    </main>
  );
}
