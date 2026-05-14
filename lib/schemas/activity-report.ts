import { z } from "zod"

import { dateField, docField, nameField } from "./_shared"

const NULL_INSTRUCTION =
  "Si el dato NO aparece o no estás seguro, devuelve null. NUNCA inventes."

export const ActivityReportSchema = z.object({
  items: z
    .array(
      z.object({
        activityDescription: z.string(),
        periodPercentage: z.number(),
        accumulatedPercentage: z.number(),
      })
    )
    .describe(
      "Una entrada por cada obligación de la columna 'OBLIGACIÓN ESPECÍFICA' " +
        "(IGNORA 'Actividades Ejecutadas'). Devuelve [] si no hay tabla."
    ),
  signatureDate: dateField()
    .nullable()
    .describe("Fecha de firma (DD/MM/YYYY). " + NULL_INSTRUCTION),
  periodFrom: dateField()
    .nullable()
    .describe("Periodo informe Desde (DD/MM/YYYY). " + NULL_INSTRUCTION),
  periodTo: dateField()
    .nullable()
    .describe("Periodo informe Hasta (DD/MM/YYYY). " + NULL_INSTRUCTION),
  opsStartDate: dateField()
    .nullable()
    .describe("Plazo OPS — inicio (DD/MM/YYYY). " + NULL_INSTRUCTION),
  opsEndDate: dateField()
    .nullable()
    .describe("Plazo OPS — fin (DD/MM/YYYY). " + NULL_INSTRUCTION),
  contractorName: nameField()
    .nullable()
    .describe("Nombre del contratista. " + NULL_INSTRUCTION),
  documentNumber: docField()
    .nullable()
    .describe("C.C. / C.E. del contratista. " + NULL_INSTRUCTION),
  isSigned: z.boolean().describe("¿Hay firma o sello al final?"),
})

export type ActivityReportExtracted = z.infer<typeof ActivityReportSchema>
