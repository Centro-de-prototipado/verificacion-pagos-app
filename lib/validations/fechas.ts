import { differenceInCalendarDays, parse, parseISO } from "date-fns"
import { GAVELA_DIAS_ARL } from "./constantes"
import type { ARLData, PaymentSheetData, ValidationResult } from "@/lib/types"

/** Parsea DD/MM/YYYY → Date (formato que devuelve la planilla PILA). */
function parseDDMMYYYY(date: string): Date {
  return parse(date, "dd/MM/yyyy", new Date())
}

/**
 * Valida que la fecha de pago de la planilla no exceda el plazo permitido.
 * Regla: paymentDate ≤ paymentDeadline.
 */
export function validarFechaPago(sheet: PaymentSheetData): ValidationResult {
  if (!sheet.paymentDeadline) {
    return {
      ok: true,
      blocking: false,
      type: "date",
      message: "Fecha límite de pago no disponible — no se verificó extemporaneidad.",
    }
  }
  const fechaPago = parseDDMMYYYY(sheet.paymentDate)
  const plazo = parseDDMMYYYY(sheet.paymentDeadline)
  const ok = fechaPago <= plazo
  return {
    ok,
    // Pago vencido no bloquea — requiere adjuntar planilla del mes siguiente
    blocking: false,
    type: "date",
    message: ok
      ? "Pago de planilla realizado dentro del plazo."
      : `Planilla pagada el ${sheet.paymentDate} excede el plazo ${sheet.paymentDeadline}. Pago extemporáneo — adjunta la planilla del mes siguiente.`,
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
  const arlStart = parseISO(arl.startDate)
  const arlEnd = parseISO(arl.endDate)
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

/**
 * Calcula el número de meses entre dos fechas ISO.
 * Usa diferencia de meses calendario redondeada.
 */
export function calcularMesesContrato(
  startDate: string,
  endDate: string
): number {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const diffMs = end.getTime() - start.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4375)
  return Math.round(diffMonths)
}
