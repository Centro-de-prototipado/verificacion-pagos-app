import { z } from "zod"

/** Regex para período MM/YYYY (ej. 04/2026) */
const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/

export const ManualFormSchema = z.object({
  // ── Contrato ──────────────────────────────────────────────────────────────
  contractCount: z.enum(["1", "2"], {
    error: "Selecciona 1 o 2 contratos",
  }),

  quipuCompany: z
    .string()
    .min(1, "El código QUIPU es requerido")
    .regex(/^\d+$/, "Solo se permiten dígitos"),

  amendmentNumber: z.string().optional(),

  additionNumber: z.string().optional(),

  // ── Pago ──────────────────────────────────────────────────────────────────
  paymentsToRequest: z.coerce
    .number({ error: "Debe ser un número" })
    .int("Debe ser un entero")
    .min(1, "Mínimo 1 pago")
    .max(24, "Máximo 24 pagos"),

  paymentNumber: z.coerce
    .number({ error: "Debe ser un número" })
    .int("Debe ser un entero")
    .min(1, "Mínimo pago 1"),

  amountToCharge: z.coerce
    .number({ error: "Debe ser un número" })
    .positive("Debe ser mayor a 0"),

  paymentRequestPeriod: z
    .string()
    .regex(periodRegex, "Usa el formato MM/YYYY — ej. 04/2026"),

  paymentType: z.enum(["Parcial", "Final", "Único"], {
    error: "Selecciona el tipo de pago",
  }),

  // ── Dependencia ───────────────────────────────────────────────────────────
  dependencia: z.string().min(1, "La dependencia es requerida"),

  // ── Contratista ───────────────────────────────────────────────────────────
  institutionalEmail: z.string().email("Correo electrónico inválido"),

  isPensioner: z.boolean(),

  // ── Documentos para soporte de deducciones ───────────────────────────────
  deductionDependents: z.boolean(),
  deductionHealthPolicy: z.boolean(),
  deductionMortgageInterest: z.boolean(),
  deductionPrepaidMedicine: z.boolean(),
  deductionAFC: z.boolean(),
  deductionVoluntaryPension: z.boolean(),

  // ── Interventor / Supervisor ──────────────────────────────────────────────
  supervisorName: z
    .string()
    .min(1, "Nombre del interventor o supervisor requerido"),

  supervisorDocumentNumber: z
    .string()
    .min(1, "Número de identificación del supervisor requerido"),

  supervisorEmail: z.string().email("Correo del supervisor inválido"),

  supervisorPhone: z.string().min(1, "Teléfono del supervisor requerido"),
})

export type ManualFormInput = z.infer<typeof ManualFormSchema>
