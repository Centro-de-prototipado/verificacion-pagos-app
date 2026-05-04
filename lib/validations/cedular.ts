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
  // 1. Si es el primer pago, siempre es SI
  if (paymentNumber === 1) return "SI"

  // 2. Normalizar períodos para comparación (quitar espacios y asegurar MM/YYYY)
  const normalize = (p: string) => {
    const trimmed = p.trim().toLowerCase()
    if (!trimmed.includes("/")) return trimmed
    const [m, y] = trimmed.split("/")
    return `${m.padStart(2, "0")}/${y}`
  }

  const req = normalize(paymentRequestPeriod)
  const pay = normalize(payrollPeriod)

  // 3. Si los períodos son iguales, es SI
  if (req === pay) return "SI"

  // 4. Si son diferentes (y no es el primer pago), es NO
  return "NO"
}
