import type {
  ExtractedData,
  ManualFormData,
  Format053Data,
  Format069Data,
  ContributionCalculation,
} from "@/lib/types"
import type { ValidationSummary } from "@/lib/validations"
import { SPANISH_MONTHS } from "@/lib/constants/months"

type PlanillaShort = {
  sheetNumber?: string
  paymentDate?: string
  period?: string
}

/** Returns the later of two "MM/YYYY" period strings. */
function laterPeriod(p1: string, p2: string | undefined): string {
  if (!p2) return p1
  const [m1, y1] = p1.split("/").map(Number)
  const [m2, y2] = p2.split("/").map(Number)
  return y2 > y1 || (y2 === y1 && m2 > m1) ? p2 : p1
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
  summary: ValidationSummary,
  informeAdjunto = false,
  paymentSheet2Data?: PlanillaShort
): Format053Data {
  const { paymentSheet, contract, arl } = extracted
  const year = manual.paymentRequestPeriod.split("/")[1]
  const today = todayDDMMYYYY()

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

  // Combine values for two-planilla case
  const sheetNumber = paymentSheet2Data?.sheetNumber
    ? `${paymentSheet!.sheetNumber} y ${paymentSheet2Data.sheetNumber}`
    : paymentSheet!.sheetNumber

  const paymentDate = paymentSheet2Data?.paymentDate
    ? `${paymentSheet!.paymentDate} y ${paymentSheet2Data.paymentDate}`
    : paymentSheet!.paymentDate

  const period1Name = periodToMonthName(paymentSheet!.period)
  const period2Name = paymentSheet2Data?.period
    ? periodToMonthName(paymentSheet2Data.period)
    : undefined
  const payrollPeriodName =
    period2Name && period2Name !== period1Name
      ? `${period1Name} y ${period2Name}`
      : period1Name

  return {
    dependencia: manual.dependencia.toUpperCase(),
    contractType: contract!.contractType,
    orderNumberYear: `${contract!.orderNumber}/${year}`,
    amendmentLabel: manual.amendmentNumber || undefined,
    additionLabel: manual.additionNumber || undefined,
    quipuCompany: manual.quipuCompany,
    contractorName: contract!.contractorName,
    documentNumber: contract!.documentNumber,
    sheetNumber,
    paymentDate,
    payrollPeriodName,
    paymentNumber,
    paymentType: manual.paymentType,
    isLastExecutionMonth,
    amountToCharge: manual.amountToCharge,
    activityReportReceived: informeAdjunto ? true : "N/A",
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
  summary: ValidationSummary,
  paymentSheet2Data?: PlanillaShort
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
    riskClassLabel:
      { I: "1", II: "2", III: "3", IV: "4", V: "5" }[arl!.riskClass] ??
      arl!.riskClass,
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
    payrollPeriod: periodToSpanish(
      laterPeriod(extracted.paymentSheet!.period, paymentSheet2Data?.period)
    ),
    healthContribution: contributions.healthContribution,
    pensionContribution: contributions.pensionContribution,
    solidarityFund: contributions.solidarityFund,
    arlContribution: contributions.arlContribution,
    totalObligatory: contributions.totalObligatory,
    monthlyValue: contributions.monthlyValue,
    contractMonths: contributions.contractMonths,
    ibc: contributions.ibc,
    monthlyRetentionBase: contributions.monthlyRetentionBase,
    deductionDependents: manual.deductionDependents,
    deductionHealthPolicy: manual.deductionHealthPolicy,
    deductionMortgageInterest: manual.deductionMortgageInterest,
    deductionPrepaidMedicine: manual.deductionPrepaidMedicine,
    deductionAFC: manual.deductionAFC,
    deductionVoluntaryPension: manual.deductionVoluntaryPension,
    formalDeclaration: summary.formalDeclaration,
    signerName: contract!.contractorName,
    signerDocumentRef: `${contract!.documentType} ${contract!.documentNumber}`,
  }
}
