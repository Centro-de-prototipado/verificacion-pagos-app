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

  payrollPeriod: z
    .string()
    .regex(periodRegex, "Usa el formato MM/YYYY — ej. 03/2026"),

  // ── Contratista ───────────────────────────────────────────────────────────
  institutionalEmail: z
    .string()
    .email("Correo electrónico inválido")
    .regex(/@unal\.edu\.co$/, "Debe ser un correo @unal.edu.co"),

  isPensioner: z.boolean(),
})

export type ManualFormInput = z.infer<typeof ManualFormSchema>
