import { z } from "zod"

export const PaymentSheetSchema = z.object({
  sheetNumber: z.string().describe("Número único de la planilla PILA"),
  paymentDate: z
    .string()
    .describe("Fecha de pago efectivo en formato DD/MM/YYYY"),
  paymentDeadline: z
    .string()
    .optional()
    .default("")
    .describe("Fecha límite de pago en formato DD/MM/YYYY (opcional — puede no figurar en la planilla)"),
  period: z.string().describe("Período de cotización en formato MM/YYYY"),
  totalAmountPaid: z
    .number()
    .describe(
      "Valor total pagado en pesos colombianos (COP), como número sin separadores de miles"
    ),
})

export type PaymentSheetExtracted = z.infer<typeof PaymentSheetSchema>
// https://www.gerencie.com/fecha-para-el-pago-de-la-seguridad-social.html?digitos=09
