import { NextRequest, NextResponse } from "next/server"
import { Output } from "ai"
import type { ZodType } from "zod"

import { generateWithFallback, snapshotProviders } from "@/lib/ai/client"
import type { OnProviderProgress, ProviderEntry } from "@/lib/ai/client"
import { ARLSchema } from "@/lib/schemas/arl"
import { ContractSchema } from "@/lib/schemas/contract"
import { PaymentSheetSchema } from "@/lib/schemas/payment-sheet"
import type { ARLExtracted } from "@/lib/schemas/arl"
import type { ContractExtracted } from "@/lib/schemas/contract"
import type { PaymentSheetExtracted } from "@/lib/schemas/payment-sheet"
import {
  extractARLCandidates,
  extractPILACandidates,
  extractContractCandidates,
  detectIssuer,
  joinSplitDates,
} from "@/lib/pdf/parsers/keyword-extractor"
import {
  smartSlice,
  fillFromCandidates,
  computeConfidence,
} from "@/lib/pdf/extract-helpers"
import { CONTRACT_TYPES_PROMPT } from "@/lib/constants/contracts"
import type { ExtractedData, RawPDFText, ConfidenceMap } from "@/lib/types"

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

// ─── Core extraction helper ───────────────────────────────────────────────────

async function extractWithValidation<T>({
  text,
  schema,
  docLabel,
  candidates,
  profileExample,
  extraInstructions,
  onProgress,
  snapshot,
}: {
  text: string
  schema: ZodType<T>
  docLabel: string
  candidates: Record<string, unknown>
  profileExample?: Record<string, unknown>
  extraInstructions?: string
  onProgress?: OnProviderProgress
  snapshot?: ProviderEntry[]
}): Promise<T | null> {
  if (!text.trim()) return null

  const profileSection = profileExample
    ? `\nEjemplo de extracción confirmada anteriormente para este mismo emisor:\n${JSON.stringify(profileExample, null, 2)}\n`
    : ""

  const extraSection = extraInstructions ? `\n${extraInstructions}\n` : ""

  const textSnippet = smartSlice(text)

  const prompt = `Estás validando la extracción de un documento: ${docLabel}.

El sistema detectó estos candidatos automáticamente (algunos pueden ser nulos o incorrectos):
${JSON.stringify(candidates, null, 2)}
${profileSection}${extraSection}
Texto del documento:
${textSnippet}

Instrucciones:
- Verifica cada candidato contra el texto real del documento.
- Si un candidato es correcto, mantenlo exactamente igual.
- Si es incorrecto o nulo, corrígelo con el valor real del documento.
- Respeta los formatos del esquema (fechas en DD/MM/YYYY, montos como número sin separadores).
- Si un campo no aparece en el texto y no es requerido, usa el valor por defecto del esquema.`

  try {
    const { output } = await generateWithFallback(
      { output: Output.object({ schema }), prompt },
      onProgress,
      snapshot
    )
    return output
  } catch {
    const { output } = await generateWithFallback(
      {
        output: Output.object({ schema }),
        prompt: `Extrae datos de este documento (${docLabel}) y devuelve el JSON del esquema.\n\nTexto:\n${smartSlice(text, 2500)}`,
      },
      onProgress,
      snapshot
    )
    return output
  }
}

// ─── Request parsing ──────────────────────────────────────────────────────────

