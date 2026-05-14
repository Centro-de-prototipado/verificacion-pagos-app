/**
 * Test harness for LLM-based extraction.
 *
 *   npm run test:case                  → corre TODOS los casos, guarda actual.json en cada uno
 *   npm run test:case "Simple"         → solo casos que matcheen "Simple"
 *   npm run test:case -- --compare     → no llama LLM, compara actual.json vs expected.json
 *   npm run test:case -- --init        → además crea expected.json donde no exista (copia actual.json)
 *
 * Workflow propuesto:
 *   1. `npm run test:case` — corre extracción de todos los PDFs y guarda
 *      `actual.json` en cada carpeta de caso.
 *   2. Por cada caso: abre `actual.json` junto al PDF y verifica los valores.
 *      Si el caso es nuevo, copia `actual.json` a `expected.json` (manualmente
 *      o usando `--init`) y EDITA los valores que estén mal en `expected.json`.
 *   3. `npm run test:case -- --compare` — diff por campo de actual vs expected
 *      en todos los casos, con resumen agregado por tipo de campo.
 *   4. Iterar: ajustar prompts/anchors → re-correr → re-comparar.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import { extractText } from "unpdf"

import { extract } from "../lib/extraction/extract"
import { isLikelyScanned, joinSplitDates } from "../lib/extraction/preprocess"
import { ARLSchema } from "../lib/schemas/arl"
import { ContractSchema } from "../lib/schemas/contract"
import { PaymentSheetSchema } from "../lib/schemas/payment-sheet"
import { ActivityReportSchema } from "../lib/schemas/activity-report"

const ROOT = join(process.cwd(), "test-app", "Casos")

// ─── ANSI colors ────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m"
const RED = "\x1b[31;1m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const GRAY = "\x1b[90m"
const BOLD = "\x1b[1m"
const RESET = "\x1b[0m"

const args = process.argv.slice(2)
const COMPARE_ONLY = args.includes("--compare")
const INIT_EXPECTED = args.includes("--init")
const filter = args.find((a) => !a.startsWith("--"))

// ─── Filesystem ──────────────────────────────────────────────────────────────

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

async function extractPdfText(path: string): Promise<string> {
  const bytes = await readFile(path)
  const { text } = await extractText(new Uint8Array(bytes), { mergePages: false })
  return joinSplitDates(text.join("\n\n"))
}

// ─── Result shape ────────────────────────────────────────────────────────────

interface CaseResult {
  planilla: Record<string, unknown> | null
  arl: Record<string, unknown> | null
  contract: Record<string, unknown> | null
  activityReport: Record<string, unknown> | null
}

async function runDoc(
  path: string | undefined,
  schema: Parameters<typeof extract>[0]["schema"],
  docType: Parameters<typeof extract>[0]["docType"],
  docLabel: string
): Promise<Record<string, unknown> | null> {
  if (!path) return null
  try {
    const text = await extractPdfText(path)
    // For scanned PDFs (no text layer), pass the raw bytes so extract()
    // can fall back to Mistral OCR.
    const pdfBytes = isLikelyScanned(text)
      ? new Uint8Array(await readFile(path))
      : undefined
    const { data, usedOcr } = await extract({
      text,
      pdfBytes,
      schema,
      docType,
      docLabel,
    })
    if (usedOcr) {
      console.log(`  ${docLabel}: extraído vía OCR`)
    }
    return (data as Record<string, unknown> | null) ?? null
  } catch (err) {
    console.error(`  error en ${docLabel}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function runCase(files: CaseFiles): Promise<CaseResult> {
  const [planilla, arl, contract, activityReport] = await Promise.all([
    runDoc(files.planilla, PaymentSheetSchema, "pila", "Planilla PILA"),
    runDoc(files.arl, ARLSchema, "arl", "Certificado ARL"),
    runDoc(files.contract, ContractSchema, "contract", "Contrato"),
    runDoc(
      files.activityReport,
      ActivityReportSchema,
      "report",
      "Informe de actividades"
    ),
  ])
  return { planilla, arl, contract, activityReport }
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

async function readJSON<T = unknown>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJSON(path: string, data: unknown) {
  await mkdir(join(path, ".."), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8")
}

// ─── Comparison ──────────────────────────────────────────────────────────────

interface FieldDiff {
  field: string // e.g. "planilla.sheetNumber"
  actual: unknown
  expected: unknown
}

/** Campos que se ignoran al comparar:
 *  - `specificObligations`: no se usa en ningún cálculo concreto.
 *  - `contract.startDate` / `contract.endDate`: la UI los sobreescribe con
 *    las fechas de la ARL en step-2, así que la extracción del contrato no
 *    es la fuente de verdad. */
const IGNORED_FIELDS = new Set([
  "contract.specificObligations",
  "contract.startDate",
  "contract.endDate",
])

function compareSection(
  prefix: string,
  actual: Record<string, unknown> | null,
  expected: Record<string, unknown> | null
): FieldDiff[] {
  if (!expected) return []
  const diffs: FieldDiff[] = []
  for (const key of Object.keys(expected)) {
    const path = `${prefix}.${key}`
    if (IGNORED_FIELDS.has(path)) continue
    const exp = expected[key]
    const act = actual?.[key]
    if (JSON.stringify(exp) !== JSON.stringify(act)) {
      diffs.push({ field: path, actual: act, expected: exp })
    }
  }
  return diffs
}

