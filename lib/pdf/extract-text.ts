// pdfjs-dist corre en el servidor (Route Handler) sin worker.
// El build legacy evita dependencias de DOM APIs como DOMMatrix en Node.js.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { MIN_TEXT_LENGTH } from "@/lib/constants/pdf"

const PDF_WORKER_SRC = "pdfjs-dist/legacy/build/pdf.worker.mjs"

pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC

/**
 * Extrae texto plano de un PDF en buffer.
 * Devuelve las páginas unidas por doble salto de línea.
 * Si el PDF está escaneado (sin capa de texto) devuelve cadena vacía.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
  }

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const pages: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim()

    if (pageText) pages.push(pageText)
  }

  return pages.join("\n\n")
}

export { MIN_TEXT_LENGTH }
