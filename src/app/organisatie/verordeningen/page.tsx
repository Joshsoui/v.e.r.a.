"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Card, Label, Alert, Badge } from "@/components/ui/primitives";

type Regulation = {
  id: string;
  title: string;
  sourceUrl: string | null;
  charCount: number;
  createdAt: string;
};

export default function RegulationsPage() {
  const [role, setRole] = useState<"MEDEWERKER" | "BEHEERDER" | null>(null);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"url" | "text">("url");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, list] = await Promise.all([
      apiJson<{ user: { role: "MEDEWERKER" | "BEHEERDER" } | null }>("/api/auth/me"),
      apiJson<{ regulations: Regulation[] }>("/api/regulations"),
    ]);
    setRole(me.user?.role ?? null);
    setRegulations(list.regulations);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Kon verordeningen niet laden."))
      .finally(() => setLoading(false));
  }, [load]);

  async function onSubmit() {
    if (title.trim().length === 0) {
      setFormError("Geef de verordening een naam.");
      return;
    }
    if (mode === "url" && sourceUrl.trim().length === 0) {
      setFormError("Vul een URL in.");
      return;
    }
    if (mode === "text" && content.trim().length === 0) {
      setFormError("Plak de tekst van de verordening.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiJson("/api/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceUrl: mode === "url" ? sourceUrl.trim() : null,
          content: mode === "text" ? content.trim() : null,
        }),
      });
      setTitle("");
      setSourceUrl("");
      setContent("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Kon verordening niet toevoegen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiJson(`/api/regulations/${id}`, { method: "DELETE" });
      setRegulations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon verordening niet verwijderen.");
    }
  }

  const isBeheerder = role === "BEHEERDER";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-vera-600 hover:underline">
        ← Terug naar overzicht
      </Link>
      <h1 className="mb-1 text-xl font-semibold text-gray-800">Verordeningen</h1>
      <p className="mb-6 text-sm text-gray-500">
        Voeg de relevante gemeentelijke verordening(en) toe. De AI mag hieruit letterlijk citeren als
        ondersteunende juridische onderbouwing bij een professionele duiding — nooit als bron voor
        casusfeiten zelf, en nooit iets anders dan wat hier letterlijk in staat.
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Laden...</p>
      ) : (
        <>
          {isBeheerder && (
            <Card className="mb-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Verordening toevoegen</h2>
              {formError && <Alert variant="error">{formError}</Alert>}
              <div>
                <Label htmlFor="reg-title">Naam</Label>
                <input
                  id="reg-title"
                  type="text"
                  placeholder="Bijv. 'Verordening maatschappelijke ondersteuning en jeugdhulp 2026'"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} />
                  Via URL ophalen
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={mode === "text"} onChange={() => setMode("text")} />
                  Tekst plakken
                </label>
              </div>

              {mode === "url" ? (
                <div>
                  <Label htmlFor="reg-url">URL (bv. een pagina op lokaleregelgeving.overheid.nl)</Label>
                  <input
                    id="reg-url"
                    type="url"
                    placeholder="https://lokaleregelgeving.overheid.nl/..."
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    De tekst wordt eenmalig opgehaald en opgeslagen — latere wijzigingen op de pagina
                    worden niet automatisch bijgewerkt.
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="reg-content">Tekst</Label>
                  <textarea
                    id="reg-content"
                    rows={8}
                    placeholder="Plak hier de (relevante artikelen van de) verordening."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <Button disabled={submitting} onClick={onSubmit}>
                {submitting ? "Bezig..." : "Toevoegen"}
              </Button>
            </Card>
          )}

          <div className="space-y-3">
            {regulations.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-500">
                  Nog geen verordeningen toegevoegd.
                  {!isBeheerder && " Vraag een beheerder van je organisatie om er een toe te voegen."}
                </p>
              </Card>
            ) : (
              regulations.map((r) => (
                <Card key={r.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {r.charCount.toLocaleString("nl-NL")} tekens
                      {r.sourceUrl && (
                        <>
                          {" — "}
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-vera-600 hover:underline"
                          >
                            bron
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">actief</Badge>
                    {isBeheerder && (
                      <Button variant="danger" onClick={() => onDelete(r.id)} className="px-2 py-1 text-xs">
                        Verwijderen
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
