"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiJson } from "@/lib/client/apiFetch";
import { Button, Input, Label, Card, Alert } from "@/components/ui/primitives";

export default function RegisterPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName, municipality, name, email, password }),
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
        <h2 className="mb-4 text-lg font-semibold">Organisatie registreren</h2>
        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="organizationName">Naam organisatie</Label>
            <Input
              id="organizationName"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Bijv. Gemeente Voorbeeldstad, team Jeugd"
            />
          </div>
          <div>
            <Label htmlFor="municipality">Gemeente (optioneel)</Label>
            <Input
              id="municipality"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="Bijv. Voorbeeldstad"
            />
          </div>
          <div>
            <Label htmlFor="name">Jouw naam</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
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
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-500">Minimaal 10 tekens.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Bezig..." : "Registreren"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Al een account?{" "}
          <Link href="/login" className="text-vera-600 hover:underline">
            Inloggen
          </Link>
        </p>
      </Card>
    </main>
  );
}
