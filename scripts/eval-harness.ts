// Eval-harness — GEEN onderdeel van de geautomatiseerde testsuite en NIET
// bedoeld om in CI te draaien: dit script doet ECHTE, betaalde OpenAI
// API-calls tegen de 20 fictieve testcasussen in fixtures/cases/, om
// promptkwaliteit te beoordelen (zero-fabrication-naleving, categorisatie,
// brontraceerbaarheid, herkenning van ontbrekende info).
//
// Gebruik:
//   npm run eval                 # alle 20 casussen
//   npm run eval -- --limit=3    # alleen de eerste 3 (goedkoper, sneller testen)
//
// Vereist: OPENAI_API_KEY in .env (een echte sleutel, geen placeholder).

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai";
import { segmentSources } from "@/lib/ai/sourceSegments";
import { parseChapters, parseWritingStyles } from "@/lib/formats/types";
import { findUnverifiedSourceRefs, validateChapterKeyCompleteness } from "@/lib/validators";

type FixtureCase = {
  id: string;
  title: string;
  disciplineCode: string;
  documentTypeCode: string;
  sourceText: string;
};

type CaseResult = {
  caseId: string;
  title: string;
  ok: boolean;
  error?: string;
  latencyMs?: number;
  totalStatements?: number;
  categoryCounts?: Record<string, number>;
  totalMissingInfo?: number;
  unverifiedSourceRefs?: number;
  chapterKeyIssues?: { missing: string[]; unexpected: string[]; duplicates: string[] };
};

function loadFixtures(limit?: number): FixtureCase[] {
  const dir = path.join(process.cwd(), "fixtures", "cases");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const selected = limit ? files.slice(0, limit) : files;
  return selected.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as FixtureCase);
}

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;
  return { limit: Number.isFinite(limit) ? limit : undefined };
}

async function main() {
  const { limit } = parseArgs();
  const cases = loadFixtures(limit);
  console.log(`Eval-harness: ${cases.length} testcasus(sen) geladen.\n`);

  const formatTemplate = await prisma.formatTemplate.findFirst({
    where: {
      isDefault: true,
      documentType: { code: "onderzoeksverslag", discipline: { code: "jeugd" } },
    },
    include: { documentType: { include: { discipline: true } } },
  });

  if (!formatTemplate) {
    console.error(
      "Geen format gevonden voor jeugd/onderzoeksverslag. Draai eerst: npm run db:seed",
    );
    process.exitCode = 1;
    return;
  }

  const chapters = parseChapters(formatTemplate.chapters);
  const writingStyles = parseWritingStyles(formatTemplate.writingStyles);
  const writingStyle = writingStyles[0] ?? null;
  const provider = getAIProvider();

  const results: CaseResult[] = [];

  for (const testCase of cases) {
    process.stdout.write(`→ ${testCase.id} (${testCase.title})... `);
    const segments = segmentSources([
      { id: "src-1", filename: testCase.title, extractedText: testCase.sourceText },
    ]);

    const startedAt = Date.now();
    try {
      const analysis = await provider.analyzeReport({
        disciplineName: formatTemplate.documentType.discipline.name,
        documentTypeName: formatTemplate.documentType.name,
        chapters,
        writingStyle,
        segments,
      });
      const latencyMs = Date.now() - startedAt;

      const chapterKeyIssues = validateChapterKeyCompleteness(
        analysis.chapters.map((c) => c.key),
        chapters.map((c) => c.key),
      );

      const categoryCounts: Record<string, number> = { FEIT: 0, VERKLARING: 0, PROFESSIONELE_DUIDING: 0 };
      let totalStatements = 0;
      let totalMissingInfo = 0;
      let unverifiedSourceRefs = 0;

      for (const chapter of analysis.chapters) {
        totalMissingInfo += chapter.missingInfo.length;
        const unverified = findUnverifiedSourceRefs(chapter.statements, segments);
        unverifiedSourceRefs += unverified.reduce((sum, u) => sum + u.invalidRefs.length, 0);
        for (const statement of chapter.statements) {
          totalStatements += 1;
          categoryCounts[statement.category] = (categoryCounts[statement.category] ?? 0) + 1;
        }
      }

      results.push({
        caseId: testCase.id,
        title: testCase.title,
        ok: true,
        latencyMs,
        totalStatements,
        categoryCounts,
        totalMissingInfo,
        unverifiedSourceRefs,
        chapterKeyIssues,
      });

      console.log(
        `OK (${latencyMs}ms, ${totalStatements} beweringen, ${totalMissingInfo} ontbrekend, ${unverifiedSourceRefs} niet-geverifieerde bronverwijzingen)`,
      );
    } catch (err) {
      results.push({
        caseId: testCase.id,
        title: testCase.title,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`FOUT: ${err instanceof Error ? err.message : err}`);
    }
  }

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const totalUnverified = succeeded.reduce((sum, r) => sum + (r.unverifiedSourceRefs ?? 0), 0);
  const totalStatementsAll = succeeded.reduce((sum, r) => sum + (r.totalStatements ?? 0), 0);
  const casesWithChapterIssues = succeeded.filter(
    (r) =>
      (r.chapterKeyIssues?.missing.length ?? 0) > 0 ||
      (r.chapterKeyIssues?.unexpected.length ?? 0) > 0 ||
      (r.chapterKeyIssues?.duplicates.length ?? 0) > 0,
  );

  console.log("\n=== Samenvatting ===");
  console.log(`Geslaagd: ${succeeded.length}/${results.length}`);
  console.log(`Gefaald: ${failed.length}/${results.length}`);
  console.log(`Totaal aantal beweringen: ${totalStatementsAll}`);
  console.log(
    `Niet-geverifieerde bronverwijzingen (fabricatie-risico): ${totalUnverified} ` +
      `(${totalStatementsAll > 0 ? ((totalUnverified / totalStatementsAll) * 100).toFixed(1) : "0"}%)`,
  );
  console.log(`Casussen met hoofdstuk-key-afwijkingen: ${casesWithChapterIssues.length}`);

  const outDir = path.join(process.cwd(), "eval-results");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nVolledig resultaat weggeschreven naar: ${outFile}`);

  if (totalUnverified > 0) {
    console.warn(
      "\nWAARSCHUWING: er zijn niet-geverifieerde bronverwijzingen gedetecteerd. Controleer de " +
        "prompt/instructies — dit zou door de schema-enum-beperking op sourceRefs eigenlijk niet " +
        "moeten voorkomen.",
    );
  }
}

main()
  .catch((err) => {
    console.error("Eval-harness mislukt:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
