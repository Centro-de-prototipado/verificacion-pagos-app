import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export const geminiFlash = openrouter.chat(
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
);
