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
 * Gavela de días permitida entre fechas ARL y fechas del contrato.
 * Las fechas de cobertura ARL pueden diferir hasta 2 días respecto al contrato.
 */
export const GAVELA_DIAS_ARL = 2
