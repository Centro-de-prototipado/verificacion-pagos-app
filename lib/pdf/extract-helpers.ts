import type { ConfidenceLevel, ConfidenceMap } from "@/lib/types"

/**
 * Returns up to `max` chars from a document, combining the first 70% and the
 * last 30% so that page-2 content in multi-page PDFs is always included.
 * Default is 12 000 chars — modern models have 128k context and most documents
 * fit entirely within this window without any truncation.
 */
export function smartSlice(text: string, max = 12_000): string {
  if (text.length <= max) return text
  const head = Math.floor(max * 0.7)
  const tail = max - head
  return text.slice(0, head) + "\n[…]\n" + text.slice(-tail)
}

export function isEmpty(v: unknown): boolean {
  return v == null || v === "" || v === 0
}

/**
 * Compares keyword-extractor candidates against the final (possibly AI-corrected)
 * output to assign a confidence level to each field.
 * - high:   both sources had the same non-empty value
 * - medium: only one source had it, or they disagreed (AI corrected)
 * - low:    neither source produced a value
 */
export function computeConfidence(
  candidates: Record<string, unknown>,
  output: Record<string, unknown>
): ConfidenceMap {
  const result: ConfidenceMap = {}
  const keys = new Set([...Object.keys(candidates), ...Object.keys(output)])
  for (const k of keys) {
    const c = candidates[k]
    const a = output[k]
    if (isEmpty(c) && isEmpty(a)) result[k] = "low"
    else if (!isEmpty(c) && !isEmpty(a) && String(c) === String(a))
      result[k] = "high"
    else result[k] = "medium"
  }
  return result
}

/**
 * For every field where the AI returned null/empty but the keyword extractor
 * found something, use the extractor's value (confidence will be "medium").
 * This ensures we always return a result rather than leaving fields blank.
 */
export function fillFromCandidates(
  aiOutput: Record<string, unknown> | null,
  candidates: Record<string, unknown>
): Record<string, unknown> | null {
  if (!aiOutput) return null
  const merged: Record<string, unknown> = { ...aiOutput }
  for (const [k, v] of Object.entries(candidates)) {
    if (isEmpty(merged[k]) && !isEmpty(v)) merged[k] = v
  }
  return merged
}
