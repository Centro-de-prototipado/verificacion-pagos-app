// ─── Primitives ───────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4

// ─── Extraction confidence ────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low"
export type ConfidenceMap = Record<string, ConfidenceLevel>

export type ContractType =
  // Órdenes contractuales vigentes
  | "OCA"
  | "OCO"
  | "ODC"
  | "ODO"
  | "OPS"
  | "OSE"
  | "OSU"
  // Contratos vigentes
  | "CCO"
  | "CDA"
  | "CDC"
  | "CDO"
  | "CIS"
  | "CON"
  | "COV"
  | "CPS"
  | "CSE"
  | "CSU"
  // Órdenes de vigencia futura
  | "OEF"
  | "OFA"
  | "OFC"
  | "OFO"
  | "OFS"
  | "OOF"
  | "OSF"
  | "OUF"
  // Contratos de vigencia futura
  | "CAF"
  | "CCF"
  | "CIF"
  | "COF"
  | "CPF"
  | "CSF"
  | "CTF"
  | "CUF"
  | "CVF"

export type RiskClass = "I" | "II" | "III" | "IV" | "V"

export type DocumentType = "CC" | "NIT" | "CE"

// ─── Manual form data (Step 1) ────────────────────────────────────────────────

/** Data entered manually by the user — not extracted by AI. */
export interface ManualFormData {
  contractCount: "1" | "2"
  paymentsToRequest: number
  institutionalEmail: string
  isPensioner: boolean
  quipuCompany: string
  dependencia: string
  amendmentNumber?: string
  additionNumber?: string
  /** Format MM/YYYY — payment request period */
  paymentRequestPeriod: string
  paymentType: "Parcial" | "Final" | "Único"
  paymentNumber: number
  amountToCharge: number
  // Interventor / supervisor (required for Format 053)
  supervisorName: string
  supervisorDocumentNumber: string
  supervisorEmail: string
  supervisorPhone: string
  // Documentos para soporte de deducciones (Formato 069, sección 3)
  deductionDependents: boolean
  deductionHealthPolicy: boolean
  deductionMortgageInterest: boolean
  deductionPrepaidMedicine: boolean
  deductionAFC: boolean
  deductionVoluntaryPension: boolean
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
  /** Optional activity report to append to the final PDF */
  activityReport?: File | null
  // Deduction support documents (appended to final PDF when corresponding boolean is true)
  deductionDependentsFile?: File | null
  deductionHealthPolicyFile?: File | null
  deductionMortgageInterestFile?: File | null
  deductionPrepaidMedicineFile?: File | null
  deductionAFCFile?: File | null
  deductionVoluntaryPensionFile?: File | null
  /** Signature image for the 069 form */
  signature: File | null
}

// ─── AI-extracted data (populated in Phase 3) ────────────────────────────────

export interface PaymentSheetData {
  sheetNumber: string
  paymentDate: string
  paymentDeadline: string | null
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

export interface ActivityReportItem {
  activityDescription: string
  periodPercentage: number
  accumulatedPercentage: number
}

export interface ActivityReportData {
  items: ActivityReportItem[]
  /** Date after "En constancia de lo anterior, se firma el presente informe el" */
  signatureDate: string
  /** PERIODO DEL INFORME: Desde */
  periodFrom: string
  /** PERIODO DEL INFORME: Hasta */
  periodTo: string
  /** PLAZO OPS: Fecha inicio */
  opsStartDate: string
  /** PLAZO OPS: Fecha Terminación */
  opsEndDate: string
  isSigned: boolean
}

export interface ExtractedData {
  paymentSheet: PaymentSheetData | null
  arl: ARLData | null
  contract: ContractData | null
  contract2?: ContractData | null
  activityReport?: ActivityReportData | null
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
  // Dependencia
  dependencia: string
  // Contrato
  contractType: ContractType
  /** e.g. "14/2026" */
  orderNumberYear: string
  /** e.g. "CSI 1/2026" — only when there's an amendment */
  amendmentLabel?: string
  /** e.g. "Adición 1/2026" — only when there's an addition */
  additionLabel?: string
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
  /** True when paymentRequestPeriod matches the last execution month of the contract */
  isLastExecutionMonth: boolean
  amountToCharge: number
  // Informe de actividades
  activityReportReceived: boolean | "N/A"
  // Interventor / supervisor
  supervisorName: string
  supervisorDocumentNumber: string
  supervisorEmail: string
  supervisorPhone: string
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
  // Sección 3 — Documentos para soporte de deducciones
  deductionDependents: boolean
  deductionHealthPolicy: boolean
  deductionMortgageInterest: boolean
  deductionPrepaidMedicine: boolean
  deductionAFC: boolean
  deductionVoluntaryPension: boolean
  // Declaración formal
  formalDeclaration: "SI" | "NO"
  // Firma sección 7
  signerName: string
  signerDocumentRef: string
  /** Base64 encoded image string */
  signatureImage?: string
}
