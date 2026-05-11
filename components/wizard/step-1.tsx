"use client"

import { useState } from "react"
import { toast } from "sonner"

import { useWizardStore } from "@/lib/store"
import type { ManualFormData } from "@/lib/types"
import type { ManualFormInput } from "@/lib/schemas/manual-form"

import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { DocumentDropzone } from "@/components/upload/document-dropzone"
import { ManualForm } from "@/components/upload/manual-form"
import { SecondContract } from "@/components/upload/second-contract"
import { SectionHeader } from "./section-header"
import { DocCheckItem } from "./doc-check-item"

// Hoisted static data — avoids re-creation on every render (rendering-hoist-jsx)
const REQUIRED_DOCUMENTS = [
  {
    key: "paymentSheet" as const,
    stepNumber: 1,
    label: "Planilla de Seguridad Social",
    description: "Comprobante de pago",
    hint: "Archivo de la PILA o equivalente",
  },
  {
    key: "arl" as const,
    stepNumber: 2,
    label: "Certificado ARL",
    description: "Certificado vigente de afiliación",
    hint: "Emitido por tu ARL (Positiva, Sura, etc.)",
  },
  {
    key: "contract" as const,
    stepNumber: 3,
    label: "Contrato u Orden",
    description: "Orden de prestación de servicios",
    hint: "OSE, OPS, CCO u otro tipo de contrato UNAL",
  },
  {
    key: "signature" as const,
    stepNumber: 4,
    label: "Foto de la Firma",
    description: "Imagen de tu firma manuscrita",
    hint: "Foto nítida o firma escaneada (PNG/JPG)",
  },
] as const

export function Step1() {
  const { documents, setDocuments, manualData, setManualData, setStep } =
    useWizardStore()

  const [contractCount, setContractCount] = useState<"1" | "2">(
    manualData?.contractCount ?? "1"
  )
  const [involvedContracts, setInvolvedContracts] = useState<
    "1" | "2" | "Ambos"
  >(manualData?.involvedContracts ?? "Ambos")

  const uploadStatus = {
    paymentSheet: documents.paymentSheet !== null,
    arl: documents.arl !== null,
    contract: documents.contract !== null,
    contract2: documents.contract2 !== null,
    signature: documents.signature !== null,
  }

  const requiredCount = (contractCount === "2" ? 4 : 3) + 1
  const uploadedCount = [
    uploadStatus.paymentSheet,
    uploadStatus.arl,
    uploadStatus.contract,
    contractCount === "2" && uploadStatus.contract2,
    uploadStatus.signature,
  ].filter(Boolean).length

  const allDocumentsReady =
    uploadStatus.paymentSheet &&
    uploadStatus.arl &&
    uploadStatus.contract &&
    uploadStatus.signature &&
    (contractCount !== "2" || uploadStatus.contract2)

  function handleFormSubmit(data: ManualFormInput) {
    if (!allDocumentsReady) {
      toast.error("Faltan documentos por subir.", {
        description: `Tienes ${uploadedCount} de ${requiredCount} documentos requeridos.`,
      })
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    setManualData({
      ...data,
      contractCount,
      involvedContracts: contractCount === "2" ? involvedContracts : undefined,
    } as ManualFormData)
    setStep(2)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ① ¿Cuántos contratos? */}
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={1}
          title="¿Con cuántos contratos vas a solicitar el pago?"
          subtitle="La mayoría de los contratistas tiene solo uno."
        />
        <div className="grid grid-cols-2 gap-3 pl-9">
          {(["1", "2"] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setContractCount(val)
                // Clear second contract file when downgrading to 1 contract
                if (val === "1") setDocuments({ contract2: null })
              }}
              className={[
                "flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-5 text-center transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                contractCount === val
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-foreground hover:border-primary/40 hover:bg-muted/30",
              ].join(" ")}
            >
              <span className="text-4xl leading-none font-bold">{val}</span>
              <span className="text-sm font-semibold">
                {val === "1" ? "Un contrato" : "Dos contratos"}
              </span>
              <span className="text-xs text-muted-foreground">
                {val === "1" ? "Caso más común" : "Con dos dependencias UNAL"}
              </span>
            </button>
          ))}
        </div>

        {/* ¿Qué contrato cobrar? Solo si son 2 */}
        {contractCount === "2" && (
          <div className="mt-2 flex flex-col gap-3 pl-9">
            <p className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
              ¿Qué contrato(s) vas a cobrar en este periodo?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["1", "2"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setInvolvedContracts(val)}
                  className={[
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                    involvedContracts === val
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Contrato {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground italic">
              Nota: Si las fechas se cruzan y el periodo coincide, se sumarán
              los IBCs para el cálculo de aportes.
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* ② Documentos */}
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={2}
          title="Sube los documentos requeridos"
          subtitle={`${uploadedCount} de ${requiredCount} documentos listos`}
          done={!!allDocumentsReady}
        />

        <div className="grid gap-4 pl-9 sm:grid-cols-4">
          {REQUIRED_DOCUMENTS.map(
            ({ key, stepNumber, label, description, hint }) => (
              <DocumentDropzone
                key={key}
                stepNumber={stepNumber}
                label={label}
                description={description}
                hint={hint}
                file={documents[key]}
                onFileChange={(file) => setDocuments({ [key]: file })}
                accept={key === "signature" ? "image/*" : "application/pdf"}
              />
            )
          )}
        </div>

        {contractCount === "2" && (
          <div className="pl-9">
            <SecondContract />
          </div>
        )}

        <div className="flex flex-col gap-1.5 pl-9">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Documentos cargados</span>
            <span className="font-medium">
              {uploadedCount}/{requiredCount}
            </span>
          </div>
          <Progress
            value={(uploadedCount / requiredCount) * 100}
            className="h-1.5"
          />
        </div>
      </div>

      <Separator />

      {/* ③ Datos adicionales */}
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={3}
          title="Completa los datos del pago y del contratista"
          subtitle="Esta información no está en los PDFs — debes ingresarla manualmente."
        />
        <div className="pl-0 sm:pl-9">
          <ManualForm
            defaultValues={manualData ?? { contractCount }}
            onSubmit={handleFormSubmit}
            onContractCountChange={setContractCount}
          />
        </div>
      </div>
    </div>
  )
}
