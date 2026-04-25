/**
 * Regla cedular — determina la declaración formal para disminución de
 * base de retención (campo formalDeclaration del formato 069).
 *
 * Reglas:
 *   numeroPago = 1                                    → "SI"
 *   numeroPago ≥ 2 && periodoSolicitud ≠ periodoPlanilla → "NO"
 *   resto                                             → "SI"
 *
 * Los períodos se comparan como cadenas "MM/YYYY".
 */
export function calcularDeclaracionCedular(
  paymentNumber: number,
  paymentRequestPeriod: string,
  payrollPeriod: string
): "SI" | "NO" {
  if (paymentNumber === 1) return "SI"
  if (paymentRequestPeriod !== payrollPeriod) return "NO"
  return "SI"
}
