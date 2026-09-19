import { z } from "zod";

// Precies één van sourceUrl (server haalt de tekst zelf op, zie
// src/lib/regulations/fetchRegulationText.ts) of content (rechtstreeks
// geplakte tekst) moet gegeven zijn.
export const createRegulationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
    content: z.string().trim().min(1).max(200_000).nullable().optional(),
  })
  .refine((data) => Boolean(data.sourceUrl) !== Boolean(data.content), {
    message: "Geef óf een URL óf geplakte tekst op (niet beide, niet geen van beide).",
  });
