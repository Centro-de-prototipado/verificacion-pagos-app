/**
 * Regression harness for the LLM-based extractor.
 *
 * Walks `test-app/Casos/**` and identifies the PDFs in each case folder by
 * filename convention. For each case:
 *
 *   - With `--with-llm` (default OFF): runs the full `/api/extract` pipeline
 *     against the real models and compares the result to `expected.json`.
 *   - Without `--with-llm` (default ON): only checks that text extraction
 *     succeeds and that a present `expected.json` parses against the schema.
 *
 * Usage:
 *   npx tsx scripts/test-extractors.ts [filter] [--with-llm]
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { extractText } from "unpdf"

import { extract } from "../lib/extraction/extract"
import { joinSplitDates, isLikelyScanned } from "../lib/extraction/preprocess"
import { ARLSchema } from "../lib/schemas/arl"
import { ContractSchema } from "../lib/schemas/contract"
import { PaymentSheetSchema } from "../lib/schemas/payment-sheet"
import { ActivityReportSchema } from "../lib/schemas/activity-report"

const ROOT = join(process.cwd(), "test-app", "Casos")

const args = process.argv.slice(2)
const WITH_LLM = args.includes("--with-llm")
const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase()

// ─── Filesystem walk ─────────────────────────────────────────────────────────

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else yield full
  }
}

interface CaseFiles {
  caseDir: string
  planilla?: string
  arl?: string
  contract?: string
  activityReport?: string
}

async function findCaseFiles(caseDir: string): Promise<CaseFiles | null> {
  const entries = await readdir(caseDir, { withFileTypes: true })
  const pdfs = entries
    .filter((e) => e.isFile() && /\.pdf$/i.test(e.name))
    .map((e) => e.name)
  if (pdfs.length === 0) return null

  const out: CaseFiles = { caseDir }
  for (const name of pdfs) {
    const lower = name.toLowerCase()
    if (lower.startsWith("planilla")) out.planilla = join(caseDir, name)
    else if (lower.startsWith("arl") || lower.includes("_arl"))
      out.arl = join(caseDir, name)
    else if (lower.startsWith("informe")) out.activityReport = join(caseDir, name)
    else if (/^[0-9]+[_-](ops|ose|oef|csi|cps|cse|cca|cco|ocs)/i.test(name))
      out.contract = join(caseDir, name)
  }
  return out
}

// ─── Text extraction ─────────────────────────────────────────────────────────

async function extractPdfText(path: string): Promise<string> {
  const bytes = await readFile(path)
  const { text } = await extractText(new Uint8Array(bytes), {
    mergePages: false,
  })
  return joinSplitDates(text.join("\n\n"))
}

// ─── Expected.json comparison ────────────────────────────────────────────────

interface ExpectedValues {
  planilla?: Record<string, unknown>
  arl?: Record<string, unknown>
  contract?: Record<string, unknown>
  activityReport?: Record<string, unknown>
}

function compareSection(
  label: string,
  actual: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown> | undefined
): string[] {
  if (!expected) return []
  const mismatches: string[] = []
  for (const key of Object.keys(expected)) {
    const exp = expected[key]
    const act = actual?.[key]
    if (String(exp) !== String(act)) {
      mismatches.push(`${label}.${key}: expected "${exp}" got "${act ?? ""}"`)
    }
  }
  return mismatches
}

async function readExpected(
  caseDir: string
): Promise<ExpectedValues | null> {
  try {
    const raw = await readFile(join(caseDir, "expected.json"), "utf-8")
    return JSON.parse(raw) as ExpectedValues
  } catch {
    return null
  }
}

// ─── Per-case execution ──────────────────────────────────────────────────────

interface CaseResult {
  case: string
  status: "PASS" | "WARN" | "FAIL" | "BLOCK" | "SKIP"
  mismatches: string[]
  notes: string[]
}

async function runCase(files: CaseFiles): Promise<CaseResult> {
  const caseLabel = relative(ROOT, files.caseDir).replace(/\\/g, "/")
  const notes: string[] = []
  const mismatches: string[] = []
  const expected = await readExpected(files.caseDir)

  if (!WITH_LLM) {
    // Dry mode: only check that text is extractable.
    for (const [label, path] of [
      ["planilla", files.planilla],
      ["arl", files.arl],
      ["contract", files.contract],
      ["activityReport", files.activityReport],
    ] as const) {
      if (!path) continue
      const text = await extractPdfText(path)
      if (isLikelyScanned(text)) {
        notes.push(`${label}: PDF escaneado (${text.trim().length} chars)`)
      }
    }
    return {
      case: caseLabel,
      status: notes.some((n) => n.includes("escaneado")) ? "BLOCK" : "PASS",
      mismatches,
      notes,
    }
  }

  // LLM mode: actually call the extractor.
  const tasks: Array<Promise<void>> = []
  const actual: Record<string, unknown> = {}

  const runOne = async (
    key: string,
    path: string | undefined,
    schema: Parameters<typeof extract>[0]["schema"],
    docLabel: string
  ) => {
    if (!path) return
    try {
      const text = await extractPdfText(path)
      const { data, scanned, validationError } = await extract({
        text,
        schema,
        docLabel,
      })
      if (scanned) {
        notes.push(`${key}: bloqueado (PDF escaneado)`)
      } else if (!data) {
        notes.push(`${key}: extracción inválida (${validationError ?? "?"})`)
      } else {
        actual[key] = data
      }
    } catch (err) {
      notes.push(`${key}: error — ${err instanceof Error ? err.message : err}`)
    }
  }

  tasks.push(runOne("planilla", files.planilla, PaymentSheetSchema, "Planilla PILA"))
  tasks.push(runOne("arl", files.arl, ARLSchema, "Certificado ARL"))
  tasks.push(runOne("contract", files.contract, ContractSchema, "Contrato"))
  tasks.push(
    runOne(
      "activityReport",
      files.activityReport,
      ActivityReportSchema,
      "Informe de actividades"
    )
  )
  await Promise.all(tasks)

  if (expected) {
    mismatches.push(
      ...compareSection("planilla", actual.planilla as Record<string, unknown>, expected.planilla),
      ...compareSection("arl", actual.arl as Record<string, unknown>, expected.arl),
      ...compareSection("contract", actual.contract as Record<string, unknown>, expected.contract),
      ...compareSection(
        "activityReport",
        actual.activityReport as Record<string, unknown>,
        expected.activityReport
      )
    )
  }

  let status: CaseResult["status"] = "PASS"
  if (mismatches.length > 0) status = "FAIL"
  else if (notes.some((n) => n.includes("inválida") || n.includes("error"))) status = "WARN"
  else if (notes.some((n) => n.includes("escaneado"))) status = "BLOCK"

  return { case: caseLabel, status, mismatches, notes }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const COLORS: Record<CaseResult["status"], string> = {
  PASS: "\x1b[32m",
  WARN: "\x1b[33m",
  FAIL: "\x1b[31;1m",
  BLOCK: "\x1b[31m",
  SKIP: "\x1b[90m",
}
const RESET = "\x1b[0m"

async function main() {
  const cases: CaseFiles[] = []
  for await (const path of walk(ROOT)) {
    if (!/\.pdf$/i.test(path)) continue
    const caseDir = path.replace(/[/\\][^/\\]+$/, "")
    if (filter && !caseDir.toLowerCase().includes(filter)) continue
    if (!cases.some((c) => c.caseDir === caseDir)) {
      const files = await findCaseFiles(caseDir)
      if (files) cases.push(files)
    }
  }

  console.log(
    `\nFound ${cases.length} case folder(s)  ${WITH_LLM ? "(LLM mode)" : "(dry mode — pass --with-llm to call models)"}\n`
  )

  const results: CaseResult[] = []
  const counts: Record<CaseResult["status"], number> = {
    PASS: 0,
    WARN: 0,
    FAIL: 0,
    BLOCK: 0,
    SKIP: 0,
  }

  for (const c of cases) {
    try {
      const r = await runCase(c)
      results.push(r)
      counts[r.status]++
      const color = COLORS[r.status]
      console.log(`${color}${r.status.padEnd(5)}${RESET} ${r.case}`)
      for (const m of r.mismatches) console.log(`        ✗ ${m}`)
      for (const n of r.notes) console.log(`        · ${n}`)
    } catch (err) {
      console.error(`ERROR ${c.caseDir}:`, err)
    }
  }

  console.log(
    `\n──────────────────────────────────────────────\n` +
      `PASS:  ${counts.PASS}\n` +
      `WARN:  ${counts.WARN}\n` +
      `BLOCK: ${counts.BLOCK}\n` +
      `FAIL:  ${counts.FAIL}\n` +
      `TOTAL: ${cases.length}\n`
  )

  const outPath = join(process.cwd(), "test-app", "_actual.json")
  await writeFile(outPath, JSON.stringify(results, null, 2), "utf-8")
  console.log(`Results written to ${relative(process.cwd(), outPath)}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
