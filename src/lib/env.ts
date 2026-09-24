// Centrale, getypeerde toegang tot omgevingsvariabelen met veilige defaults.
// Fail-fast op ontbrekende verplichte secrets zodra ze daadwerkelijk nodig
// zijn (niet bij module-load, zodat `next build` zonder secrets kan draaien).
//
// Alles hieronder is een getter (leest process.env bij elke aanroep, niet
// eenmalig bij module-load) — dat maakt de app robuust tegen laat-geladen
// .env-bestanden én maakt env-afhankelijke code goed testbaar (tests kunnen
// process.env per test aanpassen).

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Omgevingsvariabele ${name} is verplicht maar ontbreekt.`);
  }
  return value;
}

function intOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get authCookieName() {
    return optional("AUTH_COOKIE_NAME", "vera_session");
  },
  csrfCookieName: "vera_csrf",
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get openaiModel() {
    return optional("OPENAI_MODEL", "gpt-4.1-mini");
  },
  get openaiTimeoutMs() {
    return intOr("OPENAI_TIMEOUT_MS", 45_000);
  },
  /// Transcriptiemodel is bewust configureerbaar los van OPENAI_MODEL: een
  /// audio-naar-tekst-model (bv. gpt-4o-transcribe/whisper-1) is een ander
  /// soort model dan het tekstmodel voor de VERA-analyse.
  get openaiTranscribeModel() {
    return optional("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe");
  },
  get appBaseUrl() {
    return (
      process.env.APP_BASE_URL ||
      (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : "http://localhost:3000")
    );
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get rateLimitAiMax() {
    return intOr("RATE_LIMIT_AI_MAX", 10);
  },
  get rateLimitAiWindowMs() {
    return intOr("RATE_LIMIT_AI_WINDOW_MS", 3_600_000);
  },
  get rateLimitAuthMax() {
    return intOr("RATE_LIMIT_AUTH_MAX", 10);
  },
  get rateLimitAuthWindowMs() {
    return intOr("RATE_LIMIT_AUTH_WINDOW_MS", 900_000);
  },
  get maxUploadFileSizeBytes() {
    return intOr("MAX_UPLOAD_FILE_SIZE_BYTES", 5_000_000);
  },
  /// Losse, ruimere limiet voor audio-uploads/-opnames: audiobestanden zijn
  /// van nature veel groter dan tekst/.docx, en OpenAI's transcriptie-API
  /// accepteert zelf ook maximaal 25 MB per bestand.
  get maxAudioFileSizeBytes() {
    return intOr("MAX_AUDIO_FILE_SIZE_BYTES", 25_000_000);
  },
  get maxSourceFilesPerReport() {
    return intOr("MAX_SOURCE_FILES_PER_REPORT", 10);
  },
  get maxTotalInputChars() {
    return intOr("MAX_TOTAL_INPUT_CHARS", 60_000);
  },
  get rateLimitTranscribeMax() {
    return intOr("RATE_LIMIT_TRANSCRIBE_MAX", 15);
  },
  get rateLimitTranscribeWindowMs() {
    return intOr("RATE_LIMIT_TRANSCRIBE_WINDOW_MS", 3_600_000);
  },
  get reportRetentionDays() {
    return intOr("REPORT_RETENTION_DAYS", 30);
  },
  /// Leeg = geen e-mailprovider gekoppeld (verwacht tijdens ontwikkeling/tot
  /// een gemeente een Resend-account aanmaakt). De wachtwoord-resetflow valt
  /// dan terug op het loggen van de resetlink — zie deliverResetLink() in
  /// src/app/api/auth/forgot-password/route.ts.
  get resendApiKey() {
    return optional("RESEND_API_KEY", "");
  },
  get resendFromEmail() {
    return optional("RESEND_FROM_EMAIL", "V.E.R.A. <onboarding@resend.dev>");
  },
};
