import { z } from "zod"

export const ARLSchema = z.object({
  startDate: z
    .string()
    .describe("Fecha de inicio de la cobertura en formato YYYY-MM-DD"),
  endDate: z
    .string()
    .describe("Fecha de fin de la cobertura en formato YYYY-MM-DD"),
  coverageStatus: z
    .enum(["ACTIVA", "INACTIVA", "SUSPENDIDA"])
    .describe("Estado actual de la afiliación ARL"),
  riskClass: z
    .enum(["I", "II", "III", "IV", "V"])
    .describe("Clase de riesgo laboral (I a V) — romano, mayúscula"),
  cotizationRate: z
    .number()
    .transform((v) => Math.round(v * 10000) / 10000)
    .describe(
      "Tasa de cotización ARL en porcentaje (ej: 1.044 para 1.044%). " +
        "Buscar campo 'Tasa cotización' o similar en el certificado."
    ),
})

export type ARLExtracted = z.infer<typeof ARLSchema>
