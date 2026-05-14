/**
 * Quick utility: dump the extracted text of a PDF for inspection.
 *   npx tsx scripts/dump-text.ts <path-to-pdf> [maxChars]
 */
import { readFile } from "node:fs/promises"
import { extractText } from "unpdf"
import { joinSplitDates } from "../lib/extraction/preprocess"

const path = process.argv[2]
const max = Number(process.argv[3] ?? "3000")
if (!path) {
  console.error("usage: tsx scripts/dump-text.ts <pdf> [maxChars]")
  process.exit(1)
}

const bytes = await readFile(path)
const { text } = await extractText(new Uint8Array(bytes), { mergePages: false })
const joined = joinSplitDates(text.join("\n\n"))
console.log(joined.slice(0, max))
console.log(`\n— total chars: ${joined.length} —`)
