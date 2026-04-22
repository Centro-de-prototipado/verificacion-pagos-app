// ─── Primitives ───────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4

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
}

export interface ContractData {
  contractType: ContractType
  orderNumber: string
  contractorName: string
  documentType: DocumentType
  documentNumber: string
  totalValueBeforeTax: number
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