function compareCase(actual: CaseResult, expected: Partial<CaseResult>): FieldDiff[] {
  return [
    ...compareSection("planilla", actual.planilla, expected.planilla ?? null),
    ...compareSection("arl", actual.arl, expected.arl ?? null),
    ...compareSection("contract", actual.contract, expected.contract ?? null),
    ...compareSection(
      "activityReport",
      actual.activityReport,
      expected.activityReport ?? null
    ),
  ]
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return `${GRAY}null${RESET}`
  if (typeof v === "string") return `"${v}"`
  if (Array.isArray(v)) return `[${v.length} item(s)]`
  return JSON.stringify(v)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Discover cases
  const cases: CaseFiles[] = []
  for await (const path of walk(ROOT)) {
    if (!/\.pdf$/i.test(path)) continue
    const caseDir = path.replace(/[/\\][^/\\]+$/, "")
    if (filter && !caseDir.toLowerCase().includes(filter.toLowerCase())) continue
    if (!cases.some((c) => c.caseDir === caseDir)) {
      const files = await findCaseFiles(caseDir)
      if (files) cases.push(files)
    }
  }

  if (cases.length === 0) {
    console.error(`No matching cases${filter ? ` for "${filter}"` : ""}`)
    process.exit(1)
  }

  console.log(
    `\n${BOLD}${cases.length} caso(s)${COMPARE_ONLY ? " — modo comparación (sin LLM)" : ""}${RESET}\n`
  )

  // 2. Run or load
  const results: { c: CaseFiles; actual: CaseResult; expected: Partial<CaseResult> | null }[] = []

  for (const [i, c] of cases.entries()) {
    const label = relative(ROOT, c.caseDir).replace(/\\/g, "/")
    process.stdout.write(`${GRAY}[${i + 1}/${cases.length}]${RESET} ${label} `)

    let actual: CaseResult | null
    if (COMPARE_ONLY) {
      actual = await readJSON<CaseResult>(join(c.caseDir, "actual.json"))
      if (!actual) {
        console.log(`${YELLOW}(sin actual.json — omitido)${RESET}`)
        continue
      }
      console.log(`${GRAY}cargado${RESET}`)
    } else {
      actual = await runCase(c)
      await writeJSON(join(c.caseDir, "actual.json"), actual)
      console.log(`${GREEN}✓${RESET}`)
    }

    const expected = await readJSON<Partial<CaseResult>>(
      join(c.caseDir, "expected.json")
    )

    if (INIT_EXPECTED && !expected && actual) {
      await writeJSON(join(c.caseDir, "expected.json"), actual)
      console.log(`  ${CYAN}→ creado expected.json (revisa y edita)${RESET}`)
    }

    results.push({ c, actual, expected })
  }

  // 3. Comparison report
  console.log(`\n${BOLD}═══ REPORTE DE COMPARACIÓN ═══${RESET}\n`)

  const allDiffs: { caseLabel: string; diffs: FieldDiff[] }[] = []
  const fieldFailures: Record<string, number> = {}
  let casesWithoutExpected = 0
  let casesPerfect = 0

  for (const r of results) {
    const label = relative(ROOT, r.c.caseDir).replace(/\\/g, "/")
    if (!r.expected) {
      casesWithoutExpected++
      console.log(`${YELLOW}?${RESET} ${label} ${GRAY}(sin expected.json)${RESET}`)
      continue
    }
    const diffs = compareCase(r.actual, r.expected)
    if (diffs.length === 0) {
      casesPerfect++
      console.log(`${GREEN}✓${RESET} ${label}`)
    } else {
      console.log(`${RED}✗${RESET} ${label}  ${RED}${diffs.length} diferencia(s)${RESET}`)
      for (const d of diffs) {
        console.log(
          `    ${d.field}: ${fmtVal(d.actual)} ${GRAY}vs${RESET} ${fmtVal(d.expected)}`
        )
        fieldFailures[d.field] = (fieldFailures[d.field] ?? 0) + 1
      }
      allDiffs.push({ caseLabel: label, diffs })
    }
  }

  // 4. Aggregated stats
  console.log(`\n${BOLD}═══ RESUMEN ═══${RESET}`)
  console.log(`${GREEN}Coinciden:${RESET}        ${casesPerfect}`)
  console.log(`${RED}Con diferencias:${RESET}   ${allDiffs.length}`)
  console.log(`${YELLOW}Sin expected:${RESET}      ${casesWithoutExpected}`)
  console.log(`${GRAY}Total casos:${RESET}       ${results.length}`)

  if (Object.keys(fieldFailures).length > 0) {
    console.log(`\n${BOLD}Campos con más fallos:${RESET}`)
    const sorted = Object.entries(fieldFailures).sort((a, b) => b[1] - a[1])
    for (const [field, count] of sorted) {
      const bar = "█".repeat(Math.min(count, 20))
      console.log(`  ${RED}${count.toString().padStart(3)}${RESET} ${bar} ${field}`)
    }
  }

  console.log("")
  if (casesWithoutExpected > 0) {
    console.log(
      `${GRAY}Tip: corre con ${BOLD}--init${RESET}${GRAY} para crear expected.json donde no exista.${RESET}`
    )
  }
  if (allDiffs.length > 0) {
    console.log(
      `${GRAY}Tip: edita expected.json en los casos con diferencias para reflejar el valor correcto, luego corre ${BOLD}-- --compare${RESET}${GRAY} para ver el diff sin gastar llamadas LLM.${RESET}`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
