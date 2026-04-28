import { NextRequest, NextResponse } from "next/server"
import { Output } from "ai"
import { extractTextFromPDF } from "@/lib/pdf/extract-text"
import { generateWithFallback } from "@/lib/ai/client"
import { InformeActividadesSchema } from "@/lib/schemas/informe-actividades"

export const runtime = "nodejs"

export interface InformeAuditResult {
  ok: boolean
  warnings: string[]
  fechaDiligenciamiento: string | null
  filas: number
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el formulario." },
      { status: 400 }
    )
  }

  const file = formData.get("informe")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Se requiere el archivo del informe (campo 'informe')." },
      { status: 400 }
    )
  }

  // ── 1. Extraer texto del PDF ───────────────────────────────────────────────
  let text: string
  try {
    const buffer = await file.arrayBuffer()
    text = await extractTextFromPDF(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json<InformeAuditResult>({
      ok: false,
      warnings: [`No se pudo leer el PDF del informe: ${msg}`],
      fechaDiligenciamiento: null,
      filas: 0,
    })
  }

  if (!text.trim()) {
    return NextResponse.json<InformeAuditResult>({
      ok: false,
      warnings: [
        "El PDF del informe no contiene texto extraíble (¿escaneado o protegido?). No se pudo auditar.",
      ],
      fechaDiligenciamiento: null,
      filas: 0,
    })
  }

  // ── 2. Extraer datos con IA ────────────────────────────────────────────────
  let output: Awaited<
    ReturnType<typeof InformeActividadesSchema.parseAsync>
  > | null = null

  try {
    const result = await generateWithFallback({
      output: Output.object({ schema: InformeActividadesSchema }),
      prompt: `Extrae los datos del informe de actividades (formato U.FT.12.011.020 de la Universidad Nacional de Colombia).

El informe contiene una tabla con las columnas:
- Actividad (descripción de la actividad)
- Cumplimiento del Período (%) — porcentaje de avance en el período actual
- Acumulado a la Fecha (%) — porcentaje acumulado total hasta ahora

Extrae TODAS las filas con actividades. Si una celda de porcentaje está en blanco (sin número), usa null.
Extrae también la fecha de diligenciamiento del informe.

Texto del documento:
${text.slice(0, 5000)}`,
    })
    output = result.output
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json<InformeAuditResult>({
      ok: false,
      warnings: [`La IA no pudo interpretar el informe de actividades: ${msg}`],
      fechaDiligenciamiento: null,
      filas: 0,
    })
  }

  if (!output || !output.filas) {
    return NextResponse.json<InformeAuditResult>({
      ok: false,
      warnings: [
        "No se pudo interpretar la tabla del informe. Verifica que el PDF sea el formato U.FT.12.011.020.",
      ],
      fechaDiligenciamiento: null,
      filas: 0,
    })
  }

  // ── 3. Auditar los datos extraídos ────────────────────────────────────────
  const warnings: string[] = []

  // Validación 1 — campos vacíos
  let emptyCount = 0
  for (const fila of output.filas) {
    if (fila.cumplimientoPeriodo === null) emptyCount++
    if (fila.acumuladoFecha === null) emptyCount++
  }
  if (emptyCount > 0) {
    warnings.push(
      `Se detectaron ${emptyCount} campo(s) vacío(s) en la tabla del informe. ` +
        `Verifica que todas las casillas de porcentaje estén diligenciadas.`
    )
  }

  // Validación 2 — cumplimientoPeriodo ≤ acumuladoFecha
  for (let i = 0; i < output.filas.length; i++) {
    const fila = output.filas[i]
    if (
      fila.cumplimientoPeriodo !== null &&
      fila.acumuladoFecha !== null &&
      fila.cumplimientoPeriodo > fila.acumuladoFecha
    ) {
      const label = fila.actividad.slice(0, 50)
      warnings.push(
        `Fila ${i + 1} ("${label}"): el Cumplimiento del período ` +
          `(${fila.cumplimientoPeriodo}%) supera el Acumulado a la fecha ` +
          `(${fila.acumuladoFecha}%). Revisa los valores.`
      )
    }
  }

  return NextResponse.json<InformeAuditResult>({
    ok: warnings.length === 0,
    warnings,
    fechaDiligenciamiento: output.fechaDiligenciamiento,
    filas: output.filas.length,
  })
}
