import {
  IBC_PORCENTAJE,
  APORTE_SALUD_PORCENTAJE,
  APORTE_PENSION_PORCENTAJE,
  SMMLV_2026,
} from "./constantes"
import { calcularMesesContrato } from "./fechas"
import type { ARLData, ContractData, ContributionCalculation, ValidationResult } from "@/lib/types"

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
  c2: ContributionCalculation
): ContributionCalculation {
  return {
    calculationBase: c1.calculationBase + c2.calculationBase,
    monthlyValue: c1.monthlyValue + c2.monthlyValue,
    contractMonths: c1.contractMonths,
    ibc: c1.ibc + c2.ibc,
    healthContribution: c1.healthContribution + c2.healthContribution,
    pensionContribution: c1.pensionContribution + c2.pensionContribution,
    arlContribution: c1.arlContribution + c2.arlContribution,
    solidarityFund: c1.solidarityFund + c2.solidarityFund,
    totalObligatory: c1.totalObligatory + c2.totalObligatory,
    monthlyRetentionBase: c1.monthlyRetentionBase + c2.monthlyRetentionBase,
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

/**
 * Calcula todos los aportes obligatorios al SGSSI para un contrato.
 * Los meses se derivan de las fechas ARL (más confiables que el contrato).
 * Si el contratista es pensionado, pensión y FSP se omiten.
 */
export function calcularContribuciones(
  contract: ContractData,
  arl: ARLData,
  isPensioner: boolean
): ContributionCalculation {
  const contractMonths = calcularMesesContrato(arl.startDate, arl.endDate)
  const monthlyValue = calcularValorMensualizado(
    contract.totalValueBeforeTax,
    contractMonths
  )
  const ibc = calcularIBC(monthlyValue)
  const calculationBase = calcularBaseEfectiva(ibc)

  const healthContribution = calcularAporteSalud(calculationBase)
  const pensionContribution = isPensioner ? 0 : calcularAportePension(calculationBase)
  const arlContribution = calcularAporteARL(arl.cotizationRate, calculationBase)
  const solidarityFund = 0 // FSP pendiente confirmar: aplica cuando IBC > 4 SMMLV
  const totalObligatory = healthContribution + pensionContribution + arlContribution + solidarityFund

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
