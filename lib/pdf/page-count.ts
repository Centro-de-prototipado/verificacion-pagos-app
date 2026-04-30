import { PDFDocument } from "pdf-lib"

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}
