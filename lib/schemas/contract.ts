import { z } from "zod";

export const ContractSchema = z.object({
  contractType: z
    .enum(["OSE", "OPS", "OCE", "OFS", "OCO", "ODS", "ODO", "OCU"])
    .describe("Tipo de orden o contrato"),
  orderNumber: z.string().describe("Número de la orden o contrato"),
  contractorName: z
    .string()
    .describe("Nombre completo del contratista tal como aparece en el documento"),
  documentType: z
    .enum(["CC", "NIT", "CE"])
    .describe("Tipo de documento de identidad del contratista"),
  documentNumber: z.string().describe("Número de documento de identidad"),
  totalValueBeforeTax: z
    .number()
    .describe(
      "Valor total del contrato en COP antes de descuentos e impuestos, como número sin separadores de miles",
    ),
  activityReport: z.object({
    required: z
      .boolean()
      .describe("Indica si el contrato exige informe de actividades"),
    frequencyMonths: z
      .number()
      .nullable()
      .describe(
        "Frecuencia del informe en número de meses; null si no se requiere informe",
      ),
  }),
});

export type ContractExtracted = z.infer<typeof ContractSchema>;
