import { z } from "zod"

export const ActivityReportSchema = z.object({
  items: z.array(
    z.object({
      activityDescription: z.string().describe("Texto de la columna 'OBLIGACIÓN ESPECÍFICA (Incluir cada obligación tal como se pactó en la OPS)'. IGNORA la de Actividades Ejecutadas."),
      periodPercentage: z.number().describe("Valor de la columna Periodo (%) para este item"),
      accumulatedPercentage: z.number().describe("Valor de la columna Acumulada a la fecha (%) para este item"),
    })
  ),
  signatureDate: z.string().describe("Fecha después de 'En constancia de lo anterior, se firma el presente informe el' (DD/MM/YYYY)"),
  periodFrom: z.string().describe("PERIODO DEL INFORME: Desde (DD/MM/YYYY)"),
  periodTo: z.string().describe("PERIODO DEL INFORME: Hasta (DD/MM/YYYY)"),
  opsStartDate: z.string().describe("PLAZO OPS: Fecha inicio (DD/MM/YYYY)"),
  opsEndDate: z.string().describe("PLAZO OPS: Fecha Terminación (DD/MM/YYYY)"),
  contractorName: z.string().describe("Nombre del contratista que aparece en el informe (usualmente arriba o en el bloque de firma)"),
  documentNumber: z.string().describe("C.C. / C.E. No. del contratista"),
  isSigned: z.boolean().describe("¿El documento parece estar firmado? Busca firmas manuscritas o sellos al final."),
})

export type ActivityReportExtracted = z.infer<typeof ActivityReportSchema>
