/**
 * Field-level sanity checks.
 *
 * After extraction, validate that each value makes sense for its field.
 * Returns human-readable issues that become warnings AND downgrades the
 * confidence of the offending fields so the UI highlights them for review.
 */

import type {
  ARLData,
  ContractData,
  PaymentSheetData,
  ConfidenceMap,
} from "@/lib/types"

// ─── Patterns / lookups ──────────────────────────────────────────────────────

/**
 * Words/acronyms that should NEVER appear in a person's contractorName.
 * If the extracted name contains any of these, we almost certainly picked up
 * an institution / insurer / operator name by mistake.
 */
const COMPANY_TOKENS = [
  // Legal forms
  "S.A.S", "SAS", "S.A.", " SA ", " SA.", "LTDA", "LIMITADA", "& CIA", "Y CIA",
  // ARL companies
  "ARL", "SURA", "SURAMERICANA", "POSITIVA", "COLMENA", "COLPATRIA",
  "BOLIVAR", "BOLÍVAR", "LIBERTY", "EQUIDAD", "MAPFRE", "AXA",
  // EPS / pension funds
  "EPS", "PENSIONES", "PROTECCION", "PROTECCIÓN", "PORVENIR",
  "COLPENSIONES", "COLFONDOS", "SANITAS", "SURAEPS", "COMPENSAR",
  "FAMISANAR", "NUEVA EPS", "SALUD TOTAL", "CAFESALUD",
  // Planilla operators
  "OPERADORA", "OPERADOR", "ASOPAGOS", "SIMPLE", "APORTES EN LINEA",
  "APORTES EN LÍNEA", "ENLACE OPERATIVO", "MI PLANILLA",
  // UNAL
  "UNIVERSIDAD NACIONAL", "U. NACIONAL", "UNAL",
  // Generic institutional terms
  "COMPAÑÍA", "COMPANIA", "SEGUROS", "INSTITUTO", "FUNDACION",
  "FUNDACIÓN", "MINISTERIO", "GOBIERNO", "SECRETARÍA", "SECRETARIA",
  "EMPRESA", "CORPORACIÓN", "CORPORACION", "ASOCIACIÓN", "ASOCIACION",
]

/** Valid ARL cotization rates by risk class (with small tolerance). */
const VALID_ARL_RATES = [0.522, 1.044, 2.436, 4.35, 6.96]

/** Valid ARL risk classes. */
const VALID_RISK_CLASSES = ["I", "II", "III", "IV", "V"] as const

// ─── Format predicates ───────────────────────────────────────────────────────

const isDMY = (s: string): boolean => /^\d{2}\/\d{2}\/\d{4}$/.test(s)
const isISO = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s)
const isMY = (s: string): boolean => /^\d{2}\/\d{4}$/.test(s)

function parseDMY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  return isNaN(d.getTime()) ? null : d
}

function parseISODate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return isNaN(d.getTime()) ? null : d
}

// ─── Field sanity checks ─────────────────────────────────────────────────────

/**
 * A person's name shouldn't be an empty string, shouldn't contain digits, and
 * shouldn't contain any institutional/company token.
 */
export function looksLikePersonName(name: string | null | undefined): boolean {
  if (!name) return false
  const trimmed = name.trim()
  if (trimmed.length < 5) return false
  if (/\d/.test(trimmed)) return false
  const upper = ` ${trimmed.toUpperCase()} `
  for (const token of COMPANY_TOKENS) {
    const padded = ` ${token} `
    if (upper.includes(padded) || upper.includes(` ${token},`) ||
        upper.startsWith(`${token} `) || upper.endsWith(` ${token}`)) {
      return false
    }
  }
  // Need at least two name parts (first name + at least one surname)
  const parts = trimmed.split(/\s+/).filter((w) => w.length > 1)
  return parts.length >= 2
}

/** Colombian CC is 5-10 digits; NIT is 8-12 digits with/without check digit. */
export function looksLikeDocumentNumber(doc: string | null | undefined): boolean {
  if (!doc) return false
  const digits = doc.replace(/\D/g, "")
  return digits.length >= 5 && digits.length <= 12
}

