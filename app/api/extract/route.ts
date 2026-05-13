import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { generateWithFallback, snapshotProviders } from "@/lib/ai/client"
import type { OnProviderProgress, ProviderEntry } from "@/lib/ai/client"
import { extractWithValidation } from "@/lib/ai/extraction"
import { ARLSchema } from "@/lib/schemas/arl"
import { ContractSchema } from "@/lib/schemas/contract"
import { PaymentSheetSchema } from "@/lib/schemas/payment-sheet"
import { ActivityReportSchema } from "@/lib/schemas/activity-report"
import type { ARLExtracted } from "@/lib/schemas/arl"
import type { ContractExtracted } from "@/lib/schemas/contract"
import type { PaymentSheetExtracted } from "@/lib/schemas/payment-sheet"
import type { ActivityReportExtracted } from "@/lib/schemas/activity-report"
import {
  extractARLCandidates,
  extractARLExpeditionDate,
  extractPILACandidates,
  extractContractCandidates,
  extractActivityReportCandidates,
  extractDocumentTypeFromPILA,
  detectIssuer,
  joinSplitDates,
} from "@/lib/pdf/parsers/keyword-extractor"
import { isDocumentMatch } from "@/lib/pdf/document-validator"
import {
  fillFromCandidates,
  computeConfidence,
} from "@/lib/pdf/extract-helpers"
import {
  checkPaymentSheet,
  checkARL,
  checkContract,
  downgradeConfidence,
} from "@/lib/pdf/sanity-checks"
import { CONTRACT_TYPES_PROMPT } from "@/lib/constants/contracts"
import {
  PILA_ISSUER_INSTRUCTIONS,
  ARL_ISSUER_INSTRUCTIONS,
} from "@/lib/constants/issuer-instructions"
import type { ExtractedData, RawPDFText, ConfidenceMap } from "@/lib/types"
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

// ─── Profile hint shape (sent by the client) ─────────────────────────────────

interface ProfileHint {
  docType: string
  issuer: string
  example: Record<string, unknown>
}

const ProfileHintSchema = z.object({
  docType: z.string(),
  issuer: z.string(),
  example: z.record(z.string(), z.unknown()),
})

const ExtractRequestSchema = z.object({
  rawText: z.object({
    paymentSheet: z.string().optional(),
    arl: z.string().optional(),
    contract: z.string().optional(),
    contract2: z.string().optional(),
    paymentSheet2: z.string().optional(),
    activityReport: z.string().optional(),
  }),
  profiles: z.array(ProfileHintSchema).default([]),
})

const MAX_JSON_BYTES = 6 * 1024 * 1024 // 6 MB
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 10

// ─── Request parsing ──────────────────────────────────────────────────────────

async function parseRequest(
  request: NextRequest
): Promise<{ rawText: RawPDFText; profiles: ProfileHint[] }> {
  const body = await request.json()
  const parsed = ExtractRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error("El body debe incluir rawText con el formato esperado.")
  }
  return { rawText: parsed.data.rawText, profiles: parsed.data.profiles }
}

