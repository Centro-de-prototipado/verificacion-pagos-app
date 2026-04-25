import { createGroq } from "@ai-sdk/groq"
import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
})

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY ?? "",
})

const mistral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
})

export const geminiFlash = openrouter.chat(
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash"
)

export const groqModel = groq(
  process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
)

export const mistralModel = mistral(
  process.env.MISTRAL_MODEL ?? "mistral-small-latest"
)

const ollama = createOpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  apiKey: "ollama",
})

export const ollamaModel = ollama(process.env.OLLAMA_MODEL ?? "devstral-2")
