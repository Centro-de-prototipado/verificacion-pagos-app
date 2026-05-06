import { z } from "zod"

// Normalizes any date to DD/MM/YYYY (accepts both DD/MM/YYYY and ISO input)
const toDMY = (v: string) => {
  const iso = v.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/)
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : v
}

export const ContractSchema = z.object({
  contractType: z
    .enum([
      // Órdenes contractuales
      "OCA",
      "OCO",
      "ODC",
      "ODO",
      "OPS",
      "OSE",
      "OSU",
      // Contratos
      "CCO",
      "CDA",
      "CDC",
      "CDO",
      "CIS",
      "CON",
      "COV",
      "CPS",
      "CSE",
      "CSU",
      // Órdenes vigencia futura
      "OEF",
      "OFA",
      "OFC",
      "OFO",
      "OFS",
      "OOF",
      "OSF",
      "OUF",
      // Contratos vigencia futura
      "CAF",
      "CCF",
      "CIF",
      "COF",
      "CPF",
      "CSF",
      "CTF",
      "CUF",
      "CVF",
    ])
    .describe(
      "Tipo de orden o contrato. Busca la sigla de 3 letras: OSE, OPS, CCO, etc."
    ),
  orderNumber: z.string().describe("Número de la orden o contrato"),
  contractorName: z
    .string()
    .describe(
      "Nombre completo del contratista tal como aparece en el documento"
    ),
  documentType: z
    .enum(["CC", "NIT", "CE"])
    .describe("Tipo de documento de identidad del contratista"),
  documentNumber: z.string().describe("Número de documento de identidad"),
  totalValueBeforeTax: z
    .number()
    .describe(
      "Valor total del contrato en COP antes de descuentos e impuestos, como número sin separadores de miles"
    ),
  startDate: z
    .string()
    .transform(toDMY)
    .optional()
    .default("")
    .describe("Fecha de inicio del contrato en formato DD/MM/YYYY (opcional — se sobreescribe con fechas de la ARL)"),
  endDate: z
    .string()
    .transform(toDMY)
    .optional()
    .default("")
    .describe("Fecha de terminación del contrato en formato DD/MM/YYYY (opcional — se sobreescribe con fechas de la ARL)"),
  activityReport: z.object({
    required: z
      .boolean()
      .describe("Indica si el contrato exige informe de actividades"),
    frequencyMonths: z
      .number()
      .nullable()
      .describe(
        "Frecuencia del informe en número de meses; null si no se requiere informe"
      ),
  }),
  specificObligations: z
    .array(z.string())
    .describe(
      "Lista de las OBLIGACIONES ESPECIFICAS DEL CONTRATISTA tal como aparecen en el contrato."
    ),
})

export type ContractExtracted = z.infer<typeof ContractSchema>
