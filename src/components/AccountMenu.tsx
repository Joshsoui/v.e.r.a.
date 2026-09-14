"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/client/apiFetch";
import { Button } from "@/components/ui/primitives";

export function AccountMenu({ userName, organizationName }: { userName: string; organizationName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await apiJson("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteOwnData() {
    setBusy(true);
    try {
      await apiJson<{ deletedReports: number }>("/api/account/data", { method: "DELETE" });
      setConfirmingDelete(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
      <div className="text-right">
        <div className="font-medium text-gray-800">{userName}</div>
        <div className="text-xs text-gray-500">{organizationName}</div>
      </div>
      {confirmingDelete ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1">
          <span className="text-xs text-red-700">Al je rapporten definitief verwijderen?</span>
          <Button variant="danger" disabled={busy} onClick={deleteOwnData} className="px-2 py-1 text-xs">
            Ja, verwijderen
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(false)} className="px-2 py-1 text-xs">
            Annuleren
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmingDelete(true)} className="whitespace-nowrap text-xs">
          Mijn gegevens verwijderen
        </Button>
      )}
      <Button variant="secondary" disabled={busy} onClick={logout} className="whitespace-nowrap text-xs">
        Uitloggen
      </Button>
    </div>
  );
}
