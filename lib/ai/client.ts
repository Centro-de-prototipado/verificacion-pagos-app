import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { generateText } from "ai"
import type { LanguageModel } from "ai"

type GenerateTextParams = Parameters<typeof generateText>[0]

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|402|rate.?limit|quota.?exceed|too.?many.?request|more credits|can only afford|insufficient.*(credit|balance|quota)/i.test(
    msg
  )
}

function buildProviders(): LanguageModel[] {
  const list: LanguageModel[] = []

  // Mistral first — paid tier, reliable
  if (process.env.MISTRAL_API_KEY) {
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY })
    list.push(mistral(process.env.MISTRAL_MODEL ?? "mistral-large-latest"))
  }

  // Groq second — fast, free tier
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    list.push(groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"))
  }

  // OpenRouter keys as final fallbacks
  const orModel =
    process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct"
  for (const key of [
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_API_KEY_2,
  ]) {
    if (!key) continue
    const or = createOpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    })
    list.push(or(orModel))
  }

  return list
}

/** Like generateText but rotates through configured providers on rate-limit errors. */
export async function generateWithFallback(
  params: Omit<GenerateTextParams, "model">
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const providers = buildProviders()
  if (providers.length === 0) throw new Error("No AI providers configured.")

  let lastError: unknown
  for (const model of providers) {
    try {
      return await generateText({ ...params, model } as GenerateTextParams)
    } catch (err) {
      lastError = err
      if (isRetryableError(err)) continue
      throw err
    }
  }
  throw lastError
}
