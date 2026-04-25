import { NextRequest, NextResponse } from "next/server"
import { extractTextFromPDF } from "@/lib/pdf/extract-text"
import type { RawPDFText } from "@/lib/types"

export const runtime = "nodejs"

// Campos de PDF que se esperan en el FormData
const PDF_KEYS = ["paymentSheet", "arl", "contract", "contract2"] as const
type PDFKey = (typeof PDF_KEYS)[number]

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el formulario." },
      { status: 400 }
    )
  }

  // Iniciar todas las extracciones en paralelo (async-parallel)
  const entries = PDF_KEYS.map(async (key): Promise<[PDFKey, string]> => {
    const file = formData.get(key)
    if (!(file instanceof File)) return [key, ""]

    const buffer = await file.arrayBuffer()
    const text = await extractTextFromPDF(buffer)
    return [key, text]
  })

  const results = await Promise.all(entries)

  const rawText = Object.fromEntries(results) as unknown as RawPDFText

  return NextResponse.json(rawText)
}
