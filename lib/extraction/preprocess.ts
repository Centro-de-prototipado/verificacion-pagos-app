/**
 * Text preprocessing for extracted PDF text.
 *
 * The PDF text layer often splits a single date across two lines:
 *   "vigencia: 23/03/\n2026"
 * This helper stitches those back together so downstream parsers/LLMs see
 * "vigencia: 23/03/2026".
 */

/** Glue back dates that PDF text-layout broke across lines. */
export function joinSplitDates(text: string): string {
  return text
    // DD/MM/\n YYYY  →  DD/MM/YYYY
    .replace(/(\d{2}\/\d{2}\/)\s*\n\s*(\d{4})/g, "$1$2")
    // DD/MM/YYYY split by stray whitespace runs
    .replace(/(\d{2}\/\d{2}\/\d{4})/g, "$1")
    // YYYY-MM-\n DD
    .replace(/(\d{4}-\d{2}-)\s*\n\s*(\d{2})/g, "$1$2")
}

/** Below this char count we treat the doc as scanned/screenshot and try OCR.
 *  Real text-layer PDFs of this app (planilla, ARL, contract) have several
 *  thousand chars. Pure screenshots have 100-300 chars of metadata. */
const SCAN_MIN_CHARS = 300

export function isLikelyScanned(text: string): boolean {
  return text.trim().length < SCAN_MIN_CHARS
}
