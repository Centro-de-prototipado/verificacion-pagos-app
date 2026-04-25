import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import type { ZodType } from "zod"

import { ollamaModel } from "@/lib/ai/client"
import { extractTextFromPDF } from "@/lib/pdf/extract-text"
import { ARLSchema } from "@/lib/schemas/arl"
import { ContractSchema } from "@/lib/schemas/contract"
import { PaymentSheetSchema } from "@/lib/schemas/payment-sheet"
import type { ExtractedData, RawPDFText } from "@/lib/types"

export const runtime = "nodejs"

const PDF_KEYS = ["paymentSheet", "arl", "contract", "contract2"] as const

const DEFAULT_MAX_OUTPUT_TOKENS = 1200

function resolveMaxOutputTokens(): number {
  const rawValue = process.env.OPENROUTER_MAX_OUTPUT_TOKENS
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : NaN

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }

  return DEFAULT_MAX_OUTPUT_TOKENS
}

type PDFKey = (typeof PDF_KEYS)[number]

async function extractWithSchema<T>({
  text,
  schema,
  instructions,
  maxOutputTokens,
}: {
  text: string
  schema: ZodType<T>
  instructions: string
  maxOutputTokens: number
}): Promise<T | null> {
  if (!text.trim()) return null

  const buildPrompt = (extraGuidance?: string) =>
    `${instructions}\n\nTexto del documento:\n${text}${extraGuidance ? `\n\n${extraGuidance}` : ""}`

  try {
    const { object } = await generateObject({
      model: ollamaModel,
      schema,
      prompt: buildPrompt(),
      maxOutputTokens,
    })
    return object
  } catch (firstError) {
    try {
      const { object } = await generateObject({
        model: ollamaModel,
        schema,
        prompt: buildPrompt(
          "Reintento: responde solo con valores extraídos literalmente del PDF. Si falta un dato, infiérelo con cautela manteniendo el formato exacto del esquema."
        ),
        maxOutputTokens,
      })
      return object
    } catch (retryError) {
      throw retryError instanceof Error
        ? retryError
        : new Error(String(retryError))
    }
  }
}

function getFile(formData: FormData, key: PDFKey): File | null {
  const value = formData.get(key)
  return value instanceof File ? value : null
}

async function getRawTextFromMultipart(
  formData: FormData
): Promise<RawPDFText> {
  const paymentSheetFile = getFile(formData, "paymentSheet")
  const arlFile = getFile(formData, "arl")
  const contractFile = getFile(formData, "contract")
  const contract2File = getFile(formData, "contract2")

  if (!paymentSheetFile || !arlFile || !contractFile) {
    throw new Error(
      "Debes enviar paymentSheet, arl y contract. contract2 es opcional."
    )
  }

  const [paymentSheet, arl, contract, contract2] = await Promise.all([
    extractTextFromPDF(await paymentSheetFile.arrayBuffer()),
    extractTextFromPDF(await arlFile.arrayBuffer()),
    extractTextFromPDF(await contractFile.arrayBuffer()),
    contract2File ? extractTextFromPDF(await contract2File.arrayBuffer()) : "",
  ])

  return {
    paymentSheet,
    arl,
    contract,
    ...(contract2 ? { contract2 } : {}),
  }
}

async function getRawText(request: NextRequest): Promise<RawPDFText> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { rawText?: RawPDFText }
    if (!body.rawText) {
      throw new Error("El body JSON debe incluir rawText.")
    }
    return body.rawText
  }

  const formData = await request.formData()
  return getRawTextFromMultipart(formData)
}

export async function POST(request: NextRequest) {
  let rawText: RawPDFText

  try {
    rawText = await getRawText(request)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la solicitud."

    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const maxOutputTokens = resolveMaxOutputTokens()

    const results = await Promise.allSettled([
      extractWithSchema({
        text: rawText.paymentSheet,
        schema: PaymentSheetSchema,
        instructions:
          "Extrae datos de la planilla PILA y devuelve un objeto JSON que cumpla exactamente el esquema.",
        maxOutputTokens,
      }),
      extractWithSchema({
        text: rawText.arl,
        schema: ARLSchema,
        instructions:
          "Extrae datos del certificado ARL y devuelve un objeto JSON que cumpla exactamente el esquema.",
        maxOutputTokens,
      }),
      extractWithSchema({
        text: rawText.contract,
        schema: ContractSchema,
        instructions:
          "Extrae datos del contrato y devuelve un objeto JSON que cumpla exactamente el esquema.",
        maxOutputTokens,
      }),
      extractWithSchema({
        text: rawText.contract2 ?? "",
        schema: ContractSchema,
        instructions:
          "Extrae datos del segundo contrato y devuelve un objeto JSON que cumpla exactamente el esquema.",
        maxOutputTokens,
      }),
    ])

    const [paymentSheetResult, arlResult, contractResult, contract2Result] =
      results

    const warnings: string[] = []

    const paymentSheet =
      paymentSheetResult.status === "fulfilled"
        ? paymentSheetResult.value
        : null
    if (paymentSheetResult.status === "rejected") {
      warnings.push(`Planilla: ${paymentSheetResult.reason}`)
    }

    const arl = arlResult.status === "fulfilled" ? arlResult.value : null
    if (arlResult.status === "rejected") {
      warnings.push(`ARL: ${arlResult.reason}`)
    }

    const contract =
      contractResult.status === "fulfilled" ? contractResult.value : null
    if (contractResult.status === "rejected") {
      warnings.push(`Contrato: ${contractResult.reason}`)
    }

    const contract2 =
      contract2Result.status === "fulfilled" ? contract2Result.value : null
    if (contract2Result.status === "rejected") {
      warnings.push(`Contrato 2: ${contract2Result.reason}`)
    }

    const extractedData: ExtractedData = {
      paymentSheet,
      arl,
      contract,
      ...(contract2 ? { contract2 } : {}),
    }

    return NextResponse.json({
      ...extractedData,
      warnings,
    })
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
