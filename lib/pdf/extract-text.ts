// pdfjs-dist corre en el servidor (Route Handler) sin worker — see next.config.mjs
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc = ""

/**
 * Extrae texto plano de un PDF en buffer.
 * Devuelve las páginas unidas por doble salto de línea.
 * Si el PDF está escaneado (sin capa de texto) devuelve cadena vacía.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
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

/** Umbral mínimo de caracteres para considerar que el PDF tiene texto extraíble */
export const MIN_TEXT_LENGTH = 50
