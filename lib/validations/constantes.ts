// ─── Constantes normativas Colombia 2026 ─────────────────────────────────────
// Verificar y actualizar anualmente en lib/validations/constantes.ts

/** Porcentaje IBC: 40% del valor mensualizado del contrato */
export const IBC_PORCENTAJE = 0.4

/** Aporte obligatorio salud: 12.5% del base de cotización */
export const APORTE_SALUD_PORCENTAJE = 0.125

/** Aporte obligatorio pensión: 16% de la base de cotización */
export const APORTE_PENSION_PORCENTAJE = 0.16

/**
 * Salario Mínimo Mensual Legal Vigente (SMMLV) 2026.
 * Si IBC calculado < SMMLV, los aportes se calculan sobre el SMMLV.
 * Derivado del ejemplo real: 12.5% × base = $218.900 → base = $1.751.200.
 * ⚠️ Confirmar con decreto oficial antes de producción.
 */
export const SMMLV_2026 = 1_751_200

/**
 * ARL por clase de riesgo — valores de referencia aproximados.
 * El cálculo real es: tasaCotizacion (del certificado ARL) × base_cotizacion.
 * Estos valores son solo para validación rápida cuando no se tiene la tasa.
 * Ejemplo real: Riesgo II, tasa 1.044% × $1.751.200 = ~$18.300.
 * ⚠️ Confirmar tabla vigente 2026 antes de producción.
 */
export const ARL_FIJA_POR_CLASE: Record<string, number> = {
  I: 10_000,
  II: 20_000,
  III: 50_000,
  IV: 90_000,
  V: 120_000,
}

/**
 * Gavela de días permitida entre fechas ARL y fechas del contrato.
 * Las fechas de cobertura ARL pueden diferir hasta 2 días respecto al contrato.
 */
export const GAVELA_DIAS_ARL = 2

/**
 * Umbral en UVT para la nota de anexos del formato 069.
 * Si ingresos mensuales < 95 UVT no se exigen documentos de deducciones.
 * ⚠️ El valor UVT 2026 debe confirmarse con la DIAN.
 */
export const UMBRAL_UVT_ANEXOS = 95
