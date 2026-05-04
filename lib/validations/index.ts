import type {
  ExtractedData,
  ManualFormData,
  ValidationResult,
  ContributionCalculation,
} from "@/lib/types"
import { validarFechaPago, validarGavelaARL } from "./fechas"
import { calcularFechaLimite } from "./fecha-limite"
import { calcularDeclaracionCedular } from "./cedular"
import {
  calcularContribuciones,
  combineContributions,
  validarPago,
} from "./aportes"

import { validarInformeActividades } from "./informe"

export interface ValidationSummary {
  results: ValidationResult[]
  /** Combined contributions (sum of both when two contracts). Used for PDF and payment validation. */
  contributions: ContributionCalculation | null
  /** First contract's individual contributions. Equals `contributions` when only one contract. */
  contributions1: ContributionCalculation | null
  /** Second contract's individual contributions. Present only when contractCount === "2". */
  contributions2: ContributionCalculation | null
  /** true when at least one blocking result failed */
  blocked: boolean
  /** true when planilla was paid after its deadline — user must upload next month's planilla */
  isLatePayment: boolean
  /** Declaración cedular: "SI" | "NO" */
  formalDeclaration: "SI" | "NO"
}

/**
 * Runs all business-rule validations and returns a summary.
 * Pure function — no I/O, no AI.
 */
export function runValidations(
  extracted: ExtractedData,
  manual: ManualFormData,
  informeAdjunto = false
): ValidationSummary {
  const { paymentSheet, arl, contract } = extracted
  const results: ValidationResult[] = []

  if (!paymentSheet || !arl || !contract) {
    results.push({
      ok: false,
      blocking: true,
      type: "contribution",
      message:
        "Faltan datos extraídos. Asegúrate de que la extracción completó sin errores.",
    })
    return {
      results,
      contributions: null,
      contributions1: null,
      contributions2: null,
      blocked: true,
      isLatePayment: false,
      formalDeclaration: "SI",
    }
  }

  // ── 1. Estado cobertura ARL ──────────────────────────────────────────────────
  if (arl.coverageStatus !== "ACTIVA") {
    results.push({
      ok: false,
      blocking: true,
      type: "date",
      message: `La cobertura ARL figura como "${arl.coverageStatus}". Debe estar ACTIVA para continuar.`,
    })
  } else {
    results.push({
      ok: true,
      blocking: false,
      type: "date",
      message: "Cobertura ARL activa.",
    })
  }

  // ── 2. Fecha de pago dentro del plazo ────────────────────────────────────────
  const deadlineCalc = paymentSheet.period
    ? calcularFechaLimite(paymentSheet.period, contract.documentNumber)
    : undefined
  const fechaPagoResult = validarFechaPago(paymentSheet, deadlineCalc)
  const isLatePayment = !fechaPagoResult.ok
  results.push(fechaPagoResult)

  // ── 3. Gavela ARL ─────────────────────────────────────────────────────────
  const toISO = (ddmmyyyy: string) => {
    const [d, m, y] = ddmmyyyy.split("/")
    return `${y}-${m}-${d}`
  }
  results.push(
    validarGavelaARL(arl, toISO(contract.startDate), toISO(contract.endDate))
  )

  // ── 4. Informe de actividades ─────────────────────────────────────────────
  const { required, frequencyMonths } = contract.activityReport
  if (required && frequencyMonths !== null) {
    const requiereEnEstePago = manual.paymentNumber % frequencyMonths === 0
    if (requiereEnEstePago) {
      if (!informeAdjunto) {
        results.push({
          ok: false,
          blocking: false,
          type: "report",
          message: `El contrato exige informe de actividades cada ${frequencyMonths} mes(es). No se adjuntó en este pago — recuerda incluirlo.`,
        })
      } else if (extracted.activityReport) {
        // Validation of report content
        const reportResults = validarInformeActividades(
          extracted.activityReport,
          contract
        )
        results.push(...reportResults)
      } else {
        results.push({
          ok: true,
          blocking: false,
          type: "report",
          message: `Informe de actividades adjunto para el pago ${manual.paymentNumber}.`,
        })
      }
    }
  }

  // ── 5. Aportes ────────────────────────────────────────────────────────────
  const contributions1 = calcularContribuciones(
    contract,
    arl,
    manual.isPensioner
  )
  const contract2 = extracted.contract2 ?? null
  const contributions2 = contract2
    ? calcularContribuciones(contract2, arl, manual.isPensioner)
    : null
  const contributions = contributions2
    ? combineContributions(contributions1, contributions2)
    : contributions1
  results.push(
    validarPago(contributions.totalObligatory, paymentSheet.totalAmountPaid)
  )

  // ── 5. Declaración cedular ────────────────────────────────────────────────
  const formalDeclaration = calcularDeclaracionCedular(
    manual.paymentNumber,
    manual.paymentRequestPeriod,
    paymentSheet.period
  )

  const blocked = results.some((r) => !r.ok && r.blocking)

  return {
    results,
    contributions,
    contributions1,
    contributions2,
    blocked,
    isLatePayment,
    formalDeclaration,
  }
}