/** Planilla numbers are typically 8-15 digits. */
export function looksLikeSheetNumber(n: string | null | undefined): boolean {
  if (!n) return false
  const digits = n.replace(/\D/g, "")
  return digits.length >= 6 && digits.length <= 16
}

export function isValidPeriod(p: string | null | undefined): boolean {
  if (!p) return false
  if (!isMY(p)) return false
  const [mm] = p.split("/").map(Number)
  return mm >= 1 && mm <= 12
}

export function isValidDate(d: string | null | undefined): boolean {
  if (!d) return false
  return isDMY(d) || isISO(d)
}

export function isValidARLRate(rate: number | null | undefined): boolean {
  if (rate == null) return false
  return VALID_ARL_RATES.some((r) => Math.abs(r - rate) < 0.01)
}

export function isValidRiskClass(c: string | null | undefined): boolean {
  if (!c) return false
  return VALID_RISK_CLASSES.includes(c as typeof VALID_RISK_CLASSES[number])
}

// ─── Result type ─────────────────────────────────────────────────────────────

export interface SanityResult {
  /** Warnings to show to the user. */
  warnings: string[]
  /** Field paths to downgrade in the confidence map (`docKey.fieldName`). */
  lowConfidenceFields: Array<{ docKey: string; field: string }>
}

// ─── Document-level checks ───────────────────────────────────────────────────

export function checkPaymentSheet(
  data: PaymentSheetData | null
): SanityResult {
  const warnings: string[] = []
  const lowConfidenceFields: Array<{ docKey: string; field: string }> = []
  const push = (field: string, msg: string) => {
    warnings.push(`Planilla — ${msg}`)
    lowConfidenceFields.push({ docKey: "paymentSheet", field })
  }
  if (!data) return { warnings, lowConfidenceFields }

  if (data.contractorName && !looksLikePersonName(data.contractorName)) {
    push(
      "contractorName",
      `el nombre extraído ("${data.contractorName}") no parece ser una persona natural. Podría ser el operador, una empresa o una entidad — verifica manualmente.`
    )
  }
  if (data.documentNumber && !looksLikeDocumentNumber(data.documentNumber)) {
    push(
      "documentNumber",
      `el número de documento "${data.documentNumber}" no tiene un formato válido (debe ser 5-12 dígitos).`
    )
  }
  if (data.sheetNumber && !looksLikeSheetNumber(data.sheetNumber)) {
    push(
      "sheetNumber",
      `el número de planilla "${data.sheetNumber}" no tiene un formato válido (debe ser 6-16 dígitos).`
    )
  }
  if (data.period && !isValidPeriod(data.period)) {
    push(
      "period",
      `el período "${data.period}" no tiene formato MM/YYYY válido.`
    )
  }
  if (data.paymentDate && !isValidDate(data.paymentDate)) {
    push(
      "paymentDate",
      `la fecha de pago "${data.paymentDate}" no tiene formato DD/MM/YYYY válido.`
    )
  }
  if (data.totalAmountPaid != null && data.totalAmountPaid <= 0) {
    push("totalAmountPaid", "el valor pagado debe ser mayor a cero.")
  }
  // Future payment date sanity: payment shouldn't be more than 1 year in future
  if (data.paymentDate && isDMY(data.paymentDate)) {
    const d = parseDMY(data.paymentDate)
    if (d) {
      const oneYearAhead = new Date()
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1)
      if (d.getTime() > oneYearAhead.getTime()) {
        push(
          "paymentDate",
          `la fecha de pago "${data.paymentDate}" está más de un año en el futuro — verifica.`
        )
      }
    }
  }
  return { warnings, lowConfidenceFields }
}

