import { NextRequest, NextResponse } from "next/server"
import { Output } from "ai"
import type { ZodType } from "zod"

import { generateWithFallback } from "@/lib/ai/client"
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
import type { ExtractedData, RawPDFText } from "@/lib/types"

export const runtime = "nodejs"

// ─── Profile hint shape (sent by the client) ─────────────────────────────────

interface ProfileHint {
  docType: string
  issuer: string
  example: Record<string, unknown>
}

// ─── Core extraction helper ───────────────────────────────────────────────────

const CONTRACT_TYPES =
  "OCA, OCO, ODC, ODO, OPS, OSE, OSU, CCO, CDA, CDC, CDO, CIS, CON, COV, CPS, CSE, CSU, " +
  "OEF, OFA, OFC, OFO, OFS, OOF, OSF, OUF, CAF, CCF, CIF, COF, CPF, CSF, CTF, CUF, CVF"

async function extractWithValidation<T>({
  text,
  schema,
  docLabel,
  candidates,
  profileExample,
  extraInstructions,
}: {
  text: string
  schema: ZodType<T>
  docLabel: string
  candidates: Record<string, unknown>
  profileExample?: Record<string, unknown>
  extraInstructions?: string
}): Promise<T | null> {
  if (!text.trim()) return null

  const profileSection = profileExample
    ? `\nEjemplo de extracción confirmada anteriormente para este mismo emisor:\n${JSON.stringify(profileExample, null, 2)}\n`
    : ""

  const extraSection = extraInstructions ? `\n${extraInstructions}\n` : ""

  const prompt = `Estás validando la extracción de un documento: ${docLabel}.

El sistema detectó estos candidatos automáticamente (algunos pueden ser nulos o incorrectos):
${JSON.stringify(candidates, null, 2)}
${profileSection}${extraSection}
Texto del documento (primeras 4000 caracteres):
${text.slice(0, 4000)}

Instrucciones:
- Verifica cada candidato contra el texto real del documento.
- Si un candidato es correcto, mantenlo exactamente igual.
- Si es incorrecto o nulo, corrígelo con el valor real del documento.
- Respeta los formatos del esquema (fechas en DD/MM/YYYY, montos como número sin separadores).
- Si un campo no aparece en el texto y no es requerido, usa el valor por defecto del esquema.`

  try {
    const { output } = await generateWithFallback({
      output: Output.object({ schema }),
      prompt,
    })
    return output
  } catch {
    // Retry once with truncated prompt, cycling through providers again
    const { output } = await generateWithFallback({
      output: Output.object({ schema }),
      prompt: `Extrae datos de este documento (${docLabel}) y devuelve el JSON del esquema.\n\nTexto:\n${text.slice(0, 2000)}`,
    })
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

  // Detect issuers from raw text
  const issuerKeys = {
    paymentSheet: detectIssuer(rawText.paymentSheet, "pila"),
    arl: detectIssuer(rawText.arl, "arl"),
    contract: "unal",
    ...(rawText.contract2 ? { contract2: "unal" } : {}),
  }

  // Normalize all texts before any processing — fixes dates split across lines by PDF extraction
  const cleanText = {
    paymentSheet: joinSplitDates(rawText.paymentSheet),
    arl: joinSplitDates(rawText.arl),
    contract: joinSplitDates(rawText.contract),
    contract2: rawText.contract2 ? joinSplitDates(rawText.contract2) : "",
  }

  try {
    const [r0, r1, r2, r3] = await Promise.allSettled([
      extractWithValidation<PaymentSheetExtracted>({
        text: cleanText.paymentSheet,
        schema: PaymentSheetSchema,
        docLabel: "Planilla PILA de seguridad social",
        candidates: extractPILACandidates(cleanText.paymentSheet),
        profileExample: findProfile(profiles, "pila", issuerKeys.paymentSheet),
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
      }),
      extractWithValidation<ARLExtracted>({
        text: cleanText.arl,
        schema: ARLSchema,
        docLabel: "Certificado de afiliación ARL",
        candidates: extractARLCandidates(cleanText.arl),
        profileExample: findProfile(profiles, "arl", issuerKeys.arl),
      }),
      extractWithValidation<ContractExtracted>({
        text: cleanText.contract,
        schema: ContractSchema,
        docLabel: "Contrato UNAL (contrato 1)",
        candidates: extractContractCandidates(cleanText.contract),
        profileExample: findProfile(profiles, "contract", "unal"),
        extraInstructions:
          `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES}. ` +
          "NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.",
      }),
      extractWithValidation<ContractExtracted>({
        text: cleanText.contract2,
        schema: ContractSchema,
        docLabel: "Contrato UNAL (contrato 2)",
        candidates: extractContractCandidates(cleanText.contract2),
        profileExample: findProfile(profiles, "contract", "unal"),
        extraInstructions:
          `Tipos de contrato válidos (usa solo estas siglas exactas): ${CONTRACT_TYPES}. ` +
          "NO extraigas startDate ni endDate del contrato — se tomarán del certificado ARL.",
      }),
    ])

    const warnings: string[] = []

    const paymentSheet = r0.status === "fulfilled" ? r0.value : null
    if (r0.status === "rejected") warnings.push(`Planilla: ${r0.reason}`)

    const arl = r1.status === "fulfilled" ? r1.value : null
    if (r1.status === "rejected") warnings.push(`ARL: ${r1.reason}`)

    const contract = r2.status === "fulfilled" ? r2.value : null
    if (r2.status === "rejected") warnings.push(`Contrato: ${r2.reason}`)

    const contract2 = r3.status === "fulfilled" ? r3.value : null
    if (r3.status === "rejected") warnings.push(`Contrato 2: ${r3.reason}`)

    const extractedData: ExtractedData = {
      paymentSheet,
      arl,
      contract,
      ...(contract2 ? { contract2 } : {}),
    }

    return NextResponse.json({ ...extractedData, warnings, issuerKeys })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido al extraer datos con IA."
    return NextResponse.json(
      { error: "Falló la extracción estructurada con IA.", details: message },
      { status: 500 }
    )
  }
}
