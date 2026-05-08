// ─── Constantes normativas Colombia 2026 ─────────────────────────────────────
// ⚠️ Actualizar cada enero: SMMLV_ANIO, SMMLV_2026 y decretos vigentes.

/** Año al que corresponden las constantes normativas. Actualizar cada enero. */
export const SMMLV_ANIO = 2026

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

// ─── Fondo de Solidaridad Pensional (FSP) ────────────────────────────────────
// Aplica a contratistas independientes cuando la base de cotización supera el umbral.
// Ley 100/1993 art. 27, Decreto 1833/2016.

/** Aplica 1% de FSP cuando base de cotización > FSP_UMBRAL_1 × SMMLV */
export const FSP_UMBRAL_1 = 4
/** Aplica 2% total (solidaridad + subsistencia) cuando base > FSP_UMBRAL_2 × SMMLV */
export const FSP_UMBRAL_2 = 16
export const FSP_TASA_1 = 0.01
export const FSP_TASA_2 = 0.02
