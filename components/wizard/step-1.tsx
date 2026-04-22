"use client"

import { useState } from "react"
import { toast } from "sonner"
import { InfoIcon } from "lucide-react"

import { useWizardStore } from "@/lib/store"
import type { ManualFormData } from "@/lib/types"
import type { ManualFormInput } from "@/lib/schemas/manual-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
    description: "Comprobante de pago de salud, pensión y ARL",
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
    hint: "OSE, OPS, OCE u otro tipo de orden UNAL",
  },
] as const

export function Step1() {
  const { documents, setDocuments, manualData, setManualData, setStep } =
    useWizardStore()

  const [contractCount, setContractCount] = useState<"1" | "2">(
    manualData?.contractCount ?? "1"
  )

  const uploadStatus = {
    paymentSheet: documents.paymentSheet !== null,
    arl: documents.arl !== null,
    contract: documents.contract !== null,
    contract2: documents.contract2 !== null,
  }

  const requiredCount = contractCount === "2" ? 4 : 3
  const uploadedCount = [
    uploadStatus.paymentSheet,
    uploadStatus.arl,
    uploadStatus.contract,
    contractCount === "2" && uploadStatus.contract2,
  ].filter(Boolean).length

  const allDocumentsReady =
    uploadStatus.paymentSheet &&
    uploadStatus.arl &&
    uploadStatus.contract &&
    (contractCount !== "2" || uploadStatus.contract2)

  function handleFormSubmit(data: ManualFormInput) {
    if (!allDocumentsReady) {
      toast.error("Faltan documentos por subir.", {
        description: `Tienes ${uploadedCount} de ${requiredCount} documentos requeridos.`,
      })
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    setManualData({ ...data, contractCount } as ManualFormData)
    setStep(2)
    toast.success("¡Paso 1 completado!", {
      description: "Ahora la IA procesará tus documentos.",
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Aviso contextual */}
      <Alert>
        <InfoIcon className="size-4" />
        <AlertDescription>
          Ten listos tus PDFs antes de empezar: planilla de seguridad social,
          certificado ARL y contrato u orden contractual.
        </AlertDescription>
      </Alert>

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
              onClick={() => setContractCount(val)}
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
      </div>

      <Separator />

      {/* ② Documentos */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            number={2}
            title="Sube los documentos requeridos"
            subtitle={`${uploadedCount} de ${requiredCount} documentos listos`}
            done={!!allDocumentsReady}
          />
          <div className="hidden flex-col gap-1.5 sm:flex">
            <DocCheckItem
              label="Planilla SS"
              done={uploadStatus.paymentSheet}
            />
            <DocCheckItem label="Certificado ARL" done={uploadStatus.arl} />
            <DocCheckItem label="Contrato" done={uploadStatus.contract} />
            {contractCount === "2" && (
              <DocCheckItem label="Contrato 2" done={uploadStatus.contract2} />
            )}
          </div>
        </div>

        <div className="grid gap-4 pl-9 sm:grid-cols-3">
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
