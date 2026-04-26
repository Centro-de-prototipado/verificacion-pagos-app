import type {
  ExtractedData,
  ManualFormData,
  Format053Data,
  Format069Data,
  ContributionCalculation,
  RiskClass,
} from "@/lib/types"
import type { ValidationSummary } from "@/lib/validations"

const SPANISH_MONTHS: Record<string, string> = {
  "01": "enero",
  "02": "febrero",
  "03": "marzo",
  "04": "abril",
  "05": "mayo",
  "06": "junio",
  "07": "julio",
  "08": "agosto",
  "09": "septiembre",
  "10": "octubre",
  "11": "noviembre",
  "12": "diciembre",
}

const RISK_CLASS_LABELS: Record<RiskClass, string> = {
  I: "I",
  II: "II",
  III: "III",
  IV: "IV",
  V: "V",
}

/** DD/MM/YYYY → "DD de mes de YYYY" for expedition date */
function formatExpeditionDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/")
  return `${d} de ${SPANISH_MONTHS[m] ?? m} de ${y}`
}

/** "MM/YYYY" → Spanish month name */
function periodToMonthName(mmyyyy: string): string {
  const [mm] = mmyyyy.split("/")
  return SPANISH_MONTHS[mm] ?? mmyyyy
}

/** "MM/YYYY" → "mes/YYYY" for 069 period fields */
function periodToSpanish(mmyyyy: string): string {
  const [mm, yyyy] = mmyyyy.split("/")
  return `${SPANISH_MONTHS[mm] ?? mm}/${yyyy}`
}

/** Returns today as DD/MM/YYYY */
function todayDDMMYYYY(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function buildFormat053Data(
  extracted: ExtractedData,
  manual: ManualFormData,
  summary: ValidationSummary
): Format053Data {
  const { paymentSheet, contract, arl } = extracted
  const year = manual.paymentRequestPeriod.split("/")[1]
  const today = todayDDMMYYYY()

  const paymentsToRequest = manual.paymentsToRequest
  const paymentNumber = manual.paymentNumber

  // Detect last execution month: paymentRequestPeriod MM/YYYY matches ARL endDate MM/YYYY
  const isLastExecutionMonth = (() => {
    const endDate = arl?.endDate ?? contract?.endDate ?? ""
    if (!endDate) return false
    // Handle both DD/MM/YYYY and YYYY-MM-DD (ISO) formats
    let endMM: string, endYYYY: string
    if (endDate.includes("-")) {
      ;[endYYYY, endMM] = endDate.split("-")
    } else {
      ;[, endMM, endYYYY] = endDate.split("/")
    }
    const [reqMM, reqYYYY] = manual.paymentRequestPeriod.split("/")
    return reqMM === endMM && reqYYYY === endYYYY
  })()

  const paymentType: "Parcial" | "Final" | "Único" =
    paymentsToRequest === 1
      ? "Único"
      : isLastExecutionMonth || paymentNumber === paymentsToRequest
        ? "Final"
        : "Parcial"

  return {
    contractType: contract!.contractType,
    orderNumberYear: `${contract!.orderNumber}/${year}`,
    amendmentLabel: manual.amendmentNumber
      ? `${manual.amendmentNumber}`
      : undefined,
    quipuCompany: manual.quipuCompany,
    contractorName: contract!.contractorName,
    documentNumber: contract!.documentNumber,
    sheetNumber: paymentSheet!.sheetNumber,
    paymentDate: paymentSheet!.paymentDeadline ?? paymentSheet!.paymentDate,
    payrollPeriodName: periodToMonthName(manual.payrollPeriod),
    paymentNumber,
    paymentType,
    isLastExecutionMonth,
    amountToCharge: manual.amountToCharge,
    activityReportReceived: summary.activityReportReceived,
    supervisorName: manual.supervisorName,
    supervisorDocumentNumber: manual.supervisorDocumentNumber,
    supervisorEmail: manual.supervisorEmail,
    supervisorPhone: manual.supervisorPhone,
    expeditionDate: formatExpeditionDate(today),
  }
}

export function buildFormat069Data(
  extracted: ExtractedData,
  manual: ManualFormData,
  contributions: ContributionCalculation,
  summary: ValidationSummary
): Format069Data {
  const { contract, arl, contract2 } = extracted
  const year = manual.paymentRequestPeriod.split("/")[1]
  const today = todayDDMMYYYY()

  const deductionsContractRef = `${manual.quipuCompany}-${contract!.contractType}-${contract!.orderNumber}-${year}`

  return {
    contractorName: contract!.contractorName,
    processingDate: today,
    documentType: contract!.documentType,
    documentNumber: contract!.documentNumber,
    isPensioner: manual.isPensioner,
    institutionalEmail: manual.institutionalEmail,
    quipuCompany: manual.quipuCompany,
    contractType: contract!.contractType,
    orderNumber: contract!.orderNumber,
    contractTotalValue: contract!.totalValueBeforeTax,
    startDate: contract!.startDate,
    endDate: contract!.endDate,
    riskClassLabel: RISK_CLASS_LABELS[arl!.riskClass],
    ...(contract2
      ? {
          contract2Type: contract2.contractType,
          contract2OrderNumber: contract2.orderNumber,
          contract2TotalValue: contract2.totalValueBeforeTax,
          contract2StartDate: contract2.startDate,
          contract2EndDate: contract2.endDate,
        }
      : {}),
    deductionsContractRef,
    paymentRequestPeriod: periodToSpanish(manual.paymentRequestPeriod),
    payrollPeriod: periodToSpanish(manual.payrollPeriod),
    healthContribution: contributions.healthContribution,
    pensionContribution: contributions.pensionContribution,
    solidarityFund: contributions.solidarityFund,
    arlContribution: contributions.arlContribution,
    totalObligatory: contributions.totalObligatory,
    monthlyValue: contributions.monthlyValue,
    contractMonths: contributions.contractMonths,
    ibc: contributions.ibc,
    monthlyRetentionBase: contributions.monthlyRetentionBase,
    formalDeclaration: summary.formalDeclaration,
    signerName: contract!.contractorName,
    signerDocumentRef: `${contract!.documentType} ${contract!.documentNumber}`,
  }
}
