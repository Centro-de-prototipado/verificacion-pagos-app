import { z } from "zod"

export const InformeFilaSchema = z.object({
  actividad: z.string().describe("Nombre o descripción breve de la actividad"),
  cumplimientoPeriodo: z
    .number()
    .nullable()
    .describe(
      "Porcentaje de cumplimiento del período actual (0-100). Null si la celda está en blanco."
    ),
  acumuladoFecha: z
    .number()
    .nullable()
    .describe(
      "Porcentaje acumulado a la fecha (0-100). Null si la celda está en blanco."
    ),
})

export const InformeActividadesSchema = z.object({
  fechaDiligenciamiento: z
    .string()
    .nullable()
    .describe(
      "Fecha de diligenciamiento del informe en formato DD/MM/YYYY. Null si no aparece."
    ),
  filas: z
    .array(InformeFilaSchema)
    .describe("Todas las filas con actividades de la tabla del informe."),
})

export type InformeFilaExtracted = z.infer<typeof InformeFilaSchema>
export type InformeActividadesExtracted = z.infer<
  typeof InformeActividadesSchema
>
