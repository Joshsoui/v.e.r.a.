"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Input, Label, Card, Alert } from "@/components/ui/primitives";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("De twee wachtwoorden komen niet overeen.");
      return;
    }
    if (password.length < 10) {
      setError("Wachtwoord moet minimaal 10 tekens bevatten.");
      return;
    }

    setLoading(true);
    try {
      await apiJson("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      router.push("/login?reset=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Alert variant="error">
        Deze pagina mist een geldig resettoken. Vraag een nieuwe resetlink aan via{" "}
        <Link href="/forgot-password" className="underline">
          wachtwoord vergeten
        </Link>
        .
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label htmlFor="passwordConfirm">Herhaal nieuw wachtwoord</Label>
        <Input
          id="passwordConfirm"
          type="password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Bezig..." : "Wachtwoord instellen"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="animate-fade-in-up mb-8 flex justify-center">
        <Image
          src="/logo.png"
          alt="V.E.R.A. — Verslag- en Rapportage Assistent"
          width={900}
          height={303}
          priority
          className="h-14 w-auto"
        />
      </div>
      <Card className="animate-fade-in-up [animation-delay:80ms]">
        <h2 className="mb-4 text-lg font-semibold">Nieuw wachtwoord instellen</h2>
        <Suspense fallback={<p className="text-sm text-gray-500">Laden...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </main>
  );
}
