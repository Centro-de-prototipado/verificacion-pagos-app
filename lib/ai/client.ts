import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { generateText, TypeValidationError, NoContentGeneratedError } from "ai"
import type { LanguageModel } from "ai"

type GenerateTextParams = Parameters<typeof generateText>[0]

const COOLDOWN_MS = 10 * 60 * 1000 // only for rate-limits / credit errors

// Max output tokens — enough for any extraction schema in this app
const MAX_TOKENS = 1200

const MISTRAL_MODELS = ["devstral-latest", "mistral-large-latest"] as const

/** Multimodal models that accept `type: 'file'` content (PDFs as images). */
const MISTRAL_OCR_MODELS = [
  "mistral-small-latest",
  "pixtral-large-latest",
] as const

const OPENROUTER_MODELS = ["openrouter/auto"] as const

// ── Key resolution ────────────────────────────────────────────────────────────
// Add MISTRAL_API_KEY_2, OPENROUTER_API_KEY_2, etc. in .env to register
// additional key slots. Each key creates a separate provider entry so the
// fallback chain can round-robin across them when one is rate-limited.

function resolveKeys(prefix: string): string[] {
  const keys: string[] = []
  // First key (no suffix)
  const base = process.env[prefix]
  if (base) keys.push(base)
  // Numbered extras: PREFIX_2, PREFIX_3, …
  for (let i = 2; i <= 9; i++) {
    const extra = process.env[`${prefix}_${i}`]
    if (extra) keys.push(extra)
    else break
  }
  return keys
}

// ── Provider registry ──────────────────────────────────────────────────────────

export type ProviderProgress = "trying" | "failed" | "success"
export type OnProviderProgress = (
  type: ProviderProgress,
  displayName: string
) => void

interface ProviderEntry {
  model: LanguageModel
  name: string
  label: string
  cooldownUntil: number
}

let _registry: ProviderEntry[] | null = null
let _ocrRegistry: ProviderEntry[] | null = null

function toLabel(provider: string, modelId: string): string {
  const base = modelId
    .replace(/:free$/, "")
    .replace(/-latest$/, "")
    .split("/")
    .pop()!
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
  return `${provider} · ${base}`
}

function buildRegistry(kind: "text" | "ocr"): ProviderEntry[] {
  const list: ProviderEntry[] = []

  const mistralKeys = resolveKeys("MISTRAL_API_KEY")
  const mistralModels = kind === "ocr" ? MISTRAL_OCR_MODELS : MISTRAL_MODELS
  for (const [ki, key] of mistralKeys.entries()) {
    const client = createMistral({ apiKey: key })
    const suffix = ki === 0 ? "" : ` ${ki + 1}`
    for (const modelId of mistralModels) {
      list.push({
        model: client(modelId),
        name: `mistral${ki === 0 ? "" : `-${ki + 1}`}:${modelId}`,
        label: toLabel(`Mistral${suffix}`, modelId),
        cooldownUntil: 0,
      })
    }
  }

  // OpenRouter's `auto` router may not reliably route to a multimodal model
  // for file input, so we skip OpenRouter for OCR. Mistral-only OCR.
  if (kind === "text") {
    const orKeys = resolveKeys("OPENROUTER_API_KEY")
    for (const [ki, key] of orKeys.entries()) {
      const client = createOpenAI({
        apiKey: key,
        baseURL: "https://openrouter.ai/api/v1",
      })
      const suffix = ki === 0 ? "" : ` ${ki + 1}`
      for (const modelId of OPENROUTER_MODELS) {
        list.push({
          model: client(modelId),
          name: `openrouter${ki === 0 ? "" : `-${ki + 1}`}:${modelId}`,
          label: toLabel(`OpenRouter${suffix}`, modelId),
          cooldownUntil: 0,
        })
      }
    }
  }

  return list
}

function getRegistry(kind: "text" | "ocr"): ProviderEntry[] {
  if (kind === "ocr") {
    if (!_ocrRegistry) _ocrRegistry = buildRegistry("ocr")
    return _ocrRegistry
  }
  if (!_registry) _registry = buildRegistry("text")
  return _registry
}

/** Returns providers ordered: available first, rate-limited last. */
function getOrderedProviders(kind: "text" | "ocr" = "text"): ProviderEntry[] {
  const registry = getRegistry(kind)
  const now = Date.now()
  return [
    ...registry.filter((e) => now >= e.cooldownUntil),
    ...registry.filter((e) => now < e.cooldownUntil),
  ]
}

// ── Error classification ───────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|402|rate.?limit|quota.?exceed|too.?many.?request|more credits|can only afford|insufficient.*(credit|balance|quota)/i.test(
    msg
  )
}

function isTransientError(err: unknown): boolean {
  if (TypeValidationError.isInstance(err)) return true
  if (NoContentGeneratedError.isInstance(err)) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /provider returned error/i.test(msg)
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type { ProviderEntry }

/**
 * Call once per request. Returns the ordered provider list so all parallel
 * extractions in the same request start from the same provider instead of
 * each advancing the index independently.
 *
 * `kind: "ocr"` returns multimodal Mistral models that accept `type: 'file'`
 * content (pixtral-large-latest, mistral-small-latest). OpenRouter is skipped
 * for OCR since `openrouter/auto` does not guarantee a vision-capable model.
 */
export function snapshotProviders(
  kind: "text" | "ocr" = "text"
): ProviderEntry[] {
  return getOrderedProviders(kind)
}

/** Like generateText but rotates through providers, firing onProgress callbacks. */
export async function generateWithFallback(
  params: Omit<GenerateTextParams, "model">,
  onProgress?: OnProviderProgress,
  snapshot?: ProviderEntry[]
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const providers = snapshot ?? getOrderedProviders()
  if (providers.length === 0) throw new Error("No AI providers configured.")

  let lastError: unknown

  for (const entry of providers) {
    onProgress?.("trying", entry.label)
    try {
      const result = await generateText({
        ...params,
        model: entry.model,
        temperature: 0,
        maxTokens: MAX_TOKENS,
        maxRetries: 0,
      } as GenerateTextParams)
      onProgress?.("success", entry.label)
      return result
    } catch (err) {
      lastError = err
      onProgress?.("failed", entry.label)
      if (isRateLimitError(err)) {
        entry.cooldownUntil = Date.now() + COOLDOWN_MS
        continue
      }
      if (isTransientError(err)) {
        continue
      }
      throw err
    }
  }

  throw lastError
}
