import { NextRequest, NextResponse } from "next/server"
import { extractTextFromPDF } from "@/lib/pdf/extract-text"
import { getPdfPageCount } from "@/lib/pdf/page-count"
import type { RawPDFText } from "@/lib/types"
import {
  exceedsContentLength,
  getClientIp,
  isRateLimited,
  readPdfFile,
} from "@/lib/security/request-guards"

export const runtime = "nodejs"

// Campos de PDF que se esperan en el FormData
const PDF_KEYS = [
  "paymentSheet",
  "arl",
  "contract",
  "contract2",
  "activityReport",
] as const
type PDFKey = (typeof PDF_KEYS)[number]
const MAX_FORM_BYTES = 40 * 1024 * 1024 // 40 MB
const MAX_PDF_BYTES = 12 * 1024 * 1024 // 12 MB por archivo
const MAX_PDF_PAGES = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 20 // increased for Step 3 uploads

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (
    isRateLimited({
      key: `extract-text:${ip}`,
      limit: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    )
  }

  if (exceedsContentLength(request, MAX_FORM_BYTES)) {
    return NextResponse.json(
      { error: "La carga es demasiado grande." },
      { status: 413 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el formulario." },
      { status: 400 }
    )
  }

  try {
    // Iniciar todas las extracciones en paralelo (async-parallel)
    const entries = PDF_KEYS.map(async (key): Promise<[PDFKey, string]> => {
      const field = formData.get(key)
      // If the field is missing, just skip it without error.
      // The client only sends the documents it has at each step.
      if (!field) return [key, ""]

      const bytes = await readPdfFile(field, key, {
        required: false,
        maxBytes: MAX_PDF_BYTES,
      })
      if (!bytes) return [key, ""]

      const pages = await getPdfPageCount(bytes)
      if (pages > MAX_PDF_PAGES) {
        throw new Error(
          `El archivo "${key}" tiene ${pages} páginas. El máximo permitido es ${MAX_PDF_PAGES}.`
        )
      }
      const text = await extractTextFromPDF(bytes.buffer)
      return [key, text]
    })

    const results = await Promise.all(entries)
    const rawText = Object.fromEntries(results) as unknown as RawPDFText
    return NextResponse.json(rawText)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al procesar los archivos PDF."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
