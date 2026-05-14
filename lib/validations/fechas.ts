import { differenceInCalendarDays, parse, parseISO } from "date-fns"
import { GAVELA_DIAS_ARL } from "./constantes"
import { calcularFechaLimite } from "./fecha-limite"
import type { ARLData, PaymentSheetData, ValidationResult } from "@/lib/types"

/** Parsea DD/MM/YYYY → Date (formato que devuelve la planilla PILA). */
function parseDDMMYYYY(date: string): Date {
  return parse(date, "dd/MM/yyyy", new Date())
}

/**
 * Valida que la fecha de pago de la planilla no exceda el plazo permitido.
 * @param sheet         Datos de la planilla
 * @param deadlineCalc  Fecha límite calculada por fórmula (DD/MM/YYYY) — se usa
 *                      si sheet.paymentDeadline es null
 */
export function validarFechaPago(
  sheet: PaymentSheetData,
  deadlineCalc?: string
): ValidationResult {
  const deadline = sheet.paymentDeadline ?? deadlineCalc ?? null
  if (!deadline) {
    return {
      ok: true,
      blocking: false,
      type: "date",
      message:
        "Fecha límite de pago no disponible — no se verificó extemporaneidad.",
    }
  }
  const fechaPago = parseDDMMYYYY(sheet.paymentDate)
  const plazo = parseDDMMYYYY(deadline)
  const ok = fechaPago <= plazo
  const source = sheet.paymentDeadline ? "" : " (calculada)"
  return {
    ok,
    blocking: false,
    type: "date",
    message: ok
      ? `Pago de planilla realizado dentro del plazo${source} (${deadline}).`
      : `Planilla pagada el ${sheet.paymentDate} excede el plazo${source} ${deadline}. Pago extemporáneo — adjunta la planilla del mes siguiente.`,
  }
}

/**
 * Valida que las fechas de cobertura ARL sean compatibles con las fechas del
 * contrato, con una gavela de ±GAVELA_DIAS_ARL días.
 *
 * contractStart y contractEnd en formato ISO (YYYY-MM-DD).
 */
export function validarGavelaARL(
  arl: ARLData,
  contractStart: string,
  contractEnd: string
): ValidationResult {
  const arlStart = parseDDMMYYYY(arl.startDate)
  const arlEnd = parseDDMMYYYY(arl.endDate)
  const contStart = parseISO(contractStart)
  const contEnd = parseISO(contractEnd)

  const diffStart = differenceInCalendarDays(arlStart, contStart)
  const diffEnd = differenceInCalendarDays(arlEnd, contEnd)

  const startOk = Math.abs(diffStart) <= GAVELA_DIAS_ARL
  const endOk = Math.abs(diffEnd) <= GAVELA_DIAS_ARL
  const ok = startOk && endOk

  if (ok) {
    return {
      ok: true,
      blocking: false,
      type: "date",
      message: "Fechas de cobertura ARL compatibles con el contrato.",
    }
  }

  const msgs: string[] = []
  if (!startOk)
    msgs.push(
      `Inicio ARL (${arl.startDate}) difiere ${diffStart} días del inicio del contrato (${contractStart}).`
    )
  if (!endOk)
    msgs.push(
      `Fin ARL (${arl.endDate}) difiere ${diffEnd} días del fin del contrato (${contractEnd}).`
    )

  return {
    ok: false,
    blocking: true,
    type: "date",
    message: msgs.join(" "),
  }
}

/** Returns Colombia "today" at midnight, independent of server timezone. */
function todayColombia(): Date {
  const bogota = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  )
  bogota.setHours(0, 0, 0, 0)
  return bogota
}

/**
 * Advances a MM/YYYY period by one month.
 */
function nextMonthPeriod(period: string): string {
  const [mm, yyyy] = period.split("/").map(Number)
  const nextMM = mm === 12 ? 1 : mm + 1
  const nextYYYY = mm === 12 ? yyyy + 1 : yyyy
  return `${String(nextMM).padStart(2, "0")}/${nextYYYY}`
}

export interface NextPeriodDeadlineCheck {
  nextPeriod: string      // MM/YYYY — the period that follows the submitted one
  nextDeadline: string    // DD/MM/YYYY — payment deadline for nextPeriod
  daysUntilDeadline: number  // negative = already past
  /** Today is past the next period's deadline → second planilla is mandatory */
  requiresSecondSheet: boolean
  /** "none" | "warning" (≤10 days) | "urgent" (≤3 days) | "overdue" (past deadline) */
  alertLevel: "none" | "warning" | "urgent" | "overdue"
}

/**
 * Checks whether the contractor's paperwork submission timing requires a
 * second (next month's) payment sheet.
 *
 * Rule: if today has already passed the payment deadline for the period
 * AFTER the submitted planilla's period, that next period must have been
 * paid already → attach it.  If the deadline is approaching, warn the user.
 *
 * @param period         Period of the submitted planilla (MM/YYYY)
 * @param documentNumber Contractor's document number (for the deadline formula)
 * @param today          Override for testing; defaults to Colombia today
 */
export function checkNextPeriodDeadline(
  period: string,
  documentNumber: string,
  today?: Date
): NextPeriodDeadlineCheck {
  const reference = today ?? todayColombia()
  const nextPeriod = nextMonthPeriod(period)
  const nextDeadline = calcularFechaLimite(nextPeriod, documentNumber)
  const deadlineDate = parseDDMMYYYY(nextDeadline)
  deadlineDate.setHours(23, 59, 59, 999) // inclusive end of deadline day
  const daysUntilDeadline = differenceInCalendarDays(deadlineDate, reference)
  const requiresSecondSheet = daysUntilDeadline < 0

  let alertLevel: NextPeriodDeadlineCheck["alertLevel"] = "none"
  if (requiresSecondSheet) alertLevel = "overdue"
  else if (daysUntilDeadline <= 3) alertLevel = "urgent"
  else if (daysUntilDeadline <= 10) alertLevel = "warning"

  return { nextPeriod, nextDeadline, daysUntilDeadline, requiresSecondSheet, alertLevel }
}

/**
 * Calcula el número de meses entre dos fechas ISO.
 * Usa diferencia de meses calendario redondeada.
 */
export function calcularMesesContrato(
  startDate: string,
  endDate: string
): number {
  if (!startDate || !endDate) return 1
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1
  const diffMs = end.getTime() - start.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4375)
  return Math.max(1, Math.round(diffMonths))
}
