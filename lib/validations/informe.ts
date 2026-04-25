import type { ContractData, ValidationResult } from "@/lib/types"

/**
 * Valida si el informe de actividades es requerido para este pago y
 * si fue presentado.
 *
 * Reglas:
 *   - Si el contrato no requiere informe → N/A, siempre ok.
 *   - Si el contrato requiere informe cada N meses y el número de pago
 *     es múltiplo de N → el informe debe haberse recibido.
 *   - En cualquier otro caso → N/A para este pago.
 *
 * @param contract     Datos extraídos del contrato.
 * @param paymentNumber Número de pago actual (1-based).
 * @param informeRecibido Si el supervisor marcó que recibió el informe.
 */
export function validarInformeActividades(
  contract: ContractData,
  paymentNumber: number,
  informeRecibido: boolean | "N/A"
): ValidationResult {
  const { required, frequencyMonths } = contract.activityReport

  if (!required || frequencyMonths === null) {
    return {
      ok: true,
      blocking: false,
      type: "report",
      message: "El contrato no exige informe de actividades.",
    }
  }

  const requiereEnEstePago = paymentNumber % frequencyMonths === 0
  if (!requiereEnEstePago) {
    return {
      ok: true,
      blocking: false,
      type: "report",
      message: `Informe de actividades no requerido en el pago ${paymentNumber}.`,
    }
  }

  if (informeRecibido === true) {
    return {
      ok: true,
      blocking: false,
      type: "report",
      message: `Informe de actividades recibido en el pago ${paymentNumber}.`,
    }
  }

  return {
    ok: false,
    blocking: true,
    type: "report",
    message: `El contrato exige informe de actividades cada ${frequencyMonths} meses. No se recibió en el pago ${paymentNumber}.`,
  }
}

/**
 * Determina el valor de activityReportReceived para el formato 053.
 * - Si el contrato no requiere informe → "N/A"
 * - Si requiere y se recibió → true
 * - Si requiere pero no se recibió → false (la validación bloqueará antes)
 */
export function resolverInforme053(
  contract: ContractData,
  paymentNumber: number,
  informeRecibido: boolean
): boolean | "N/A" {
  const { required, frequencyMonths } = contract.activityReport
  if (!required || frequencyMonths === null) return "N/A"
  const requiereEnEstePago = paymentNumber % frequencyMonths === 0
  if (!requiereEnEstePago) return "N/A"
  return informeRecibido
}
