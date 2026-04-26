import { extractText } from "unpdf"
import { MIN_TEXT_LENGTH } from "@/lib/constants/pdf"

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: false,
  })
  return text.join("\n\n")
}

export { MIN_TEXT_LENGTH }
