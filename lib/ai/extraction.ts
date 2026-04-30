import { Output } from "ai"
import type { ZodType } from "zod"

import { generateWithFallback } from "@/lib/ai/client"
import type { OnProviderProgress, ProviderEntry } from "@/lib/ai/client"
import { smartSlice } from "@/lib/pdf/extract-helpers"

export { type OnProviderProgress, type ProviderEntry }

export async function extractWithValidation<T>({
  text,
  schema,
  docLabel,
  candidates,
  profileExample,
  extraInstructions,
  onProgress,
  snapshot,
}: {
  text: string
  schema: ZodType<T>
  docLabel: string
  candidates: Record<string, unknown>
  profileExample?: Record<string, unknown>
  extraInstructions?: string
  onProgress?: OnProviderProgress
  snapshot?: ProviderEntry[]
}): Promise<T | null> {
  if (!text.trim()) return null

  const profileSection = profileExample
    ? `\nEjemplo de extracción confirmada anteriormente para este mismo emisor:\n${JSON.stringify(profileExample, null, 2)}\n`
    : ""

  const extraSection = extraInstructions ? `\n${extraInstructions}\n` : ""

  const prompt = `Estás validando la extracción de un documento: ${docLabel}.

El sistema detectó estos candidatos automáticamente (algunos pueden ser nulos o incorrectos):
${JSON.stringify(candidates, null, 2)}
${profileSection}${extraSection}
Texto del documento:
${smartSlice(text)}

Instrucciones:
- Verifica cada candidato contra el texto real del documento.
- Si un candidato es correcto, mantenlo exactamente igual.
- Si es incorrecto o nulo, corrígelo con el valor real del documento.
- Respeta los formatos del esquema (fechas en DD/MM/YYYY, montos como número sin separadores).
- Si un campo no aparece en el texto y no es requerido, usa el valor por defecto del esquema.`

  try {
    const { output } = await generateWithFallback(
      { output: Output.object({ schema }), prompt },
      onProgress,
      snapshot
    )
    return output
  } catch {
    const { output } = await generateWithFallback(
      {
        output: Output.object({ schema }),
        prompt: `Extrae datos de este documento (${docLabel}) y devuelve el JSON del esquema.\n\nTexto:\n${smartSlice(text, 2500)}`,
      },
      onProgress,
      snapshot
    )
    return output
  }
}