async function parseRequest(
  request: NextRequest
): Promise<{ rawText: RawPDFText; profiles: ProfileHint[] }> {
  const body = (await request.json()) as {
    rawText?: RawPDFText
    profiles?: ProfileHint[]
  }
  if (!body.rawText) throw new Error("El body debe incluir rawText.")
  return { rawText: body.rawText, profiles: body.profiles ?? [] }
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
  let rawText: RawPDFText
  let profiles: ProfileHint[]

  try {
    ;({ rawText, profiles } = await parseRequest(request))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la solicitud."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  const send = (event: ExtractionStreamEvent) => {
    writer.write(encoder.encode(JSON.stringify(event) + "\n"))
  }

  ;(async () => {
    try {
      const issuerKeys = {
        paymentSheet: detectIssuer(rawText.paymentSheet, "pila"),
        arl: detectIssuer(rawText.arl, "arl"),
        contract: "unal",
        ...(rawText.contract2 ? { contract2: "unal" } : {}),
      }

      const cleanText = {
        paymentSheet: joinSplitDates(rawText.paymentSheet),
        arl: joinSplitDates(rawText.arl),
        contract: joinSplitDates(rawText.contract),
        contract2: rawText.contract2 ? joinSplitDates(rawText.contract2) : "",
      }

      const pilaCandidate = extractPILACandidates(cleanText.paymentSheet)
      const arlCandidate = extractARLCandidates(cleanText.arl)
      const contractCand = extractContractCandidates(cleanText.contract)
      const contract2Cand = extractContractCandidates(cleanText.contract2)

      // Snapshot providers ONCE so all parallel extractions start from the same
      // provider (devstral first) instead of each advancing the index independently.
      const snapshot = snapshotProviders()

      // Helper: wraps model-level progress into doc-level stream events
      const makeOnProgress =
        (doc: string): OnProviderProgress =>
        (type, model) => {
          send({ type, doc, model } as ExtractionStreamEvent)
        }

      const [r0, r1, r2, r3] = await Promise.allSettled([
        extractWithValidation<PaymentSheetExtracted>({
          text: cleanText.paymentSheet,
          schema: PaymentSheetSchema,
          docLabel: "Planilla PILA de seguridad social",
          candidates: pilaCandidate,
          profileExample: findProfile(profiles, "pila", issuerKeys.paymentSheet),
          snapshot,
          extraInstructions:
            "Reglas críticas: " +
            "(1) sheetNumber: si el candidato contiene varios números separados por ' / ' " +
            "(formato SOI/Aportes en Línea donde hay múltiples filas), elige el número de planilla " +
            "que corresponda al contratista identificado en el documento (cruza con su CC/NIT si aparece). " +
            "Si no puedes determinar cuál es, usa el último de la lista. " +
            "El número de planilla en SOI es de 10 dígitos y aparece DESPUÉS de la 'Clave Pago' (8-9 dígitos) en la tabla. " +
            "NO uses la Clave Pago ni fechas ni montos como número de planilla. " +
            "(2) 'period' es el MES COTIZADO en formato MM/YYYY (ej: '03/2026'), NO el mes de pago; " +
            "es siempre el mes inmediatamente anterior a paymentDate. " +
            "(3) paymentDate es la fecha en que se realizó el pago. " +
            "(4) paymentDeadline es la fecha límite máxima, siempre en el mes siguiente al período. " +
            "Si paymentDate y paymentDeadline parecen invertidos, corrígelos: paymentDeadline ≥ paymentDate.",
          onProgress: makeOnProgress("paymentSheet"),
        }),
        extractWithValidation<ARLExtracted>({
          text: cleanText.arl,
          schema: ARLSchema,
          docLabel: "Certificado de afiliación ARL",
          candidates: arlCandidate,
          profileExample: findProfile(profiles, "arl", issuerKeys.arl),
          snapshot,
          onProgress: makeOnProgress("arl"),
        }),
        extractWithValidation<ContractExtracted>({
          text: cleanText.contract,
          schema: ContractSchema,
          docLabel: "Contrato UNAL (contrato 1)",
          candidates: contractCand,
          profileExample: findProfile(profiles, "contract", "unal"),
          snapshot,
          extraInstructions:
            `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES_PROMPT}. ` +
            "NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.",
          onProgress: makeOnProgress("contract"),
        }),
        extractWithValidation<ContractExtracted>({
          text: cleanText.contract2,
          schema: ContractSchema,
          docLabel: "Contrato UNAL (contrato 2)",
          candidates: contract2Cand,
          profileExample: findProfile(profiles, "contract", "unal"),
          snapshot,
          extraInstructions:
            `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES_PROMPT}. ` +
            "NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.",
          onProgress: makeOnProgress("contract2"),
        }),
      ])

      const warnings: string[] = []
      const confidence: Record<string, ConfidenceMap> = {}

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

      const psRaw = fillFromCandidates(aiPS, pilaCandidate as Record<string, unknown>)
      const paymentSheet = psRaw as PaymentSheetExtracted | null
      if (r0.status === "rejected") warnings.push(`Planilla — error de extracción: ${r0.reason}`)
      else if (!aiPS) {
        const len = cleanText.paymentSheet.trim().length
        warnings.push(len === 0
          ? "Planilla — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
          : `Planilla — la IA no pudo interpretar el documento (${len} caracteres extraídos)`)
      } else {
        if (!psRaw?.sheetNumber) warnings.push("Planilla — número de planilla no encontrado")
        if (!psRaw?.paymentDate) warnings.push("Planilla — fecha de pago no encontrada")
        if (!psRaw?.period) warnings.push("Planilla — período de cotización no encontrado")
      }
      if (psRaw) confidence.paymentSheet = computeConfidence(pilaCandidate as Record<string, unknown>, psRaw)

      const arlRaw = fillFromCandidates(aiARL, arlCandidate as Record<string, unknown>)
      const arl = arlRaw as ARLExtracted | null
      if (r1.status === "rejected") warnings.push(`ARL — error de extracción: ${r1.reason}`)
      else if (!aiARL) {
        const len = cleanText.arl.trim().length
        warnings.push(len === 0
          ? "ARL — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
          : `ARL — la IA no pudo interpretar el documento (${len} caracteres extraídos)`)
      } else {
        if (!arlRaw?.startDate) warnings.push("ARL — fecha de inicio de cobertura no encontrada")
        if (!arlRaw?.endDate) warnings.push("ARL — fecha de fin de cobertura no encontrada")
      }
      if (arlRaw) confidence.arl = computeConfidence(arlCandidate as Record<string, unknown>, arlRaw)

      const c1Raw = fillFromCandidates(aiC1, contractCand as Record<string, unknown>)
      const contract = c1Raw as ContractExtracted | null
      if (r2.status === "rejected") warnings.push(`Contrato — error de extracción: ${r2.reason}`)
      else if (!aiC1) {
        const len = cleanText.contract.trim().length
        warnings.push(len === 0
          ? "Contrato — el PDF no contiene texto extraíble (¿es un PDF escaneado o protegido?)"
          : `Contrato — la IA no pudo interpretar el documento (${len} caracteres extraídos)`)
      } else {
        if (!c1Raw?.orderNumber) warnings.push("Contrato — número de orden no encontrado")
        if (!c1Raw?.documentNumber) warnings.push("Contrato — número de documento no encontrado")
      }
      if (c1Raw) confidence.contract = computeConfidence(contractCand as Record<string, unknown>, c1Raw)

      const c2Raw = fillFromCandidates(aiC2, contract2Cand as Record<string, unknown>)
      const contract2 = c2Raw as ContractExtracted | null
      if (r3.status === "rejected" && cleanText.contract2) warnings.push(`Contrato 2 — error de extracción: ${r3.reason}`)
      else if (r3.status === "fulfilled" && !aiC2 && cleanText.contract2.trim().length > 0) warnings.push("Contrato 2 — la IA no pudo interpretar el documento")
      if (c2Raw) confidence.contract2 = computeConfidence(contract2Cand as Record<string, unknown>, c2Raw)

      const extractedData: ExtractedData = {
        paymentSheet,
        arl,
        contract,
        ...(contract2 ? { contract2 } : {}),
      }

      send({ type: "result", data: extractedData, warnings, issuerKeys, confidence })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido al extraer datos con IA."
      send({ type: "error", message: "Falló la extracción estructurada con IA.", details: message })
    } finally {
      writer.close()
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
