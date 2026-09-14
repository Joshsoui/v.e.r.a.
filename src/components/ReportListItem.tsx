"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Card, Badge } from "@/components/ui/primitives";

export function ReportListItem({
  reportId,
  title,
  reference,
  documentTypeName,
  formatName,
  statusLabel,
  statusVariant,
}: {
  reportId: string;
  title: string;
  reference: string | null;
  documentTypeName: string;
  formatName: string;
  statusLabel: string;
  statusVariant: "success" | "neutral";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteReport() {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/reports/${reportId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
      setBusy(false);
    }
  }

  return (
    <Card className="transition hover:border-vera-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/reports/${reportId}`} className="block min-w-0 flex-1">
          <div className="truncate font-medium text-gray-800">{reference || title}</div>
          <div className="truncate text-xs text-gray-500">
            {reference && <span className="mr-1">{title} —</span>}
            {documentTypeName} — {formatName}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {confirming ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1">
              <span className="text-xs text-red-700">Definitief verwijderen?</span>
              <Button
                variant="danger"
                disabled={busy}
                onClick={deleteReport}
                className="px-2 py-1 text-xs"
              >
                Ja
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="px-2 py-1 text-xs"
              >
                Annuleren
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Verwijderen
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
