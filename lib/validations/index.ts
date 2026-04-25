import type {
  ExtractedData,
  ManualFormData,
  ValidationResult,
  ContributionCalculation,
} from "@/lib/types"
import { validarFechaPago, validarGavelaARL } from "./fechas"
import { validarInformeActividades, resolverInforme053 } from "./informe"
import { calcularDeclaracionCedular } from "./cedular"
import { calcularContribuciones, combineContributions, validarPago } from "./aportes"

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
  /** Resolved value for 053 activityReportReceived field */
  activityReportReceived: boolean | "N/A"
}

/**
 * Runs all business-rule validations and returns a summary.
 * Pure function — no I/O, no AI.
 */
export function runValidations(
  extracted: ExtractedData,
  manual: ManualFormData,
  informeRecibido: boolean
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
      activityReportReceived: "N/A",
    }
  }

  // ── 1. Período planilla vs manual ─────────────────────────────────────────
  if (paymentSheet.period !== manual.payrollPeriod) {
    results.push({
      ok: false,
      blocking: true,
      type: "date",
      message: `El período de la planilla (${paymentSheet.period}) no coincide con el período ingresado manualmente (${manual.payrollPeriod}). Verifica el período.`,
    })
  } else {
    results.push({
      ok: true,
      blocking: false,
      type: "date",
      message: `Período de planilla coincide con el ingresado (${manual.payrollPeriod}).`,
    })
  }

  // ── 2. Estado cobertura ARL ───────────────────────────────────────────────
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

  // ── 3. Fecha de pago dentro del plazo ────────────────────────────────────
  const fechaPagoResult = validarFechaPago(paymentSheet)
  const isLatePayment = !fechaPagoResult.ok
  results.push(fechaPagoResult)

  // ── 4. Gavela ARL ─────────────────────────────────────────────────────────
  // ContractData tiene fechas en DD/MM/YYYY; validarGavelaARL espera YYYY-MM-DD.
  const toISO = (ddmmyyyy: string) => {
    const [d, m, y] = ddmmyyyy.split("/")
    return `${y}-${m}-${d}`
  }
  results.push(
    validarGavelaARL(arl, toISO(contract.startDate), toISO(contract.endDate))
  )

  // ── 5. Informe de actividades ─────────────────────────────────────────────
  const activityReportResult = validarInformeActividades(
    contract,
    manual.paymentNumber,
    informeRecibido
  )
  results.push(activityReportResult)

  // ── 6. Aportes ────────────────────────────────────────────────────────────
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
  // contributions1 is always set — exported for per-contract UI breakdown
  results.push(validarPago(contributions.totalObligatory, paymentSheet.totalAmountPaid))

  // ── 6. Declaración cedular ────────────────────────────────────────────────
  const formalDeclaration = calcularDeclaracionCedular(
    manual.paymentNumber,
    manual.paymentRequestPeriod,
    manual.payrollPeriod
  )

  const activityReportReceived = resolverInforme053(
    contract,
    manual.paymentNumber,
    informeRecibido
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
    activityReportReceived,
  }
}
