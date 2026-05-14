import { z } from "zod"

import { dateField, docField, nameField } from "./_shared"

const NULL = " Si NO aparece o no estás seguro, devuelve null. NUNCA inventes."

export const ContractSchema = z.object({
  contractType: z
    .enum([
      "OCA", "OCO", "ODC", "ODO", "OPS", "OSE", "OSU",
      "CCO", "CDA", "CDC", "CDO", "CIS", "CON", "COV", "CPS", "CSE", "CSU",
      "OEF", "OFA", "OFC", "OFO", "OFS", "OOF", "OSF", "OUF",
      "CAF", "CCF", "CIF", "COF", "CPF", "CSF", "CTF", "CUF", "CVF",
    ])
    .nullable()
    .describe(
      "Sigla de 3 letras del tipo de orden/contrato. " +
        "BUSCA al inicio del documento o después de: 'Tipo de Orden', 'Tipo de Contrato', " +
        "'Modalidad', encabezados como 'ORDEN DE PRESTACIÓN DE SERVICIOS (OPS)'. " +
        "Las siglas más comunes: OPS (prestación de servicios), OSE (servicios), " +
        "CCO, CPS, OCA. " +
        NULL
    ),
  orderNumber: z
    .string()
    .nullable()
    .describe(
      "Número de la orden o contrato (solo el número, sin tipo ni año). " +
        "BUSCA después de: 'Número de Orden', 'No. Orden', 'Orden N°', " +
        "'Número Contrato', 'No. Contrato'. " +
        "IGNORA: número de QUIPU, número de radicado, números de anexos." +
        NULL
    ),
  contractorName: nameField()
    .nullable()
    .describe(
      "Nombre del CONTRATISTA (persona natural que presta el servicio). " +
        "BUSCA después de: 'El Contratista', 'Contratista:', 'Datos del Contratista', " +
        "'Nombre del Contratista', o en el encabezado tras 'entre … y'. " +
        "IGNORA y NUNCA uses: 'Universidad Nacional de Colombia' (es la entidad contratante), " +
        "'Supervisor', 'Interventor', 'Ordenador del Gasto', funcionarios firmantes." +
        NULL
    ),
  documentType: z
    .enum(["CC", "NIT", "CE"])
    .nullable()
    .describe(
      "Tipo de documento del contratista (CC, NIT o CE). " +
        "Generalmente CC para personas naturales colombianas, CE para extranjeros, " +
        "NIT para personas jurídicas." +
        NULL
    ),
  documentNumber: docField()
    .nullable()
    .describe(
      "Documento del CONTRATISTA (la persona natural). " +
        "BUSCA después de: 'CC del Contratista', 'Identificación del Contratista', " +
        "'C.C.', 'Cédula'. " +
        "IGNORA SIEMPRE: NIT de UNAL (899999063 / 899.999.063), NIT del Ordenador del Gasto, " +
        "documentos de supervisores o interventores, NITs institucionales." +
        NULL
    ),
  totalValueBeforeTax: z
    .number()
    .nullable()
    .describe(
      "Valor total del contrato en COP antes de descuentos, número sin separadores. " +
        "BUSCA después de: 'Valor Total', 'Valor del Contrato', 'Cuantía', " +
        "'Valor Total a Pagar', 'Valor Antes de Descuentos'. " +
        "IGNORA: pagos mensuales individuales, valor por cuota, IVA por separado." +
        NULL
    ),
  startDate: dateField()
    .nullable()
    .describe("Fecha inicio (DD/MM/YYYY) — opcional, se sobreescribe con ARL."),
  endDate: dateField()
    .nullable()
    .describe("Fecha fin (DD/MM/YYYY) — opcional, se sobreescribe con ARL."),
  activityReport: z
    .object({
      required: z.boolean(),
      frequencyMonths: z.number().nullable(),
    })
    .nullable()
    .describe(
      "¿Exige informe de actividades y cada cuántos meses? " +
        "Busca cláusulas tipo 'el contratista deberá presentar informe mensual/trimestral/etc'."
    ),
  specificObligations: z
    .array(z.string())
    .describe(
      "OBLIGACIONES ESPECÍFICAS DEL CONTRATISTA — un item del array por cada obligación. " +
        "Busca la sección titulada 'OBLIGACIONES ESPECÍFICAS DEL CONTRATISTA' (no las generales). " +
        "Si no encuentras la sección, devuelve []."
    ),
})

export type ContractExtracted = z.infer<typeof ContractSchema>
