// ─── Primitives ───────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5

export type ContractType =
  | "OSE"
  | "OPS"
  | "OCE"
  | "OFS"
  | "OCO"
  | "ODS"
  | "ODO"
  | "OCU"

export type RiskClass = "I" | "II" | "III" | "IV" | "V"

export type DocumentType = "CC" | "NIT" | "CE"

export type VerificationStatus =
  | "idle"
  | "extracting-text"
  | "extracting-ai"
  | "validating"
  | "ready"
  | "error"

// ─── Manual form data (Step 1) ────────────────────────────────────────────────

/** Data entered manually by the user — not extracted by AI. */
export interface ManualFormData {
  contractCount: "1" | "2"
  paymentsToRequest: number
  institutionalEmail: string
  isPensioner: boolean
  quipuCompany: string
  amendmentNumber?: string
  /** Format MM/YYYY — payment request period */
  paymentRequestPeriod: string
  /** Format MM/YYYY — period covered by the social security payroll */
  payrollPeriod: string
  paymentNumber: number
  amountToCharge: number
}

// ─── Uploaded documents ───────────────────────────────────────────────────────

export interface UploadedDocuments {
  paymentSheet: File | null
  arl: File | null
  contract: File | null
  /** Only when contractCount === "2" */
  contract2?: File | null
  /** Next month's planilla — required when paymentSheet was paid after its deadline */
  paymentSheet2?: File | null
}

// ─── AI-extracted data (populated in Phase 3) ────────────────────────────────

export interface PaymentSheetData {
  sheetNumber: string
  paymentDate: string
  paymentDeadline: string
  period: string
  totalAmountPaid: number
}

export interface ARLData {
  startDate: string
  endDate: string
  coverageStatus: "ACTIVA" | "INACTIVA" | "SUSPENDIDA"
  riskClass: RiskClass
  /** ARL cotization rate as percentage, e.g. 1.044 means 1.044% */
  cotizationRate: number
}

export interface ContractData {
  contractType: ContractType
  orderNumber: string
  contractorName: string
  documentType: DocumentType
  documentNumber: string
  totalValueBeforeTax: number
  /** DD/MM/YYYY */
  startDate: string
  /** DD/MM/YYYY */
  endDate: string
  activityReport: {
    required: boolean
    frequencyMonths: number | null
  }
}

export interface ExtractedData {
  paymentSheet: PaymentSheetData | null
  arl: ARLData | null
  contract: ContractData | null
  contract2?: ContractData | null
}

// ─── Validation results (Phase 4) ────────────────────────────────────────────

export type ValidationType = "contribution" | "date" | "report" | "cedular"

export interface ValidationResult {
  ok: boolean
  blocking: boolean
  message: string
  type: ValidationType
}

// ─── Raw PDF text (Phase 2) ───────────────────────────────────────────────────

export interface RawPDFText {
  paymentSheet: string
  arl: string
  contract: string
  contract2?: string
}

// ─── Contribution calculations (Phase 4 output / Phase 5 input) ──────────────

export interface ContributionCalculation {
  /** Base usada: max(IBC calculado, SMMLV) */
  calculationBase: number
  monthlyValue: number
  contractMonths: number
  ibc: number
  healthContribution: number
  pensionContribution: number
  /** Calculado como: cotizationRate% × calculationBase */
  arlContribution: number
  solidarityFund: number
  totalObligatory: number
  /** Valor mensualizado = base de retención en el 069 */
  monthlyRetentionBase: number
}

// ─── PDF format input data (Phase 5) ─────────────────────────────────────────

/** Data needed to fill U.FT.12.010.053 — Constancia de cumplimiento contractual */
export interface Format053Data {
  // Contrato
  contractType: ContractType
  /** e.g. "14/2026" */
  orderNumberYear: string
  /** e.g. "CSI 1/2026" — only when there's an amendment */
  amendmentLabel?: string
  quipuCompany: string
  contractorName: string
  documentNumber: string
  // Planilla
  sheetNumber: string
  /** e.g. "2026/03/06" */
  paymentDate: string
  /** Month name in Spanish, e.g. "febrero" */
  payrollPeriodName: string
  // Pago
  paymentNumber: number
  paymentType: "Parcial" | "Final" | "Único"
  amountToCharge: number
  // Informe de actividades
  activityReportReceived: boolean | "N/A"
  // Fecha de expedición (current date)
  expeditionDate: string
}

/** Data needed to fill U.FT.12.010.069 — Certificación determinación cedular */
export interface Format069Data {
  // Sección 1 — Datos generales
  contractorName: string
  /** e.g. "23/03/2026" */
  processingDate: string
  documentType: DocumentType
  documentNumber: string
  isPensioner: boolean
  institutionalEmail: string
  // Sección 2 — Relación contratos (contrato principal)
  quipuCompany: string
  contractType: ContractType
  orderNumber: string
  contractTotalValue: number
  /** e.g. "26/01/2026" */
  startDate: string
  /** e.g. "22/10/2026" */
  endDate: string
  /** e.g. "Riesgo 2" */
  riskClassLabel: string
  // Segundo contrato (opcional — solo cuando contractCount === "2")
  contract2Type?: ContractType
  contract2OrderNumber?: string
  contract2TotalValue?: number
  contract2StartDate?: string
  contract2EndDate?: string
  // Sección 3 — Anexos
  /** e.g. "4013-OSE-14-2026" */
  deductionsContractRef: string
  /** e.g. "marzo/2026" */
  paymentRequestPeriod: string
  /** e.g. "febrero/2026" */
  payrollPeriod: string
  // Sección 4 — Cálculo aportes (from ContributionCalculation)
  healthContribution: number
  pensionContribution: number
  solidarityFund: number
  arlContribution: number
  totalObligatory: number
  // Sección 5 — Mensualización
  monthlyValue: number
  contractMonths: number
  ibc: number
  // Sección 6 — Base retención
  monthlyRetentionBase: number
  // Declaración formal
  formalDeclaration: "SI" | "NO"
  // Firma sección 7
  signerName: string
  signerDocumentRef: string
}
