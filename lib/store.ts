import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  ExtractedData,
  ManualFormData,
  RawPDFText,
  UploadedDocuments,
  WizardStep,
} from "./types"

// ─── State shape ──────────────────────────────────────────────────────────────

interface WizardState {
  step: WizardStep
  documents: UploadedDocuments
  manualData: ManualFormData | null
  rawText: RawPDFText | null
  extractedData: ExtractedData | null

  // ─── Actions ────────────────────────────────────────────────────────────────
  setStep: (step: WizardStep) => void
  setDocuments: (docs: Partial<UploadedDocuments>) => void
  setManualData: (data: ManualFormData) => void
  setRawText: (text: RawPDFText) => void
  setExtractedData: (data: ExtractedData) => void
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
    activityReport: null,
    deductionDependentsFile: null,
    deductionHealthPolicyFile: null,
    deductionMortgageInterestFile: null,
    deductionPrepaidMedicineFile: null,
    deductionAFCFile: null,
    deductionVoluntaryPensionFile: null,
    signature: null,
  } satisfies UploadedDocuments,
  manualData: null,
  rawText: null,
  extractedData: null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setStep: (newStep) =>
        set((s) => {
          const isMovingBack = newStep < s.step
          if (!isMovingBack) return { step: newStep }

          // If moving back to Step 1: clear everything
          if (newStep === 1) {
            return {
              step: 1,
              documents: INITIAL_STATE.documents,
              rawText: null,
              extractedData: null,
            }
          }

          // If moving back to Step 2: keep extracted data so AI doesn't re-run,
          // but clear Step 3-specific files and their extracted results.
          if (newStep === 2) {
            return {
              step: 2,
              rawText: null,
              documents: {
                ...s.documents,
                activityReport: null,
                paymentSheet2: null,
              },
              extractedData: s.extractedData
                ? {
                    ...s.extractedData,
                    activityReport: null,
                    paymentSheet2: null,
                  }
                : null,
            }
          }

          return { step: newStep }
        }),

      setDocuments: (docs) =>
        set((s) => ({ documents: { ...s.documents, ...docs } })),

      setManualData: (manualData) => set({ manualData }),

      setRawText: (rawText) => set({ rawText }),

      setExtractedData: (extractedData) => set({ extractedData }),

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: "verificacion-pagos-manual",
      // Only persist the manual form data — Files can't be serialized
      partialize: (state) => ({ manualData: state.manualData }),
    }
  )
)
