import {
  IBC_PORCENTAJE,
  APORTE_SALUD_PORCENTAJE,
  APORTE_PENSION_PORCENTAJE,
  SMMLV_2026,
  FSP_UMBRAL_1,
  FSP_UMBRAL_2,
  FSP_TASA_1,
  FSP_TASA_2,
} from "./constantes"
import { calcularMesesContrato } from "./fechas"
import type {
  ARLData,
  ContractData,
  ContributionCalculation,
  ValidationResult,
} from "@/lib/types"

/**
 * Calcula el valor mensualizado de un contrato.
 * valorTotal / numeroDeMeses
 */
export function calcularValorMensualizado(
  totalValueBeforeTax: number,
  contractMonths: number
): number {
  return totalValueBeforeTax / contractMonths
}

/**
 * Calcula el IBC bruto (antes de aplicar piso SMMLV).
 * IBC = 40% × valor mensualizado
 */
export function calcularIBC(monthlyValue: number): number {
  return monthlyValue * IBC_PORCENTAJE
}

/**
 * Base de cotización efectiva: max(IBC, SMMLV).
 * Si el IBC es inferior al SMMLV los aportes se calculan sobre el SMMLV.
 */
export function calcularBaseEfectiva(ibc: number): number {
  return Math.max(ibc, SMMLV_2026)
}

/** Aporte salud: 12.5% × base efectiva */
export function calcularAporteSalud(calculationBase: number): number {
  return Math.round(calculationBase * APORTE_SALUD_PORCENTAJE)
}

/** Aporte pensión: 16% × base efectiva */
export function calcularAportePension(calculationBase: number): number {
  return Math.round(calculationBase * APORTE_PENSION_PORCENTAJE)
}

/**
 * Fondo de Solidaridad Pensional (FSP).
 * Aplica cuando la base de cotización supera 4 × SMMLV.
 * Por encima de 16 × SMMLV se aplica la tasa mayor (solidaridad + subsistencia).
 */
export function calcularFSP(calculationBase: number): number {
  if (calculationBase <= FSP_UMBRAL_1 * SMMLV_2026) return 0
  if (calculationBase <= FSP_UMBRAL_2 * SMMLV_2026)
    return Math.round(calculationBase * FSP_TASA_1)
  return Math.round(calculationBase * FSP_TASA_2)
}

/**
 * Aporte ARL: tasaCotizacion (del certificado) × base efectiva.
 * cotizationRate viene como porcentaje, e.g. 1.044 para 1.044%.
 */
export function calcularAporteARL(
  cotizationRate: number,
  calculationBase: number
): number {
  return Math.round(calculationBase * (cotizationRate / 100))
}

/**
 * Suma dos ContributionCalculation (caso de dos contratos simultáneos).
 * Los campos de base se toman del primero; los monetarios se suman.
 */
export function combineContributions(
  c1: ContributionCalculation,
  c2: ContributionCalculation,
  isPensioner: boolean,
  cotizationRate: number,
  overlapMonths?: number
): ContributionCalculation {
  const totalMonthlyValue = c1.monthlyValue + c2.monthlyValue
  const totalIBC = c1.ibc + c2.ibc
  const effectiveBase = calcularBaseEfectiva(totalIBC)

  const healthContribution = calcularAporteSalud(effectiveBase)
  const pensionContribution = isPensioner ? 0 : calcularAportePension(effectiveBase)
  const arlContribution = calcularAporteARL(cotizationRate, effectiveBase)
  const solidarityFund = calcularFSP(effectiveBase)

  const totalObligatory =
    healthContribution + pensionContribution + arlContribution + solidarityFund

  return {
    calculationBase: effectiveBase,
    monthlyValue: totalMonthlyValue,
    contractMonths: overlapMonths ?? Math.max(c1.contractMonths, c2.contractMonths),
    ibc: totalIBC,
    healthContribution,
    pensionContribution,
    arlContribution,
    solidarityFund,
    totalObligatory,
    monthlyRetentionBase: totalMonthlyValue,
  }
}

/**
 * Regla bloqueante: si el total de aportes obligatorios supera el valor
 * pagado en planilla, el pago es insuficiente y no puede continuar.
 */
export function validarPago(
  totalObligatory: number,
  totalAmountPaid: number
): ValidationResult {
  const ok = totalObligatory <= totalAmountPaid
  return {
    ok,
    blocking: !ok,
    type: "contribution",
    message: ok
      ? `Total aportes ($${totalObligatory.toLocaleString("es-CO")}) cubiertos por planilla ($${totalAmountPaid.toLocaleString("es-CO")}).`
      : `Aportes obligatorios ($${totalObligatory.toLocaleString("es-CO")}) superan el valor pagado en planilla ($${totalAmountPaid.toLocaleString("es-CO")}). Debe presentar planilla correcta.`,
  }
}

/** Convierte DD/MM/YYYY → YYYY-MM-DD para calcularMesesContrato. */
function dmyToISO(date: string): string {
  const dmy = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : date
}

/**
 * Calcula todos los aportes obligatorios al SGSSI para un contrato.
 * Los meses se derivan de las fechas del CONTRATO (startDate / endDate),
 * que es el valor total sobre el cual se mensualiza.
 * Si el contratista es pensionado, pensión y FSP se omiten.
 */
export function calcularContribuciones(
  contract: ContractData,
  arl: ARLData,
  isPensioner: boolean
): ContributionCalculation {
  // Usar fechas del contrato para calcular la duración (mensualización correcta)
  const contractMonths = calcularMesesContrato(
    dmyToISO(contract.startDate),
    dmyToISO(contract.endDate)
  )
  const monthlyValue = calcularValorMensualizado(
    contract.totalValueBeforeTax,
    contractMonths
  )
  const ibc = calcularIBC(monthlyValue)
  const calculationBase = calcularBaseEfectiva(ibc)

  const healthContribution = calcularAporteSalud(calculationBase)
  const pensionContribution = isPensioner
    ? 0
    : calcularAportePension(calculationBase)
  const arlContribution = calcularAporteARL(arl.cotizationRate, calculationBase)
  const solidarityFund = calcularFSP(calculationBase)
  const totalObligatory =
    healthContribution + pensionContribution + arlContribution + solidarityFund

  return {
    calculationBase,
    monthlyValue,
    contractMonths,
    ibc,
    healthContribution,
    pensionContribution,
    arlContribution,
    solidarityFund,
    totalObligatory,
    monthlyRetentionBase: monthlyValue,
  }
}
