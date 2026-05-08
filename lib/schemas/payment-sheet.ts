import { z } from "zod"

export const PaymentSheetSchema = z.object({
  sheetNumber: z.string().describe("Número único de la planilla PILA"),
  paymentDate: z
    .string()
    .describe("Fecha de pago efectivo en formato DD/MM/YYYY"),
  paymentDeadline: z
    .string()
    .nullable()
    .describe(
      "Fecha límite de pago en formato DD/MM/YYYY. Null si no figura en la planilla."
    ),
  period: z.string().describe("Período de cotización en formato MM/YYYY"),
  totalAmountPaid: z
    .number()
    .describe(
      "Valor total pagado en pesos colombianos (COP), como número sin separadores de miles"
    ),
  contractorName: z
    .string()
    .describe("Nombre del cotizante que aparece en la planilla PILA"),
  documentNumber: z
    .string()
    .describe("Número de identificación del cotizante en la planilla PILA"),
})

export type PaymentSheetExtracted = z.infer<typeof PaymentSheetSchema>
