"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Input, Label, Card, Alert } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
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
        <h2 className="mb-4 text-lg font-semibold">Inloggen</h2>
        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
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
          <div>
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Bezig..." : "Inloggen"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Nog geen account?{" "}
          <Link href="/register" className="text-vera-600 hover:underline">
            Registreer je organisatie
          </Link>
        </p>
      </Card>
    </main>
  );
}
