import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { generateText, TypeValidationError, NoContentGeneratedError } from "ai"
import type { LanguageModel } from "ai"

type GenerateTextParams = Parameters<typeof generateText>[0]

const COOLDOWN_MS = 10 * 60 * 1000  // only for rate-limits / credit errors

// Max output tokens — enough for any extraction schema in this app
const MAX_TOKENS = 1200

// ── Model catalog ──────────────────────────────────────────────────────────────
// All model names live here. Only API keys come from .env.
//
// Confirmed structured-output support (April 2026):
//   Mistral:     mistral-large-latest     — best quality for extraction
//                devstral-latest          — coding-focused but works well in practice
//   Groq:        llama-3.3-70b-versatile  — JSON mode, 128K ctx, 6 000 req/day free
//   OpenRouter:  gpt-oss-20b:free         — native structured output, 1 000 T/s
//                gpt-oss-120b:free        — native structured output, larger
//                gemma-4-26b-a4b-it:free  — native structured output, 256K context
//                gemma-4-31b-it:free      — native function calling
//                openrouter/free          — smart router (last resort)

const MODELS = {
  mistral: ["devstral-latest", "mistral-large-latest"],
  groq: [],
  openrouter: [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "minimax/minimax-m2.5:free",
    "z-ai/glm-4.5-air:free",
    "openai/gpt-oss-120b:free",
    "openrouter/free",
  ],
} as const

// ── Provider registry ──────────────────────────────────────────────────────────

export type ProviderProgress = "trying" | "failed" | "success"
export type OnProviderProgress = (
  type: ProviderProgress,
  displayName: string
) => void

interface ProviderEntry {
  model: LanguageModel
  name: string // internal key (e.g. "groq:llama-3.3-70b-versatile")
  label: string // human-readable (e.g. "Groq · Llama 3.3 70B")
  cooldownUntil: number
}

let _registry: ProviderEntry[] | null = null

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

function buildRegistry(): ProviderEntry[] {
  const list: ProviderEntry[] = []

  if (process.env.MISTRAL_API_KEY) {
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY })
    for (const modelId of MODELS.mistral) {
      list.push({
        model: mistral(modelId),
        name: `mistral:${modelId}`,
        label: toLabel("Mistral", modelId),
        cooldownUntil: 0,
      })
    }
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    for (const modelId of MODELS.groq) {
      list.push({
        model: groq(modelId),
        name: `groq:${modelId}`,
        label: toLabel("Groq", modelId),
        cooldownUntil: 0,
      })
    }
  }

  const orKeys = (
    [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2] as (
      | string
      | undefined
    )[]
  ).filter((k): k is string => Boolean(k))

  for (const [ki, key] of orKeys.entries()) {
    const or = createOpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    })
    for (const modelId of MODELS.openrouter) {
      list.push({
        model: or(modelId),
        name: `openrouter-${ki + 1}:${modelId}`,
        label: toLabel(`OpenRouter ${ki + 1}`, modelId),
        cooldownUntil: 0,
      })
    }
  }

  return list
}

function getRegistry(): ProviderEntry[] {
  if (!_registry) _registry = buildRegistry()
  return _registry
}

/** Returns providers in fixed order: available first, rate-limited last. */
function getOrderedProviders(): ProviderEntry[] {
  const registry = getRegistry()
  const now = Date.now()
  return [
    ...registry.filter((e) => now >= e.cooldownUntil),
    ...registry.filter((e) => now < e.cooldownUntil),
  ]
}

// ── Error classification ───────────────────────────────────────────────────────

/**
 * True when the provider is genuinely rate-limited or out of credits.
 * These get a long cooldown so we don't hammer them again.
 */
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|402|rate.?limit|quota.?exceed|too.?many.?request|more credits|can only afford|insufficient.*(credit|balance|quota)/i.test(
    msg
  )
}

/**
 * True for transient failures (bad response, schema mismatch, empty output).
 * We skip to the next provider but do NOT set a cooldown — on retry the same
 * provider is tried again immediately.
 */
function isTransientError(err: unknown): boolean {
  if (TypeValidationError.isInstance(err)) return true
  if (NoContentGeneratedError.isInstance(err)) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /provider returned error/i.test(msg)
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type { ProviderEntry }

/**
 * Call once per incoming request. Returns the ordered provider list for that
 * request (advances round-robin by 1 so successive requests rotate providers).
 * Pass the result to every generateWithFallback call in the same request so all
 * parallel extractions start from the same provider instead of each advancing
 * the index independently.
 */
export function snapshotProviders(): ProviderEntry[] {
  return getOrderedProviders()
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
        entry.cooldownUntil = Date.now() + COOLDOWN_MS // long cooldown — provider saturated
        continue
      }
      if (isTransientError(err)) {
        continue // try next provider this request; no cooldown so retry starts fresh with Mistral
      }
      throw err // non-retryable
    }
  }

  throw lastError
}
