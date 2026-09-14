"use client";

const CSRF_COOKIE_NAME = "vera_csrf";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

async function ensureCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Wrapper rond fetch() die automatisch de CSRF-header meestuurt voor
 * state-wijzigende requests. Gebruik dit voor alle client-side API-calls.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (!SAFE_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    headers.set("x-csrf-token", token);
  }

  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

export async function apiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Er is een fout opgetreden.";
    throw new Error(message);
  }
  return data as T;
}
