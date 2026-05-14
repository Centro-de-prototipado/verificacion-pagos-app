import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { snapshotProviders } from "@/lib/ai/client"
import type { OnProviderProgress } from "@/lib/ai/client"
import { extract } from "@/lib/extraction/extract"
import { joinSplitDates } from "@/lib/extraction/preprocess"
import { ARLSchema } from "@/lib/schemas/arl"
import { ContractSchema } from "@/lib/schemas/contract"
import { PaymentSheetSchema } from "@/lib/schemas/payment-sheet"
import { ActivityReportSchema } from "@/lib/schemas/activity-report"
import type { ARLExtracted } from "@/lib/schemas/arl"
import type { ContractExtracted } from "@/lib/schemas/contract"
import type { PaymentSheetExtracted } from "@/lib/schemas/payment-sheet"
import type { ActivityReportExtracted } from "@/lib/schemas/activity-report"
import { isDocumentMatch } from "@/lib/pdf/document-validator"
import type { ConfidenceLevel, ConfidenceMap, ExtractedData } from "@/lib/types"
import {
  exceedsContentLength,
  getClientIp,
  isRateLimited,
} from "@/lib/security/request-guards"

export const runtime = "nodejs"

// ─── Stream event types ───────────────────────────────────────────────────────

export type ExtractionStreamEvent =
  | { type: "trying"; doc: string; model: string }
  | { type: "failed"; doc: string; model: string }
  | { type: "success"; doc: string; model: string }
  | {
      type: "result"
      data: ExtractedData
      warnings: string[]
      issuerKeys: Record<string, string>
      confidence: Record<string, ConfidenceMap>
    }
  | { type: "error"; message: string; details?: string }

// ─── Request shape ───────────────────────────────────────────────────────────

const ExtractRequestSchema = z.object({
  rawText: z.object({
    paymentSheet: z.string().optional(),
    arl: z.string().optional(),
    contract: z.string().optional(),
    contract2: z.string().optional(),
    paymentSheet2: z.string().optional(),
    activityReport: z.string().optional(),
  }),
  /** Per-document base64-encoded PDF bytes. Only sent when the doc text is
   *  scanned/empty — enables Mistral OCR fallback. */
  rawPdf: z
    .object({
      paymentSheet: z.string().optional(),
      arl: z.string().optional(),
      contract: z.string().optional(),
      contract2: z.string().optional(),
      paymentSheet2: z.string().optional(),
      activityReport: z.string().optional(),
    })
    .optional()
    .default({}),
  paymentRequestPeriod: z.string().optional(),
  contractCount: z.enum(["1", "2"]).optional(),
  involvedContracts: z.enum(["1", "2", "Ambos"]).optional(),
  obligationsHint: z.array(z.string()).default([]),
})

// Bumped to 20 MB to accommodate base64-encoded PDF bytes for OCR fallback.
const MAX_JSON_BYTES = 20 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 10

// ─── Soft sanity checks (warnings only — never block extraction) ─────────────

const COMPANY_TOKENS = [
  "S.A.S", "SAS", "LTDA", "LIMITADA", "ARL", "SURA", "SURAMERICANA",
  "POSITIVA", "COLMENA", "COLPATRIA", "BOLIVAR", "BOLÍVAR", "LIBERTY",
  "EQUIDAD", "MAPFRE", "AXA", "EPS", "PROTECCION", "PROTECCIÓN", "PORVENIR",
  "COLPENSIONES", "COLFONDOS", "SANITAS", "COMPENSAR", "FAMISANAR",
  "ASOPAGOS", "SIMPLE", "APORTES EN LINEA", "APORTES EN LÍNEA",
  "ENLACE OPERATIVO", "MI PLANILLA", "UNIVERSIDAD NACIONAL", "U. NACIONAL",
  "UNAL", "COMPAÑÍA", "COMPANIA", "SEGUROS", "INSTITUTO", "FUNDACION",
  "FUNDACIÓN", "MINISTERIO", "GOBIERNO", "SECRETARÍA", "SECRETARIA",
  "EMPRESA", "CORPORACIÓN", "CORPORACION",
]

