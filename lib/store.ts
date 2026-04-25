import { create } from "zustand"
import type {
  ExtractedData,
  ManualFormData,
  RawPDFText,
  UploadedDocuments,
  ValidationResult,
  VerificationStatus,
  WizardStep,
} from "./types"

// ─── State shape ──────────────────────────────────────────────────────────────

interface WizardState {
  step: WizardStep
  documents: UploadedDocuments
  manualData: ManualFormData | null
  rawText: RawPDFText | null
  extractedData: ExtractedData | null
  validationResults: ValidationResult[]
  /** Whether the user confirmed informe de actividades was received */
  informeRecibido: boolean
  status: VerificationStatus
  error: string | null

  // ─── Actions ────────────────────────────────────────────────────────────────
  setStep: (step: WizardStep) => void
  setDocuments: (docs: Partial<UploadedDocuments>) => void
  setManualData: (data: ManualFormData) => void
  setRawText: (text: RawPDFText) => void
  setExtractedData: (data: ExtractedData) => void
  setValidationResults: (results: ValidationResult[]) => void
  setInformeRecibido: (value: boolean) => void
  setStatus: (status: VerificationStatus) => void
  setError: (error: string | null) => void
  reset: () => void
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  step: 1 as WizardStep,
  documents: {
    paymentSheet: null,
    arl: null,
    contract: null,
    contract2: null,
    paymentSheet2: null,
  } satisfies UploadedDocuments,
  manualData: null,
  rawText: null,
  extractedData: null,
  validationResults: [] as ValidationResult[],
  informeRecibido: false,
  status: "idle" as VerificationStatus,
  error: null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardState>((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),

  setDocuments: (docs) =>
    set((s) => ({ documents: { ...s.documents, ...docs } })),

  setManualData: (manualData) => set({ manualData }),

  setRawText: (rawText) => set({ rawText }),

  setExtractedData: (extractedData) => set({ extractedData }),

  setValidationResults: (validationResults) => set({ validationResults }),

  setInformeRecibido: (informeRecibido) => set({ informeRecibido }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  reset: () => set(INITIAL_STATE),
}))