function findProfile(
  profiles: ProfileHint[],
  docType: string,
  issuer: string
): Record<string, unknown> | undefined {
  return profiles.find((p) => p.docType === docType && p.issuer === issuer)
    ?.example
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

  let rawText: RawPDFText
  let profiles: ProfileHint[]
  let obligationsHint: string[] = []
  let paymentRequestPeriod: string | undefined
  let contractCount: "1" | "2" | undefined
  let involvedContracts: "1" | "2" | "Ambos" | undefined

  try {
    const body = await request.json()
    rawText = body.rawText
    profiles = body.profiles || []
    obligationsHint = body.obligationsHint || []
    paymentRequestPeriod =
      typeof body.paymentRequestPeriod === "string"
        ? body.paymentRequestPeriod
        : undefined
    contractCount =
      body.contractCount === "1" || body.contractCount === "2"
        ? body.contractCount
        : undefined
    involvedContracts =
      body.involvedContracts === "1" ||
      body.involvedContracts === "2" ||
      body.involvedContracts === "Ambos"
        ? body.involvedContracts
        : undefined
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la solicitud."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  const send = (event: ExtractionStreamEvent) => {
    try {
      writer.write(encoder.encode(JSON.stringify(event) + "\n"))
    } catch {
      // stream already closed (client disconnected)
    }
  }

  ;(async () => {
    try {
      const cleanText = {
        paymentSheet: joinSplitDates(rawText.paymentSheet ?? ""),
        arl: joinSplitDates(rawText.arl ?? ""),
        contract: joinSplitDates(rawText.contract ?? ""),
        contract2: joinSplitDates(rawText.contract2 ?? ""),
        paymentSheet2: joinSplitDates(rawText.paymentSheet2 ?? ""),
        activityReport: joinSplitDates(rawText.activityReport ?? ""),
      }

      const issuerKeys = {
        paymentSheet: detectIssuer(cleanText.paymentSheet, "pila"),
        arl: detectIssuer(cleanText.arl, "arl"),
        contract: "unal",
        contract2: cleanText.contract2 ? "unal" : undefined,
        paymentSheet2: cleanText.paymentSheet2
          ? detectIssuer(cleanText.paymentSheet2, "pila")
          : undefined,
      }

      const pilaCandidate = extractPILACandidates(cleanText.paymentSheet)
      const arlCandidate = extractARLCandidates(cleanText.arl)
      const contractCand = extractContractCandidates(cleanText.contract)
      const contract2Cand = cleanText.contract2
        ? extractContractCandidates(cleanText.contract2)
        : null
      const reportCand = cleanText.activityReport
        ? extractActivityReportCandidates(cleanText.activityReport)
        : null
      const ps2Candidate = cleanText.paymentSheet2
        ? extractPILACandidates(cleanText.paymentSheet2)
        : null

      // The PILA shows the contractor's own document type unambiguously.
      // Override whatever the contract extractor guessed — the contract always
      // contains UNAL's NIT and other NITs which cause false positives.
      const pilaDocumentType = extractDocumentTypeFromPILA(
        cleanText.paymentSheet
      )
      contractCand.documentType = pilaDocumentType
      if (contract2Cand) contract2Cand.documentType = pilaDocumentType
      // Document type for both payment sheets should be the same

      // Validate that each PDF is the expected document type before calling the AI.
      const docChecks = {
        paymentSheet: isDocumentMatch(cleanText.paymentSheet, "pila"),
        arl: isDocumentMatch(cleanText.arl, "arl"),
        contract: isDocumentMatch(cleanText.contract, "contract"),
        contract2: cleanText.contract2
          ? isDocumentMatch(cleanText.contract2, "contract")
          : null,
        activityReport: cleanText.activityReport
          ? isDocumentMatch(cleanText.activityReport, "report")
          : null,
        paymentSheet2: cleanText.paymentSheet2
          ? isDocumentMatch(cleanText.paymentSheet2, "pila")
          : null,
      }

      // Snapshot providers ONCE so all parallel extractions start from the same
      // provider (devstral first) instead of each advancing the index independently.
      const snapshot = snapshotProviders()

      // Helper: wraps model-level progress into doc-level stream events
      const makeOnProgress =
        (doc: string): OnProviderProgress =>
        (type, model) => {
          send({ type, doc, model } as ExtractionStreamEvent)
        }

      const pilaIssuerHint =
        PILA_ISSUER_INSTRUCTIONS[issuerKeys.paymentSheet] ?? ""
      const arlIssuerHint = ARL_ISSUER_INSTRUCTIONS[issuerKeys.arl] ?? ""

      // If the user told us which period they're billing, tell the AI to prefer
      // that period when the planilla contains multiple (case "Varias Planillas").
      const periodHint = paymentRequestPeriod
        ? `\n\nContexto: el contratista solicita el pago del período ${paymentRequestPeriod}. ` +
          `Si la planilla contiene MÚLTIPLES períodos cotizados, elige el que coincide con ${paymentRequestPeriod} ` +
          `(o el más cercano si no existe exacto). NUNCA tomes el primero por defecto cuando hay varios.`
        : ""

      // When the contractor has two contracts and the ARL shows coverage for
      // BOTH (case "ARL Doble"), tell the AI which row to use for dates.
      const arlDoubleHint =
        contractCount === "2" && involvedContracts && involvedContracts !== "Ambos"
          ? `\n\nContexto: el contratista tiene DOS contratos y este pago corresponde al Contrato ${involvedContracts}. ` +
            `Si el certificado ARL muestra COBERTURAS para múltiples contratos (varias filas con fechas distintas), ` +
            `extrae las fechas de inicio/fin de la fila correspondiente al contrato ${involvedContracts} ` +
            `(usualmente identificable por el número de OPS/OSE o las fechas que coinciden con ese contrato).`
          : contractCount === "2" && involvedContracts === "Ambos"
            ? `\n\nContexto: el contratista tiene DOS contratos activos y se cobran AMBOS en este período. ` +
              `Si el ARL muestra dos coberturas, usa la fecha de inicio MÁS TEMPRANA y la fecha de fin MÁS TARDÍA ` +
              `para cubrir todo el rango.`
            : ""

      const [r0, r1, r2, r3, r4, r5] = await Promise.allSettled([
        docChecks.paymentSheet.valid
          ? extractWithValidation<PaymentSheetExtracted>({
              text: cleanText.paymentSheet,
              schema: PaymentSheetSchema,
              docLabel: "Planilla PILA de seguridad social",
              candidates: pilaCandidate,
              profileExample: findProfile(
                profiles,
                "pila",
                issuerKeys.paymentSheet
              ),
              snapshot,
              extraInstructions:
                "IMPORTANTE — contractorName es el nombre de la PERSONA NATURAL que cotiza (nunca el nombre del operador de planilla, nunca una empresa, nunca 'Universidad Nacional de Colombia').\n\n" +
                "Reglas generales:\n" +
                "1. sheetNumber: si el candidato tiene varios números separados por ' / ' (tablas SOI/Aportes en Línea con múltiples filas), " +
                "elige el que corresponda al contratista (cruza con su CC/NIT). Si no puedes determinarlo, usa el último. " +
                "En SOI, el número de planilla tiene 10 dígitos y va DESPUÉS de la Clave Pago (8-9 dígitos) — no confundas los dos. " +
                "Para Simple S.A., el número de planilla es la 'Referencia de Pago' que aparece en la sección 'Información de la Planilla Pagada'.\n" +
                "2. period: extrae el mes cotizado en formato MM/YYYY. Puede aparecer como 'marzo de 2026' (→ 03/2026), 'YYYY-MM' (→ MM/YYYY), o MM/YYYY directamente. No lo deduzcas de paymentDate.\n" +
                "3. paymentDate: fecha en que se realizó el pago (DD/MM/YYYY). Puede aparecer como 'PAGADO DD/MM/YYYY' o 'Fecha de pago: YYYY-MM-DD'. Convierte siempre a DD/MM/YYYY.\n" +
                "4. paymentDeadline: fecha límite de pago (DD/MM/YYYY); si parece invertida con paymentDate, corrígela (paymentDeadline ≥ paymentDate).\n" +
                "5. contractorName y documentNumber: búscalos en la sección de 'Datos del Cotizante', 'Información General', o en la primera línea con CC/NIT." +
                (pilaIssuerHint ? `\n\nInstrucciones específicas del formato:\n${pilaIssuerHint}` : "") +
                periodHint,
              onProgress: makeOnProgress("paymentSheet"),
            })
          : Promise.resolve(null),
        docChecks.arl.valid
          ? extractWithValidation<ARLExtracted>({
              text: cleanText.arl,
              schema: ARLSchema,
              docLabel: "Certificado de afiliación ARL",
              candidates: arlCandidate,
              profileExample: findProfile(profiles, "arl", issuerKeys.arl),
              snapshot,
              extraInstructions:
                "IMPORTANTE — contractorName es el nombre de la PERSONA NATURAL afiliada (el trabajador independiente). " +
                "NUNCA uses el nombre de la ARL (Sura, Positiva, Colmena, etc.), NUNCA 'Universidad Nacional de Colombia', NUNCA el nombre del tomador o empresa.\n\n" +
                "Reglas para fechas:\n" +
                "1. Si el documento tiene las etiquetas 'Fecha inicio contrato' y/o 'Fecha fin contrato' " +
                "(o variantes como 'Fecha de inicio contrato', 'Fecha de fin contrato'), " +
                "SIEMPRE usa ESAS fechas para startDate y endDate. " +
                "NO uses la 'Fecha de inicio de cobertura' ni la 'Fecha de inicio de afiliación' en ese caso.\n" +
                "2. Solo si el documento NO tiene etiquetas de 'contrato', usa la fecha de inicio/fin de cobertura o afiliación.\n" +
                "3. El candidato startDate ya fue calculado priorizando las fechas de contrato — confía en él si es no nulo.\n" +
                "4. riskClass: clase de riesgo (I, II, III, IV, V). Cruza con la tasa: 0.522%=I, 1.044%=II, 2.436%=III, 4.350%=IV, 6.960%=V." +
                (arlIssuerHint ? `\n\nInstrucciones específicas del formato:\n${arlIssuerHint}` : "") +
                arlDoubleHint,
              onProgress: makeOnProgress("arl"),
            })
          : Promise.resolve(null),
        docChecks.contract.valid
          ? extractWithValidation<ContractExtracted>({
              text: cleanText.contract,
              schema: ContractSchema,
              docLabel: "Contrato UNAL (contrato 1)",
              candidates: contractCand,
              profileExample: findProfile(profiles, "contract", "unal"),
              snapshot,
              extraInstructions:
                `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES_PROMPT}. ` +
                "Reglas adicionales:\n" +
                "1. NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.\n" +
                "2. specificObligations: Busca la sección 'OBLIGACIONES ESPECÍFICAS DEL CONTRATISTA' y extrae cada obligación enumerada como un elemento del array. Usa el texto lo más fiel posible.",
              onProgress: makeOnProgress("contract"),
            })
          : Promise.resolve(null),
        docChecks.contract2?.valid
          ? extractWithValidation<ContractExtracted>({
              text: cleanText.contract2,
              schema: ContractSchema,
              docLabel: "Contrato UNAL (contrato 2)",
              candidates: contract2Cand ?? {},
              profileExample: findProfile(profiles, "contract", "unal"),
              snapshot,
              extraInstructions:
                `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES_PROMPT}. ` +
                "Reglas adicionales:\n" +
                "1. NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.\n" +
                "2. specificObligations: Busca la sección 'OBLIGACIONES ESPECÍFICAS DEL CONTRATISTA' y extrae cada obligación enumerada como un elemento del array. Usa el texto lo más fiel posible.",
              onProgress: makeOnProgress("contract2"),
            })
          : Promise.resolve(null),
        docChecks.activityReport?.valid
          ? extractWithValidation<ActivityReportExtracted>({
              text: cleanText.activityReport,
              schema: ActivityReportSchema,
              docLabel: "Informe de actividades",
              candidates: reportCand ?? {},
              snapshot,
              extraInstructions:
                "Reglas para el Informe de Actividades:\n" +
                "1. La tabla de actividades suele tener muchos items (ej. del 1 al 13) y puede extenderse por MUCHAS PÁGINAS. Debes extraer TODOS los items de todas las páginas.\n" +
                "2. Para el campo 'activityDescription', usa ÚNICAMENTE el texto de la columna 'OBLIGACIÓN ESPECÍFICA' (Incluir cada obligación tal como se pactó en la OPS). IGNORA la columna 'ACTIVIDADES EJECUTADAS'.\n" +
                "3. Asegúrate de capturar los valores numéricos de '% periodo' y '% acumulado' para cada fila.\n" +
                "4. isSigned: busca evidencias de firma al final del documento (página final).\n" +
                (obligationsHint.length > 0
                  ? `\nNOTA: El contrato tiene estas obligaciones, búscalas exactamente en el reporte:\n${obligationsHint.map((o) => `- ${o}`).join("\n")}`
                  : ""),
              onProgress: makeOnProgress("activityReport"),
            })
          : Promise.resolve(null),
        docChecks.paymentSheet2?.valid
          ? extractWithValidation<PaymentSheetExtracted>({
              text: cleanText.paymentSheet2,
              schema: PaymentSheetSchema,
              docLabel: "Planilla PILA (mes siguiente)",
              candidates: ps2Candidate ?? {},
              profileExample: findProfile(
                profiles,
                "pila",
                issuerKeys.paymentSheet2 || ""
              ),
              snapshot,
              extraInstructions:
                "Extrae los datos de la planilla del MES SIGUIENTE al de la primera planilla. " +
                "Esta planilla debe ser cronológicamente posterior. " +
                "Aplica las mismas reglas de extracción que en la primera planilla " +
                "(contractorName es persona natural, sheetNumber 6-16 dígitos, period MM/YYYY, paymentDate DD/MM/YYYY).",
              onProgress: makeOnProgress("paymentSheet2"),
            })
          : Promise.resolve(null),
      ])

      const warnings: string[] = []
      const confidence: Record<string, ConfidenceMap> = {}

      // Warn immediately for documents that don't match the expected type.
      if (
        !docChecks.paymentSheet.valid &&
        cleanText.paymentSheet.trim().length > 0
      )
        warnings.push(
          `Planilla — el PDF no parece ser una ${docChecks.paymentSheet.label}. Verifica que subiste el archivo correcto.`
        )
      if (!docChecks.arl.valid && cleanText.arl.trim().length > 0)
        warnings.push(
          `ARL — el PDF no parece ser un ${docChecks.arl.label}. Verifica que subiste el archivo correcto.`
        )
      if (!docChecks.contract.valid && cleanText.contract.trim().length > 0)
        warnings.push(
          `Contrato — el PDF no parece ser un ${docChecks.contract.label}. Verifica que subiste el archivo correcto.`
        )
      if (
        docChecks.contract2 &&
        !docChecks.contract2.valid &&
        cleanText.contract2.trim().length > 0
      )
        warnings.push(
          `Contrato 2 — el PDF no parece ser un ${docChecks.contract2.label}. Verifica que subiste el archivo correcto.`
        )
      if (
        docChecks.activityReport &&
        !docChecks.activityReport.valid &&
        cleanText.activityReport.trim().length > 0
      )
        warnings.push(
          `Informe — el PDF no parece ser un ${docChecks.activityReport.label}. Verifica que subiste el archivo correcto.`
        )

      const aiPS =
        r0.status === "fulfilled"
          ? (r0.value as Record<string, unknown> | null)
          : null
      const aiARL =
        r1.status === "fulfilled"
          ? (r1.value as Record<string, unknown> | null)
          : null
      const aiC1 =
        r2.status === "fulfilled"
          ? (r2.value as Record<string, unknown> | null)
          : null
      const aiC2 =
        r3.status === "fulfilled"
          ? (r3.value as Record<string, unknown> | null)
          : null
      const aiReport =
        r4.status === "fulfilled"
          ? (r4.value as Record<string, unknown> | null)
          : null
      const aiPS2 =
        r5.status === "fulfilled"
          ? (r5.value as Record<string, unknown> | null)
          : null

      const psRaw = fillFromCandidates(
        aiPS,
        pilaCandidate as Record<string, unknown>
      )
      const paymentSheet = psRaw as PaymentSheetExtracted | null
      if (r0.status === "rejected") {
        warnings.push(`Planilla — error de extracción: ${r0.reason}`)
      } else if (!aiPS) {
        const len = cleanText.paymentSheet.trim().length
        warnings.push(
          len === 0
            ? "Planilla — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
            : `Planilla — el documento tiene muy poco texto extraíble (${len} caracteres). Podría ser un escaneo; intenta con uno más legible.`
        )
      } else {
        if (!psRaw?.sheetNumber)
          warnings.push("Planilla — número de planilla no encontrado")
        if (!psRaw?.paymentDate)
          warnings.push("Planilla — fecha de pago no encontrada")
        if (!psRaw?.period)
          warnings.push("Planilla — período de cotización no encontrado")
      }
      if (psRaw)
        confidence.paymentSheet = computeConfidence(
          pilaCandidate as Record<string, unknown>,
          psRaw
        )

      const ps2Raw = fillFromCandidates(
        aiPS2,
        ps2Candidate as Record<string, unknown>
      )
      const paymentSheet2 = ps2Raw as PaymentSheetExtracted | null
      if (r5.status === "rejected" && cleanText.paymentSheet2)
        warnings.push(`Planilla 2 — error de extracción: ${r5.reason}`)
      if (ps2Raw)
        confidence.paymentSheet2 = computeConfidence(
          ps2Candidate as Record<string, unknown>,
          ps2Raw
        )

      const arlRaw = fillFromCandidates(
        aiARL,
        arlCandidate as Record<string, unknown>
      )
      const arl = arlRaw as ARLExtracted | null
      if (r1.status === "rejected") {
        warnings.push(`ARL — error de extracción: ${r1.reason}`)
      } else if (!aiARL) {
        const len = cleanText.arl.trim().length
        warnings.push(
          len === 0
            ? "ARL — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
            : `ARL — el documento tiene muy poco texto extraíble (${len} caracteres). Podría ser un escaneo; verifica su legibilidad.`
        )
      } else {
        if (!arlRaw?.startDate)
          warnings.push("ARL — fecha de inicio de cobertura no encontrada")
        if (!arlRaw?.endDate)
          warnings.push("ARL — fecha de fin de cobertura no encontrada")
      }
      if (arlRaw)
        confidence.arl = computeConfidence(
          arlCandidate as Record<string, unknown>,
          arlRaw
        )

      // ── ARL additional validations ────────────────────────────────────────
      if (cleanText.arl.trim().length > 0) {
        // 1. Verify UNAL is the employer
        if (
          !cleanText.arl
            .toLowerCase()
            .includes("universidad nacional de colombia")
        ) {
          warnings.push(
            "ARL — no se encontró 'Universidad Nacional de Colombia' como entidad contratante. Verifica que el certificado corresponda al contrato UNAL."
          )
        }

        // 2. Certificate must be issued within the last 30 days
        const expedDate = extractARLExpeditionDate(cleanText.arl)
        if (expedDate) {
          const [d, m, y] = expedDate.split("/").map(Number)
          const issued = new Date(y, m - 1, d)
          const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
          )
          today.setHours(0, 0, 0, 0)
          const diffDays = Math.floor(
            (today.getTime() - issued.getTime()) / 86_400_000
          )
          if (diffDays > 30) {
            warnings.push(
              `ARL — el certificado fue expedido hace ${diffDays} días (${expedDate}). Debe tener menos de 30 días de antigüedad.`
            )
          }
        }
      }

      const c1Raw = fillFromCandidates(
        aiC1,
        contractCand as Record<string, unknown>
      )
      const contract = c1Raw as ContractExtracted | null
      if (r2.status === "rejected") {
        warnings.push(`Contrato — error de extracción: ${r2.reason}`)
      } else if (!aiC1) {
        const len = cleanText.contract.trim().length
        warnings.push(
          len === 0
            ? "Contrato — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
            : `Contrato — el texto extraído es inusualmente corto (${len} caracteres). Podría estar incompleto o ser un escaneo.`
        )
      } else {
        if (!c1Raw?.orderNumber)
          warnings.push("Contrato — número de orden no encontrado")
        if (!c1Raw?.documentNumber)
          warnings.push("Contrato — número de documento no encontrado")
      }
      if (c1Raw)
        confidence.contract = computeConfidence(
          contractCand as Record<string, unknown>,
          c1Raw
        )

      const c2Candidates = (contract2Cand ?? {}) as Record<string, unknown>
      const c2Raw = fillFromCandidates(aiC2, c2Candidates)
      const contract2 = c2Raw as ContractExtracted | null
      if (r3.status === "rejected" && cleanText.contract2)
        warnings.push(`Contrato 2 — error de extracción: ${r3.reason}`)
      else if (
        r3.status === "fulfilled" &&
        !aiC2 &&
        cleanText.contract2.trim().length > 0
      )
        warnings.push("Contrato 2 — la IA no pudo interpretar el documento")
      if (c2Raw) confidence.contract2 = computeConfidence(c2Candidates, c2Raw)

      const reportCandidates = (reportCand ?? {}) as Record<string, unknown>
      const reportRaw = fillFromCandidates(aiReport, reportCandidates)
      const activityReport = reportRaw as ActivityReportExtracted | null
      if (r4.status === "rejected" && cleanText.activityReport)
        warnings.push(`Informe — error de extracción: ${r4.reason}`)
      else if (
        r4.status === "fulfilled" &&
        !aiReport &&
        cleanText.activityReport.trim().length > 0
      )
        warnings.push("Informe — la IA no pudo interpretar el documento")
      if (reportRaw)
        confidence.activityReport = computeConfidence(
          reportCandidates,
          reportRaw
        )

      // ── Per-field sanity checks ──────────────────────────────────────────────
      // Validate each extracted value makes sense for its field. Mismatches
      // (e.g. insurer name in contractorName) produce specific warnings and
      // downgrade that field's confidence so the UI flags it for manual review.
      const sanityResults = [
        checkPaymentSheet(paymentSheet),
        checkARL(arl),
        checkContract(contract, "Contrato"),
        ...(contract2 ? [checkContract(contract2, "Contrato 2")] : []),
        ...(paymentSheet2 ? [checkPaymentSheet(paymentSheet2)] : []),
      ]
      for (const result of sanityResults) {
        warnings.push(...result.warnings)
        downgradeConfidence(confidence, result.lowConfidenceFields)
      }

      // ── Cross-document name consistency check ────────────────────────────────
      // Compares contractorName across documents. A significant mismatch usually
      // means the extractor picked up the wrong person's name (e.g., insurer name
      // instead of contractor name, or a different person's data).
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z\s]/g, "")
          .trim()

      const names = {
        planilla: normalize(paymentSheet?.contractorName ?? ""),
        arl: normalize(arl?.contractorName ?? ""),
        contract: normalize(contract?.contractorName ?? ""),
      }

      // Only validate when all three names are non-empty
      if (names.planilla && names.arl && names.contract) {
        // Tokenize and count shared words (ignoring short words like "de", "la")
        const tokens = (s: string) =>
          s.split(/\s+/).filter((w) => w.length > 2)
        const overlap = (a: string, b: string) => {
          const ta = new Set(tokens(a))
          const tb = tokens(b)
          return tb.filter((w) => ta.has(w)).length
        }
        const pilaArlMatch = overlap(names.planilla, names.arl)
        const pilaContractMatch = overlap(names.planilla, names.contract)

        if (pilaArlMatch === 0) {
          warnings.push(
            `Posible error de extracción: el nombre en la planilla ("${paymentSheet?.contractorName}") no coincide con el nombre en la ARL ("${arl?.contractorName}"). Verifica que ambos correspondan al mismo contratista.`
          )
        }
        if (pilaContractMatch === 0) {
          warnings.push(
            `Posible error de extracción: el nombre en la planilla ("${paymentSheet?.contractorName}") no coincide con el nombre en el contrato ("${contract?.contractorName}"). Verifica que ambos correspondan al mismo contratista.`
          )
        }
      }

      const extractedData: ExtractedData = {
        paymentSheet,
        arl,
        contract,
        ...(contract2 ? { contract2 } : {}),
        ...(paymentSheet2 ? { paymentSheet2 } : {}),
        ...(activityReport ? { activityReport } : {}),
      }

      const finalIssuers: Record<string, string> = {}
      if (issuerKeys.paymentSheet)
        finalIssuers.paymentSheet = issuerKeys.paymentSheet
      if (issuerKeys.arl) finalIssuers.arl = issuerKeys.arl
      if (issuerKeys.contract) finalIssuers.contract = issuerKeys.contract
      if (issuerKeys.contract2) finalIssuers.contract2 = issuerKeys.contract2
      if (issuerKeys.paymentSheet2)
        finalIssuers.paymentSheet2 = issuerKeys.paymentSheet2

      send({
        type: "result",
        data: extractedData,
        warnings,
        issuerKeys: finalIssuers,
        confidence,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error desconocido al extraer datos con IA."
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