function looksLikeCompany(name: string): boolean {
  if (!name) return false
  const padded = ` ${name.toUpperCase()} `
  return COMPANY_TOKENS.some(
    (tok) =>
      padded.includes(` ${tok} `) ||
      padded.includes(` ${tok},`) ||
      name.startsWith(`${tok} `) ||
      name.endsWith(` ${tok}`)
  )
}

const VALID_RATE_BY_RISK: Record<string, number> = {
  I: 0.522, II: 1.044, III: 2.436, IV: 4.35, V: 6.96,
}

function parseDMY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1])
}

// ─── Cross-doc name consistency ──────────────────────────────────────────────

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
}

function nameOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((w) => w.length > 2))
  return b
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => ta.has(w)).length
}

// ─── Per-field confidence ────────────────────────────────────────────────────
// Present → "high", null/empty → "low". Medium gets stamped later when a
// sanity warning specifically targets a field.

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === 0
}

function buildConfidence<T extends object>(data: T): ConfidenceMap {
  const map: ConfidenceMap = {}
  for (const [k, v] of Object.entries(data)) {
    map[k] = isMissing(v) ? ("low" as ConfidenceLevel) : ("high" as ConfidenceLevel)
  }
  return map
}

function downgrade(
  confidence: Record<string, ConfidenceMap>,
  docKey: string,
  field: string
): void {
  if (!confidence[docKey]) confidence[docKey] = {}
  confidence[docKey][field] = "medium"
}

/**
 * Convert null/undefined fields to safe defaults that match the existing
 * non-nullable type contracts in lib/types.ts. The UI editors expect "" for
 * missing strings, 0 for numbers, etc. `paymentDeadline` is kept nullable
 * because the canonical PaymentSheetData declares it as `string | null`.
 */
function denull<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) {
      if (k === "paymentDeadline") out[k] = null
      else out[k] = typeof v === "number" ? 0 : ""
    } else out[k] = v
  }
  return out as T
}

// ─── ARL expedition-date check (last 30 days) ────────────────────────────────

