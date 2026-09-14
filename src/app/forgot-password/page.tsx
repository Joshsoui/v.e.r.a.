"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Input, Label, Card, Alert } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiJson("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan.");
    } finally {
      setLoading(false);
    }
  }

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
        <h2 className="mb-4 text-lg font-semibold">Wachtwoord vergeten</h2>
        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        {submitted ? (
          <Alert variant="success">
            Als dit e-mailadres bekend is, is er een link klaargezet om je wachtwoord opnieuw in
            te stellen. Neem contact op met je beheerder als je die niet ontvangt.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">
              Vul je e-mailadres in. Als dat bij ons bekend is, zetten we een link klaar om je
              wachtwoord opnieuw in te stellen.
            </p>
            <div>
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Bezig..." : "Resetlink aanvragen"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/login" className="text-vera-600 hover:underline">
            ← Terug naar inloggen
          </Link>
        </p>
      </Card>
    </main>
  );
}
