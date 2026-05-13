/**
 * Regression harness for the keyword extractors.
 *
 * Walks `test-app/Casos/**`, identifies the PDF documents per case by filename
 * convention, extracts text and runs the keyword extractors. Reports a summary
 * grid so we can see at a glance which fields are extracted per case.
 *
 * Usage: npx tsx scripts/test-extractors.ts [filter]
 *   filter: optional substring; only cases whose path contains it are run.
 */

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { extractText } from "unpdf"

import {
  extractPILACandidates,
  extractARLCandidates,
  extractARLExpeditionDate,
  extractContractCandidates,
  extractActivityReportCandidates,
  detectIssuer,
  joinSplitDates,
} from "../lib/pdf/parsers/keyword-extractor"
import {
  checkPaymentSheet,
  checkARL,
  checkContract,
} from "../lib/pdf/sanity-checks"
import type {
  ARLData,
  ContractData,
  PaymentSheetData,
} from "../lib/types"

const ROOT = join(process.cwd(), "test-app", "Casos")
const SCAN_THRESHOLD = 150

// ─── Filesystem helpers ───────────────────────────────────────────────────────

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else yield full
  }
}

// ─── Case detection ──────────────────────────────────────────────────────────

interface CaseFiles {
  caseDir: string
  planilla?: string
  arl?: string
  contract?: string
  activityReport?: string
}

/** Identify PDFs in a case folder by filename pattern. */
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
    // OPS/OSE/OEF/etc orders are contract files
    else if (/^[0-9]+[_-](ops|ose|oef|csi|cps|cse|cca|cco|ocs)/i.test(name))
      out.contract = join(caseDir, name)
  }
  return out
}

// ─── Extraction ──────────────────────────────────────────────────────────────

async function extractPdfText(path: string): Promise<string> {
  const bytes = await readFile(path)
  const { text } = await extractText(new Uint8Array(bytes), {
    mergePages: false,
  })
  return joinSplitDates(text.join("\n\n"))
}

interface CaseResult {
  case: string
  planilla?: {
    file: string
    chars: number
    issuer: string
    extracted: Partial<PaymentSheetData>
    sanity: string[]
    blocked: boolean
  }
  arl?: {
    file: string
    chars: number
    issuer: string
    extracted: Partial<ARLData>
    expeditionDate: string | null
    sanity: string[]
    blocked: boolean
  }
  contract?: {
    file: string
    chars: number
    extracted: Partial<ContractData>
    sanity: string[]
    blocked: boolean
  }
  activityReport?: {
    file: string
    chars: number
    blocked: boolean
  }
}