function extractExpeditionDate(text: string): string | null {
  const labelled = text.match(
    /(?:fecha\s+de\s+(?:expedici[oó]n|generaci[oó]n|emisi[oó]n)|expedido\s+el|fecha\s+del?\s+certificad)[^\d]{0,30}(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
  )
  if (labelled) return labelled[1].replace(/-/g, "/")
  const iso = text.match(
    /(?:fecha\s+de\s+(?:expedici[oó]n|generaci[oó]n|emisi[oó]n)|expedido\s+el)[^\d]{0,30}(\d{4})[\/\-](\d{2})[\/\-](\d{2})/i
  )
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return null
}

function daysSince(ddmmyyyy: string): number | null {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const issued = new Date(+m[3], +m[2] - 1, +m[1])
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  )
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - issued.getTime()) / 86_400_000)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (
    isRateLimited({
      key: `extract:${ip}`,
      limit: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    )
  }

  if (exceedsContentLength(request, MAX_JSON_BYTES)) {
    return NextResponse.json(
      { error: "La solicitud es demasiado grande." },
      { status: 413 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = ExtractRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "El body debe incluir rawText con el formato esperado." },
      { status: 400 }
    )
  }

  const {
    rawText,
    rawPdf,
    paymentRequestPeriod,
    contractCount,
    involvedContracts,
    obligationsHint,
  } = parsed.data

  /** Decode optional base64 PDF bytes per document. */
  const decode = (b64: string | undefined): Uint8Array | undefined => {
    if (!b64) return undefined
    try {
      // Strip data URL prefix if present
      const pure = b64.replace(/^data:application\/pdf;base64,/, "")
      return new Uint8Array(Buffer.from(pure, "base64"))
    } catch {
      return undefined
    }
  }

  const pdfBytes = {
    paymentSheet: decode(rawPdf.paymentSheet),
    arl: decode(rawPdf.arl),
    contract: decode(rawPdf.contract),
    contract2: decode(rawPdf.contract2),
    paymentSheet2: decode(rawPdf.paymentSheet2),
    activityReport: decode(rawPdf.activityReport),
  }

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (event: ExtractionStreamEvent) => {
    try {
      writer.write(encoder.encode(JSON.stringify(event) + "\n"))
    } catch {
      /* client disconnected */
    }
  }

  ;(async () => {
    try {
      const text = {
        paymentSheet: joinSplitDates(rawText.paymentSheet ?? ""),
        arl: joinSplitDates(rawText.arl ?? ""),
        contract: joinSplitDates(rawText.contract ?? ""),
        contract2: joinSplitDates(rawText.contract2 ?? ""),
        paymentSheet2: joinSplitDates(rawText.paymentSheet2 ?? ""),
        activityReport: joinSplitDates(rawText.activityReport ?? ""),
      }

      // If the PDF will go through OCR (bytes provided), skip the text-based
      // fingerprint check entirely. Screenshots often carry junk metadata
      // (image filename, URL) that's enough text to defeat `isDocumentMatch`
      // but not real document content — trust the user's upload slot and let
      // OCR handle extraction.
      const checkOrAccept = (
        txt: string,
        kind: Parameters<typeof isDocumentMatch>[1],
        hasBytes: boolean
      ) => {
        if (hasBytes) return { valid: true, label: "OCR" }
        return isDocumentMatch(txt, kind)
      }

      const checks = {
        paymentSheet: checkOrAccept(
          text.paymentSheet,
          "pila",
          !!pdfBytes.paymentSheet
        ),
        arl: checkOrAccept(text.arl, "arl", !!pdfBytes.arl),
        contract: checkOrAccept(text.contract, "contract", !!pdfBytes.contract),
        contract2:
          text.contract2 || pdfBytes.contract2
            ? checkOrAccept(text.contract2, "contract", !!pdfBytes.contract2)
            : null,
        activityReport:
          text.activityReport || pdfBytes.activityReport
            ? checkOrAccept(
                text.activityReport,
                "report",
                !!pdfBytes.activityReport
              )
            : null,
        paymentSheet2:
          text.paymentSheet2 || pdfBytes.paymentSheet2
            ? checkOrAccept(text.paymentSheet2, "pila", !!pdfBytes.paymentSheet2)
            : null,
      }

      const snapshot = snapshotProviders()
      const onProgress =
        (doc: string): OnProviderProgress =>
        (type, model) =>
          send({ type, doc, model } as ExtractionStreamEvent)

      // ── Hints for ambiguous cases ────────────────────────────────────────
      const periodHint = paymentRequestPeriod
        ? `El contratista solicita el pago del período ${paymentRequestPeriod}. ` +
          `Si la planilla contiene múltiples períodos cotizados, elige el que coincide con ${paymentRequestPeriod}.`
        : ""

      const arlDoubleHint =
        contractCount === "2" && involvedContracts && involvedContracts !== "Ambos"
          ? `Este pago corresponde al Contrato ${involvedContracts}. ` +
            `Si el ARL muestra coberturas para múltiples contratos, extrae las fechas de la fila correspondiente al contrato ${involvedContracts}.`
          : contractCount === "2" && involvedContracts === "Ambos"
            ? `Se cobran AMBOS contratos. Si el ARL muestra dos coberturas, usa la fecha de inicio MÁS TEMPRANA y la fecha de fin MÁS TARDÍA.`
            : ""

      const reportObligationsHint = obligationsHint.length
        ? `El contrato tiene estas obligaciones, búscalas en el reporte:\n${obligationsHint.map((o) => `- ${o}`).join("\n")}`
        : ""

      // ── Parallel extraction ──────────────────────────────────────────────
      const [r0, r1, r2, r3, r4, r5] = await Promise.allSettled([
        checks.paymentSheet.valid
          ? extract<PaymentSheetExtracted>({
              text: text.paymentSheet,
              pdfBytes: pdfBytes.paymentSheet,
              schema: PaymentSheetSchema,
              docLabel: "Planilla PILA de seguridad social",
              docType: "pila",
              hints: periodHint,
              snapshot,
              onProgress: onProgress("paymentSheet"),
            })
          : Promise.resolve({ data: null, scanned: false }),
        checks.arl.valid
          ? extract<ARLExtracted>({
              text: text.arl,
              pdfBytes: pdfBytes.arl,
              schema: ARLSchema,
              docLabel: "Certificado de afiliación ARL",
              docType: "arl",
              hints: arlDoubleHint,
              snapshot,
              onProgress: onProgress("arl"),
            })
          : Promise.resolve({ data: null, scanned: false }),
        checks.contract.valid
          ? extract<ContractExtracted>({
              text: text.contract,
              pdfBytes: pdfBytes.contract,
              schema: ContractSchema,
              docLabel: "Contrato UNAL",
              docType: "contract",
              snapshot,
              onProgress: onProgress("contract"),
            })
          : Promise.resolve({ data: null, scanned: false }),
        checks.contract2?.valid
          ? extract<ContractExtracted>({
              text: text.contract2,
              pdfBytes: pdfBytes.contract2,
              schema: ContractSchema,
              docLabel: "Contrato UNAL (segundo)",
              docType: "contract",
              snapshot,
              onProgress: onProgress("contract2"),
            })
          : Promise.resolve({ data: null, scanned: false }),
        checks.activityReport?.valid
          ? extract<ActivityReportExtracted>({
              text: text.activityReport,
              pdfBytes: pdfBytes.activityReport,
              schema: ActivityReportSchema,
              docLabel: "Informe de actividades",
              docType: "report",
              hints: reportObligationsHint,
              snapshot,
              onProgress: onProgress("activityReport"),
            })
          : Promise.resolve({ data: null, scanned: false }),
        checks.paymentSheet2?.valid
          ? extract<PaymentSheetExtracted>({
              text: text.paymentSheet2,
              pdfBytes: pdfBytes.paymentSheet2,
              schema: PaymentSheetSchema,
              docLabel: "Planilla PILA (mes siguiente)",
              docType: "pila",
              snapshot,
              onProgress: onProgress("paymentSheet2"),
            })
          : Promise.resolve({ data: null, scanned: false }),
      ])

      const warnings: string[] = []
      const confidence: Record<string, ConfidenceMap> = {}

      // ── Wrong-document warnings ──────────────────────────────────────────
      const wrongTypeWarn = (key: string, label: string, raw: string) => {
        if (raw.trim().length > 0)
          warnings.push(
            `${label} — el PDF no parece ser un(a) ${label}. Verifica que subiste el archivo correcto.`
          )
      }
      if (!checks.paymentSheet.valid)
        wrongTypeWarn("paymentSheet", "Planilla", text.paymentSheet)
      if (!checks.arl.valid) wrongTypeWarn("arl", "ARL", text.arl)
      if (!checks.contract.valid)
        wrongTypeWarn("contract", "Contrato", text.contract)
      if (checks.contract2 && !checks.contract2.valid)
        wrongTypeWarn("contract2", "Contrato 2", text.contract2)
      if (checks.activityReport && !checks.activityReport.valid)
        wrongTypeWarn("activityReport", "Informe", text.activityReport)

      // ── Collect results ──────────────────────────────────────────────────
      const collect = <T extends Record<string, unknown>>(
        result: PromiseSettledResult<{
          data: T | null
          scanned: boolean
          validationError?: string
        }>,
        docKey: string,
        docLabel: string,
        sourceText: string
      ): T | null => {
        if (result.status === "rejected") {
          warnings.push(`${docLabel} — error de extracción: ${result.reason}`)
          return null
        }
        const { data, scanned, validationError } = result.value
        if (data) {
          confidence[docKey] = buildConfidence(data)
          return denull(data)
        }
        if (sourceText.trim().length === 0) return null
        if (scanned) {
          warnings.push(
            `${docLabel} — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?).`
          )
        } else if (validationError) {
          warnings.push(
            `${docLabel} — la IA no logró extraer datos válidos. Ingresa los valores manualmente.`
          )
        }
        return null
      }

      const paymentSheet = collect<PaymentSheetExtracted>(
        r0,
        "paymentSheet",
        "Planilla",
        text.paymentSheet
      )
      const arl = collect<ARLExtracted>(r1, "arl", "ARL", text.arl)
      const contract = collect<ContractExtracted>(
        r2,
        "contract",
        "Contrato",
        text.contract
      )
      const contract2 = collect<ContractExtracted>(
        r3,
        "contract2",
        "Contrato 2",
        text.contract2
      )
      const activityReport = collect<ActivityReportExtracted>(
        r4,
        "activityReport",
        "Informe",
        text.activityReport
      )
      const paymentSheet2 = collect<PaymentSheetExtracted>(
        r5,
        "paymentSheet2",
        "Planilla (mes siguiente)",
        text.paymentSheet2
      )

      // ── Format-level downgrades (schema is permissive; we flag invalid here) ─
      const DMY_RE = /^\d{2}\/\d{2}\/\d{4}$/
      const PERIOD_RE = /^(0[1-9]|1[0-2])\/\d{4}$/
      const flagFormat = (
        docKey: string,
        field: string,
        value: string | undefined | null,
        re: RegExp,
        label: string,
        formatLabel: string
      ) => {
        if (!value) return
        if (!re.test(value)) {
          warnings.push(
            `${label} — el campo "${field}" tiene un formato no estándar ("${value}"). Debe ser ${formatLabel}.`
          )
          downgrade(confidence, docKey, field)
        }
      }
      flagFormat("paymentSheet", "paymentDate", paymentSheet?.paymentDate, DMY_RE, "Planilla", "DD/MM/YYYY")
      flagFormat("paymentSheet", "paymentDeadline", paymentSheet?.paymentDeadline, DMY_RE, "Planilla", "DD/MM/YYYY")
      flagFormat("paymentSheet", "period", paymentSheet?.period, PERIOD_RE, "Planilla", "MM/YYYY")
      flagFormat("arl", "startDate", arl?.startDate, DMY_RE, "ARL", "DD/MM/YYYY")
      flagFormat("arl", "endDate", arl?.endDate, DMY_RE, "ARL", "DD/MM/YYYY")
      // Document number length (5-12 digits)
      const flagDocLen = (docKey: string, value: string | undefined | null, label: string) => {
        if (!value) return
        if (value.length < 5 || value.length > 12) {
          warnings.push(
            `${label} — el documento "${value}" no parece válido (debe tener 5-12 dígitos).`
          )
          downgrade(confidence, docKey, "documentNumber")
        }
      }
      flagDocLen("paymentSheet", paymentSheet?.documentNumber, "Planilla")
      flagDocLen("arl", arl?.documentNumber, "ARL")
      flagDocLen("contract", contract?.documentNumber, "Contrato")
      // Sheet number length (6-16 digits)
      if (paymentSheet?.sheetNumber) {
        const len = paymentSheet.sheetNumber.length
        if (len < 6 || len > 16) {
          warnings.push(
            `Planilla — el número de planilla "${paymentSheet.sheetNumber}" tiene una longitud poco común (esperado 6-16 dígitos).`
          )
          downgrade(confidence, "paymentSheet", "sheetNumber")
        }
      }

      // ── Soft sanity warnings (do NOT block extraction) ───────────────────
      // Each warning that targets a specific field also downgrades its
      // confidence from "high" to "medium" so the UI flags it.
      if (paymentSheet?.contractorName && looksLikeCompany(paymentSheet.contractorName)) {
        warnings.push(
          `Planilla — el nombre "${paymentSheet.contractorName}" parece de una empresa u operador. Verifica que sea el cotizante.`
        )
        downgrade(confidence, "paymentSheet", "contractorName")
      }
      if (arl?.contractorName && looksLikeCompany(arl.contractorName)) {
        warnings.push(
          `ARL — el nombre "${arl.contractorName}" parece de una empresa o ARL. Verifica que sea el afiliado.`
        )
        downgrade(confidence, "arl", "contractorName")
      }
      if (contract?.contractorName && looksLikeCompany(contract.contractorName)) {
        warnings.push(
          `Contrato — el nombre "${contract.contractorName}" parece de una entidad. Verifica que sea el contratista.`
        )
        downgrade(confidence, "contract", "contractorName")
      }
      if (arl?.riskClass && arl.cotizationRate) {
        const want = VALID_RATE_BY_RISK[arl.riskClass]
        if (want && Math.abs(arl.cotizationRate - want) > 0.01) {
          warnings.push(
            `ARL — la tasa ${arl.cotizationRate}% no corresponde a la clase de riesgo ${arl.riskClass} (esperado ${want}%).`
          )
          downgrade(confidence, "arl", "cotizationRate")
          downgrade(confidence, "arl", "riskClass")
        }
      }
      if (arl?.startDate && arl?.endDate) {
        const s = parseDMY(arl.startDate)
        const e = parseDMY(arl.endDate)
        if (s && e && s > e) {
          warnings.push(
            `ARL — fecha de fin (${arl.endDate}) es anterior a la de inicio (${arl.startDate}).`
          )
          downgrade(confidence, "arl", "endDate")
        }
      }
      if (paymentSheet?.paymentDate && paymentSheet?.paymentDeadline) {
        const p = parseDMY(paymentSheet.paymentDate)
        const dl = parseDMY(paymentSheet.paymentDeadline)
        if (p && dl && p > dl) {
          warnings.push(
            `Planilla — fecha de pago (${paymentSheet.paymentDate}) es posterior a la fecha límite (${paymentSheet.paymentDeadline}).`
          )
          downgrade(confidence, "paymentSheet", "paymentDeadline")
        }
      }

      // ── ARL expedition-date check (30 days max) ──────────────────────────
      // Solo aplica cuando hay texto extraído. Para PDFs vía OCR, esta
      // validación no es viable porque no tenemos el texto del certificado.
      if (text.arl.trim().length > 0) {
        const exp = extractExpeditionDate(text.arl)
        if (exp) {
          const days = daysSince(exp)
          if (days !== null && days > 30) {
            warnings.push(
              `ARL — el certificado fue expedido hace ${days} días (${exp}). Debe tener menos de 30 días.`
            )
          }
        }
      }

      // ── Cross-doc name consistency ───────────────────────────────────────
      if (
        paymentSheet?.contractorName &&
        arl?.contractorName &&
        contract?.contractorName
      ) {
        const np = normalizeName(paymentSheet.contractorName)
        const na = normalizeName(arl.contractorName)
        const nc = normalizeName(contract.contractorName)
        if (nameOverlap(np, na) === 0) {
          warnings.push(
            `Posible error: el nombre en la planilla ("${paymentSheet.contractorName}") no coincide con el de la ARL ("${arl.contractorName}").`
          )
          downgrade(confidence, "paymentSheet", "contractorName")
          downgrade(confidence, "arl", "contractorName")
        }
        if (nameOverlap(np, nc) === 0) {
          warnings.push(
            `Posible error: el nombre en la planilla ("${paymentSheet.contractorName}") no coincide con el del contrato ("${contract.contractorName}").`
          )
          downgrade(confidence, "paymentSheet", "contractorName")
          downgrade(confidence, "contract", "contractorName")
        }
      }

      // ── Result ───────────────────────────────────────────────────────────
      // The schemas allow nulls (LLM can opt out of guessing), but the
      // canonical ExtractedData types are non-nullable. `denull` already
      // converted nulls to "" / 0 / null-on-paymentDeadline at collect time,
      // so the runtime shape matches — cast to satisfy the type system.
      const data = {
        paymentSheet,
        arl,
        contract,
        ...(contract2 ? { contract2 } : {}),
        ...(paymentSheet2 ? { paymentSheet2 } : {}),
        ...(activityReport ? { activityReport } : {}),
      } as unknown as ExtractedData

      send({
        type: "result",
        data,
        warnings,
        issuerKeys: {},
        confidence,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido en extracción."
      send({
        type: "error",
        message: "Falló la extracción estructurada con IA.",
        details: message,
      })
    } finally {
      try {
        writer.close()
      } catch {
        /* already closed */
      }
    }
  })()

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
