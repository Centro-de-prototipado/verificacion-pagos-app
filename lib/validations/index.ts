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

  const deadlineCalc = paymentSheet.period
    ? calcularFechaLimite(paymentSheet.period, contract.documentNumber)
    : undefined
  const fechaPagoResult = validarFechaPago(paymentSheet, deadlineCalc)
  let isLatePayment = !fechaPagoResult.ok

  if (isLatePayment && extracted.paymentSheet2) {
    const ps2 = extracted.paymentSheet2
    // Check if it's the same planilla
    if (ps2.sheetNumber === paymentSheet.sheetNumber) {
      results.push({
        ok: false,
        blocking: true,
        type: "date",
        message: "La segunda planilla adjunta es la misma que la primera. Adjunta la del mes siguiente.",
      })
    } else {
      // Check if it's the next month
      const [m1, y1] = paymentSheet.period.split("/").map(Number)
      const [m2, y2] = ps2.period.split("/").map(Number)
      const nextMonth = m1 === 12 ? 1 : m1 + 1
      const nextYear = m1 === 12 ? y1 + 1 : y1

      if (m2 === nextMonth && y2 === nextYear) {
        isLatePayment = false // Clear late payment warning
        results.push({
          ok: true,
          blocking: false,
          type: "date",
          message: `Planilla del mes siguiente (${ps2.period}) validada correctamente.`,
        })
      } else {
        results.push({
          ok: false,
          blocking: true,
          type: "date",
          message: `La segunda planilla adjunta (${ps2.period}) no corresponde al mes siguiente (${String(nextMonth).padStart(2, "0")}/${nextYear}).`,
        })
      }
    }
  } else {
    // If late payment and no second sheet yet, make it blocking
    if (isLatePayment) {
      results.push({
        ...fechaPagoResult,
        blocking: true,
      })
    } else {
      results.push(fechaPagoResult)
    }
  }

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

  let contributions: ContributionCalculation

  if (contract2 && contributions2 && manual.involvedContracts) {
    const toDate = (dmy: string) => {
      const [d, m, y] = dmy.split("/").map(Number)
      return new Date(y, m - 1, d)
    }

    const s1 = toDate(contract.startDate)
    const e1 = toDate(contract.endDate)
    const s2 = toDate(contract2.startDate)
    const e2 = toDate(contract2.endDate)

    // Determinar solapamiento
    const overlapStart = new Date(Math.max(s1.getTime(), s2.getTime()))
    const overlapEnd = new Date(Math.min(e1.getTime(), e2.getTime()))
    const hasOverlap = overlapStart <= overlapEnd

    // Determinar si el periodo de solicitud está en el solapamiento
    const [reqM, reqY] = manual.paymentRequestPeriod.split("/").map(Number)
    const periodDate = new Date(reqY, reqM - 1, 1)
    const isInOverlap = hasOverlap &&
      periodDate >= new Date(overlapStart.getFullYear(), overlapStart.getMonth(), 1) &&
      periodDate <= new Date(overlapEnd.getFullYear(), overlapEnd.getMonth(), 1)

    if (isInOverlap) {
      // HAY SOLAPAMIENTO: SE SUMAN LOS IBCs independientemente de cuál cobre
      contributions = combineContributions(
        contributions1,
        contributions2,
        manual.isPensioner,
        arl.cotizationRate
      )
      results.push({
        ok: true,
        blocking: false,
        type: "contribution",
        message: `Se detectó solapamiento con el otro contrato. Los aportes se calculan sobre la suma de IBCs.`,
      })
    } else {
      // NO HAY SOLAPAMIENTO: Solo se usa el contrato seleccionado
      contributions = manual.involvedContracts === "1" ? contributions1 : contributions2
      results.push({
        ok: true,
        blocking: false,
        type: "contribution",
        message: `No hay solapamiento de fechas. Los aportes se calculan solo para el Contrato ${manual.involvedContracts}.`,
      })
    }
  } else {
    contributions = contributions1
  }

  results.push(
    validarPago(contributions.totalObligatory, paymentSheet.totalAmountPaid)
  )

  // Validar también la segunda planilla si existe
  if (extracted.paymentSheet2) {
    const val2 = validarPago(contributions.totalObligatory, extracted.paymentSheet2.totalAmountPaid)
    results.push({
      ...val2,
      message: val2.ok
        ? `Segunda planilla: Total aportes ($${contributions.totalObligatory.toLocaleString("es-CO")}) cubiertos por planilla ${extracted.paymentSheet2.period} ($${extracted.paymentSheet2.totalAmountPaid.toLocaleString("es-CO")}).`
        : `Segunda planilla ${extracted.paymentSheet2.period}: Valor insuficiente ($${extracted.paymentSheet2.totalAmountPaid.toLocaleString("es-CO")}). Se requieren al menos $${contributions.totalObligatory.toLocaleString("es-CO")}.`,
    })
  }

  // ── 6. Tipo de pago vs Fin de contrato ─────────────────────────────────────
  if (manual.paymentType === "Final" || manual.paymentType === "Único") {
    const [d, m, y] = contract.endDate.split("/").map(Number)
    const endDate = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (today < endDate) {
      results.push({
        ok: false,
        blocking: true,
        type: "date",
        message: `El tipo de pago "${manual.paymentType}" solo se puede seleccionar a partir del fin del contrato (${contract.endDate}).`,
      })
    } else {
      results.push({
        ok: true,
        blocking: false,
        type: "date",
        message: `Tipo de pago "${manual.paymentType}" válido para la fecha actual.`,
      })
    }
  }

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
