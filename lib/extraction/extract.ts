/**
 * One-shot structured extraction from PDF text — with OCR fallback for
 * scanned PDFs.
 *
 * Two paths:
 *   - Text path (default): use the text extracted with `unpdf`. Cheap and
 *     fast. Works on the 85% of PDFs that have a real text layer.
 *   - OCR path (fallback): when text is below `isLikelyScanned` threshold
 *     AND `pdfBytes` is supplied, send the PDF directly to a multimodal
 *     Mistral model (pixtral-large, mistral-small) via `type: 'file'`. The
 *     model OCRs the document and outputs the same Zod schema.
 *
 * Both paths share the same Zod schema, repair loop, and result shape.
 */

import {
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
} from "ai"
import type { FilePart, TextPart } from "ai"
import type { ZodError, ZodType } from "zod"

import { generateWithFallback, snapshotProviders } from "@/lib/ai/client"
import type { OnProviderProgress, ProviderEntry } from "@/lib/ai/client"
import { smartSlice } from "@/lib/pdf/extract-helpers"
import { isLikelyScanned } from "@/lib/extraction/preprocess"
import { injectAnchors } from "@/lib/extraction/anchors"
import type { DocType } from "@/lib/extraction/anchors"

export type { OnProviderProgress, ProviderEntry }

export interface ExtractParams<T> {
  text: string
  schema: ZodType<T>
  docLabel: string
  /** Document type for anchor-based preprocessing. */
  docType?: DocType
  /** Optional extra context the PDF itself can't provide (period billed, etc.). */
  hints?: string
  /** Raw PDF bytes. If text is scanned and these are present, OCR fallback fires. */
  pdfBytes?: Uint8Array
  onProgress?: OnProviderProgress
  snapshot?: ProviderEntry[]
}

export interface ExtractResult<T> {
  data: T | null
  /** True when input text was below the scanned-PDF threshold. */
  scanned: boolean
  /** True when the OCR fallback was used (or attempted). */
  usedOcr?: boolean
  /** Last validation error (when present, `data` is null). */
  validationError?: string
}

// ─── Prompt building ────────────────────────────────────────────────────────

function buildPrompt(
  docLabel: string,
  text: string,
  hints?: string,
  previousError?: string
): string {
  const head = previousError
    ? `Tu respuesta anterior NO pasó la validación del esquema:\n${previousError}\n\nCorrige esos errores y devuelve un JSON válido.\n\n`
    : ""
  const hintBlock = hints ? `\nContexto adicional:\n${hints}\n` : ""
  return (
    `${head}Extrae los campos requeridos de este documento (${docLabel}) ` +
    `directamente del texto. Sigue ESTRICTAMENTE los formatos y reglas del esquema ` +
    `(las descripciones de cada campo explican qué buscar).` +
    hintBlock +
    `\nTexto del documento:\n${smartSlice(text)}`
  )
}

function buildOcrPrompt(
  docLabel: string,
  hints?: string,
  previousError?: string
): string {
  const head = previousError
    ? `Tu respuesta anterior NO pasó la validación del esquema:\n${previousError}\n\nCorrige esos errores y devuelve un JSON válido.\n\n`
    : ""
  const hintBlock = hints ? `\nContexto adicional:\n${hints}\n` : ""
  return (
    `${head}El documento adjunto es un PDF escaneado o una captura de pantalla — ` +
    `extrae los campos requeridos leyendo directamente la imagen. ` +
    `Tipo de documento: ${docLabel}. ` +
    `Sigue ESTRICTAMENTE los formatos y reglas del esquema ` +
    `(las descripciones de cada campo explican qué buscar). ` +
    `Si un dato no aparece visible, devuelve null para ese campo.` +
    hintBlock
  )
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n")
}

// ─── Text-based extraction (primary path) ──────────────────────────────────

async function extractFromText<T>(
  text: string,
  schema: ZodType<T>,
  docLabel: string,
  docType: DocType | undefined,
  hints: string | undefined,
  onProgress: OnProviderProgress | undefined,
  snapshot: ProviderEntry[] | undefined
): Promise<ExtractResult<T>> {
  const anchoredText = docType ? injectAnchors(text, docType) : text
  let previousError: string | undefined
  let lastError: string | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildPrompt(docLabel, anchoredText, hints, previousError)
    try {
      const { output } = await generateWithFallback(
        { output: Output.object({ schema }), prompt },
        onProgress,
        snapshot
      )
      return { data: output as T, scanned: false }
    } catch (err) {
      const isValidationFailure =
        NoObjectGeneratedError.isInstance(err) ||
        TypeValidationError.isInstance(err)
      if (isValidationFailure) {
        const cause = (err as { cause?: unknown }).cause as
          | { issues?: ZodError["issues"] }
          | undefined
        previousError = cause?.issues
          ? formatZodError(cause as ZodError)
          : (err as Error).message
        lastError = previousError
        continue
      }
      throw err
    }
  }
  return { data: null, scanned: false, validationError: lastError }
}

// ─── OCR-based extraction (fallback for scanned PDFs) ──────────────────────

async function extractFromPdf<T>(
  pdfBytes: Uint8Array,
  schema: ZodType<T>,
  docLabel: string,
  hints: string | undefined,
  onProgress: OnProviderProgress | undefined
): Promise<ExtractResult<T>> {
  const ocrSnapshot = snapshotProviders("ocr")
  if (ocrSnapshot.length === 0) {
    return {
      data: null,
      scanned: true,
      usedOcr: true,
      validationError: "Sin proveedores OCR configurados.",
    }
  }

  let previousError: string | undefined
  let lastError: string | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    const promptText = buildOcrPrompt(docLabel, hints, previousError)
    const content: Array<TextPart | FilePart> = [
      { type: "text", text: promptText },
      { type: "file", data: pdfBytes, mediaType: "application/pdf" },
    ]
    try {
      const { output } = await generateWithFallback(
        {
          output: Output.object({ schema }),
          messages: [{ role: "user", content }],
        },
        onProgress,
        ocrSnapshot
      )
      return { data: output as T, scanned: true, usedOcr: true }
    } catch (err) {
      const isValidationFailure =
        NoObjectGeneratedError.isInstance(err) ||
        TypeValidationError.isInstance(err)
      if (isValidationFailure) {
        const cause = (err as { cause?: unknown }).cause as
          | { issues?: ZodError["issues"] }
          | undefined
        previousError = cause?.issues
          ? formatZodError(cause as ZodError)
          : (err as Error).message
        lastError = previousError
        continue
      }
      throw err
    }
  }
  return {
    data: null,
    scanned: true,
    usedOcr: true,
    validationError: lastError,
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Returns the validated object or null. Up to 2 attempts per path (text or
 * OCR); the second attempt feeds the Zod error back to the model.
 *
 * Path selection:
 *   - text has enough chars  → text extraction (cheap)
 *   - text is empty/short + pdfBytes provided → OCR (pricier, multimodal)
 *   - text is empty/short + no pdfBytes      → returns scanned:true, data:null
 */
export async function extract<T>({
  text,
  schema,
  docLabel,
  docType,
  hints,
  pdfBytes,
  onProgress,
  snapshot,
}: ExtractParams<T>): Promise<ExtractResult<T>> {
  if (isLikelyScanned(text)) {
    if (!pdfBytes) return { data: null, scanned: true }
    return extractFromPdf(pdfBytes, schema, docLabel, hints, onProgress)
  }
  return extractFromText(
    text,
    schema,
    docLabel,
    docType,
    hints,
    onProgress,
    snapshot
  )
}
