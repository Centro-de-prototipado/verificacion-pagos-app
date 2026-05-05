import { z } from "zod"

// Normalizes any date to YYYY-MM-DD (accepts both ISO and DD/MM/YYYY input)
const toISO = (v: string) => {
  const dmy = v.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : v
}

export const ARLSchema = z.object({
  startDate: z
    .string()
    .transform(toISO)
    .describe("Fecha de inicio de la cobertura en formato YYYY-MM-DD"),
  endDate: z
    .string()
    .transform(toISO)
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
  contractorName: z.string().describe("Nombre completo del contratista que aparece en el certificado ARL"),
  documentNumber: z.string().describe("Número de documento (CC o NIT) del contratista en la ARL"),
})

export type ARLExtracted = z.infer<typeof ARLSchema>