async function runCase(files: CaseFiles): Promise<CaseResult> {
  const result: CaseResult = {
    case: relative(ROOT, files.caseDir).replace(/\\/g, "/"),
  }

  if (files.planilla) {
    const text = await extractPdfText(files.planilla)
    const chars = text.trim().length
    const blocked = chars < SCAN_THRESHOLD
    const cand = blocked ? {} : extractPILACandidates(text)
    const sanity = blocked
      ? ["PDF escaneado / sin texto"]
      : checkPaymentSheet(cand as PaymentSheetData).warnings
    result.planilla = {
      file: files.planilla.split(/[/\\]/).pop()!,
      chars,
      issuer: blocked ? "n/a" : detectIssuer(text, "pila"),
      extracted: cand as Partial<PaymentSheetData>,
      sanity,
      blocked,
    }
  }

  if (files.arl) {
    const text = await extractPdfText(files.arl)
    const chars = text.trim().length
    const blocked = chars < SCAN_THRESHOLD
    const cand = blocked ? {} : extractARLCandidates(text)
    const sanity = blocked
      ? ["PDF escaneado / sin texto"]
      : checkARL(cand as ARLData).warnings
    result.arl = {
      file: files.arl.split(/[/\\]/).pop()!,
      chars,
      issuer: blocked ? "n/a" : detectIssuer(text, "arl"),
      extracted: cand as Partial<ARLData>,
      expeditionDate: blocked ? null : extractARLExpeditionDate(text),
      sanity,
      blocked,
    }
  }

  if (files.contract) {
    const text = await extractPdfText(files.contract)
    const chars = text.trim().length
    const blocked = chars < SCAN_THRESHOLD
    const cand = blocked ? {} : extractContractCandidates(text)
    const sanity = blocked
      ? ["PDF escaneado / sin texto"]
      : checkContract(cand as ContractData).warnings
    result.contract = {
      file: files.contract.split(/[/\\]/).pop()!,
      chars,
      extracted: cand as Partial<ContractData>,
      sanity,
      blocked,
    }
  }

  if (files.activityReport) {
    const text = await extractPdfText(files.activityReport)
    const chars = text.trim().length
    const blocked = chars < SCAN_THRESHOLD
    if (!blocked) extractActivityReportCandidates(text) // just exercise it
    result.activityReport = {
      file: files.activityReport.split(/[/\\]/).pop()!,
      chars,
      blocked,
    }
  }
  return result
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function summarize(r: CaseResult): {
  ok: number
  warn: number
  blocked: boolean
  notes: string[]
} {
  let ok = 0
  let warn = 0
  let blocked = false
  const notes: string[] = []
  const docs = [
    ["planilla", r.planilla],
    ["arl", r.arl],
    ["contract", r.contract],
  ] as const
  for (const [label, doc] of docs) {
    if (!doc) continue
    if (doc.blocked) {
      blocked = true
      notes.push(`${label}: bloqueado (${doc.chars} chars)`)
      continue
    }
    if (doc.sanity.length === 0) ok++
    else {
      warn++
      notes.push(`${label}: ${doc.sanity.length} warning(s)`)
    }
  }
  return { ok, warn, blocked, notes }
}

// ─── Expected value comparison ───────────────────────────────────────────────

interface ExpectedValues {
  planilla?: Partial<PaymentSheetData>
  arl?: Partial<ARLData>
  contract?: Partial<ContractData>
}

/**
 * Compare actual extraction against expected.json (if present in case dir).
 * Returns list of mismatches per field. Only checks fields that the expected
 * file actually defines — missing fields are not validated.
 */
async function compareWithExpected(
  caseDir: string,
  result: CaseResult
): Promise<string[]> {
  const expectedPath = join(caseDir, "expected.json")
  let expected: ExpectedValues
  try {
    const raw = await readFile(expectedPath, "utf-8")
    expected = JSON.parse(raw)
  } catch {
    return []
  }

  const mismatches: string[] = []
  const checkSection = <T extends Record<string, unknown>>(
    label: string,
    actual: Partial<T> | undefined,
    exp: Partial<T> | undefined
  ) => {
    if (!exp) return
    for (const key of Object.keys(exp)) {
      const expVal = exp[key as keyof T]
      const actVal = actual?.[key as keyof T]
      if (String(expVal) !== String(actVal)) {
        mismatches.push(
          `${label}.${key}: expected "${expVal}" got "${actVal ?? ""}"`
        )
      }
    }
  }
  checkSection("planilla", result.planilla?.extracted, expected.planilla)
  checkSection("arl", result.arl?.extracted, expected.arl)
  checkSection("contract", result.contract?.extracted, expected.contract)
  return mismatches
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const filter = process.argv[2]?.toLowerCase()
  const cases: CaseFiles[] = []

  for await (const path of walk(ROOT)) {
    if (!/\.pdf$/i.test(path)) continue
    // Use parent dir of the PDF as case dir
    const caseDir = path.replace(/[/\\][^/\\]+$/, "")
    if (filter && !caseDir.toLowerCase().includes(filter)) continue
    if (!cases.some((c) => c.caseDir === caseDir)) {
      const files = await findCaseFiles(caseDir)
      if (files) cases.push(files)
    }
  }

  console.log(`\nFound ${cases.length} case folder(s)\n`)

  const allResults: CaseResult[] = []
  let totalBlocked = 0
  let totalWarn = 0
  let totalOk = 0
  let totalMismatch = 0

  for (const c of cases) {
    try {
      const r = await runCase(c)
      allResults.push(r)
      const s = summarize(r)
      const mismatches = await compareWithExpected(c.caseDir, r)
      const tag = mismatches.length > 0
        ? "FAIL "
        : s.blocked
          ? "BLOCK"
          : s.warn > 0
            ? "WARN "
            : "PASS "
      const colors: Record<string, string> = {
        "FAIL ": "\x1b[31;1m",
        "BLOCK": "\x1b[31m",
        "WARN ": "\x1b[33m",
        "PASS ": "\x1b[32m",
      }
      const reset = "\x1b[0m"
      console.log(`${colors[tag]}${tag}${reset} ${r.case}`)
      for (const m of mismatches) console.log(`        ✗ ${m}`)
      if (s.notes.length) {
        for (const note of s.notes) console.log(`        · ${note}`)
      }
      if (mismatches.length > 0) totalMismatch++
      else if (s.blocked) totalBlocked++
      else if (s.warn > 0) totalWarn++
      else totalOk++
    } catch (err) {
      console.error(`ERROR ${c.caseDir}:`, err)
    }
  }

  console.log(
    `\n──────────────────────────────────────────────\n` +
      `PASS:    ${totalOk}\n` +
      `WARN:    ${totalWarn}\n` +
      `BLOCKED: ${totalBlocked}\n` +
      `FAIL:    ${totalMismatch}  (mismatch vs expected.json)\n` +
      `TOTAL:   ${cases.length}\n`
  )

  // Persist full results for diffing across runs
  const outPath = join(process.cwd(), "test-app", "_actual.json")
  await writeFile(outPath, JSON.stringify(allResults, null, 2), "utf-8")
  console.log(`Full results written to ${relative(process.cwd(), outPath)}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