export function checkARL(data: ARLData | null): SanityResult {
  const warnings: string[] = []
  const lowConfidenceFields: Array<{ docKey: string; field: string }> = []
  const push = (field: string, msg: string) => {
    warnings.push(`ARL — ${msg}`)
    lowConfidenceFields.push({ docKey: "arl", field })
  }
  if (!data) return { warnings, lowConfidenceFields }

  if (data.contractorName && !looksLikePersonName(data.contractorName)) {
    push(
      "contractorName",
      `el nombre extraído ("${data.contractorName}") no parece ser una persona natural. Podría ser la ARL o una empresa — verifica manualmente.`
    )
  }
  if (data.documentNumber && !looksLikeDocumentNumber(data.documentNumber)) {
    push(
      "documentNumber",
      `el documento "${data.documentNumber}" no tiene un formato válido.`
    )
  }
  if (data.cotizationRate != null && !isValidARLRate(data.cotizationRate)) {
    push(
      "cotizationRate",
      `la tasa de cotización ${data.cotizationRate}% no corresponde a las tasas oficiales ARL (0.522, 1.044, 2.436, 4.350, 6.960).`
    )
  }
  if (data.riskClass && !isValidRiskClass(data.riskClass)) {
    push(
      "riskClass",
      `la clase de riesgo "${data.riskClass}" no es válida (debe ser I, II, III, IV o V).`
    )
  }
  if (data.startDate && !isValidDate(data.startDate)) {
    push("startDate", `fecha de inicio "${data.startDate}" inválida.`)
  }
  if (data.endDate && !isValidDate(data.endDate)) {
    push("endDate", `fecha de fin "${data.endDate}" inválida.`)
  }
  // Start <= End
  if (data.startDate && data.endDate) {
    const s = parseISODate(data.startDate) ?? parseDMY(data.startDate)
    const e = parseISODate(data.endDate) ?? parseDMY(data.endDate)
    if (s && e && s.getTime() > e.getTime()) {
      push(
        "endDate",
        `la fecha de fin (${data.endDate}) es anterior a la de inicio (${data.startDate}).`
      )
    }
  }
  return { warnings, lowConfidenceFields }
}

export function checkContract(
  data: ContractData | null,
  label = "Contrato"
): SanityResult {
  const warnings: string[] = []
  const lowConfidenceFields: Array<{ docKey: string; field: string }> = []
  const docKey = label === "Contrato 2" ? "contract2" : "contract"
  const push = (field: string, msg: string) => {
    warnings.push(`${label} — ${msg}`)
    lowConfidenceFields.push({ docKey, field })
  }
  if (!data) return { warnings, lowConfidenceFields }

  if (data.contractorName && !looksLikePersonName(data.contractorName)) {
    push(
      "contractorName",
      `el nombre del contratista ("${data.contractorName}") no parece ser una persona natural — verifica manualmente.`
    )
  }
  if (data.documentNumber && !looksLikeDocumentNumber(data.documentNumber)) {
    push(
      "documentNumber",
      `el documento "${data.documentNumber}" no tiene un formato válido.`
    )
  }
  if (data.totalValueBeforeTax != null && data.totalValueBeforeTax <= 0) {
    push("totalValueBeforeTax", "el valor del contrato debe ser mayor a cero.")
  }
  if (data.startDate && !isValidDate(data.startDate)) {
    push("startDate", `fecha de inicio "${data.startDate}" inválida.`)
  }
  if (data.endDate && !isValidDate(data.endDate)) {
    push("endDate", `fecha de fin "${data.endDate}" inválida.`)
  }
  if (data.startDate && data.endDate) {
    const s = parseISODate(data.startDate) ?? parseDMY(data.startDate)
    const e = parseISODate(data.endDate) ?? parseDMY(data.endDate)
    if (s && e && s.getTime() > e.getTime()) {
      push(
        "endDate",
        `la fecha de fin (${data.endDate}) es anterior a la de inicio (${data.startDate}).`
      )
    }
  }
  return { warnings, lowConfidenceFields }
}

// ─── Confidence downgrade helper ─────────────────────────────────────────────

/**
 * Mutates a confidence map to mark the given fields as "low".
 * The UI shows low-confidence fields in red so users review them.
 */
export function downgradeConfidence(
  confidence: Record<string, ConfidenceMap>,
  fields: Array<{ docKey: string; field: string }>
): void {
  for (const { docKey, field } of fields) {
    if (!confidence[docKey]) confidence[docKey] = {}
    confidence[docKey][field] = "low"
  }
}
