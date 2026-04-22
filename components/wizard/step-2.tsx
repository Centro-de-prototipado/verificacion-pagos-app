"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2Icon, RefreshCwIcon, ArrowRightIcon } from "lucide-react"

import { useWizardStore } from "@/lib/store"
import type { RawPDFText, WizardStep } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { PdfTextPreview } from "@/components/preview/pdf-text-preview"
import { SectionHeader } from "./section-header"

// Mapeo de claves a etiquetas legibles
const DOCUMENT_LABELS: Record<keyof RawPDFText, string> = {
  paymentSheet: "Planilla de Seguridad Social",
  arl: "Certificado ARL",
  contract: "Contrato u Orden",
  contract2: "Segundo contrato",
}

type ExtractionStatus = "idle" | "loading" | "success" | "error"

export function Step2() {
  const { documents, manualData, rawText, setRawText, setStep } =
    useWizardStore()

  const [status, setStatus] = useState<ExtractionStatus>(
    rawText ? "success" : "idle"
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const extractText = useCallback(async () => {
    setStatus("loading")
    setErrorMessage(null)

    const formData = new FormData()
    if (documents.paymentSheet)
      formData.append("paymentSheet", documents.paymentSheet)
    if (documents.arl) formData.append("arl", documents.arl)
    if (documents.contract) formData.append("contract", documents.contract)
    if (documents.contract2) formData.append("contract2", documents.contract2)

    try {
      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Error del servidor: ${res.status}`)
      }

      const data: RawPDFText = await res.json()
      setRawText(data)
      setStatus("success")
      toast.success("Texto extraído correctamente.", {
        description: "Revisa el contenido y confirma para continuar.",
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido al procesar los PDFs."
      setErrorMessage(message)
      setStatus("error")
      toast.error("No se pudo extraer el texto.", { description: message })
    }
  }, [documents, setRawText])

  // Auto-extraer al montar si aún no hay texto
  useEffect(() => {
    if (!rawText) extractText()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeText = rawText ?? ({} as Partial<RawPDFText>)

  // Solo mostrar los documentos que se subieron
  const documentEntries = (
    Object.keys(DOCUMENT_LABELS) as (keyof RawPDFText)[]
  ).filter((key) => {
    if (key === "paymentSheet") return !!documents.paymentSheet
    if (key === "arl") return !!documents.arl
    if (key === "contract") return !!documents.contract
    if (key === "contract2") return manualData?.contractCount === "2"
    return false
  })

  return (
    <div className="flex flex-col gap-8">
      {/* ① Estado de extracción */}
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={1}
          title="Extracción de texto de los PDFs"
          subtitle="Verificamos que los documentos contienen texto legible antes de enviarlos a la IA."
          done={status === "success"}
        />

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 pl-9 text-center">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Procesando documentos…</p>
              <p className="text-xs text-muted-foreground">
                Esto puede tardar unos segundos según el tamaño de los archivos.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-3 pl-9">
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage ?? "Ocurrió un error al procesar los documentos."}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-2"
              onClick={extractText}
            >
              <RefreshCwIcon className="size-4" />
              Reintentar extracción
            </Button>
          </div>
        )}
      </div>

      {/* ② Previews de texto */}
      {status === "success" && rawText && (
        <>
          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeader
              number={2}
              title="Revisa el contenido extraído"
              subtitle="Expande cada documento para verificar que el texto fue leído correctamente. Si ves texto ilegible o vacío, el PDF podría estar escaneado."
              done={false}
            />

            <div className="flex flex-col gap-3 pl-0 sm:pl-9">
              {documentEntries.map((key, index) => (
                <PdfTextPreview
                  key={key}
                  stepNumber={index + 1}
                  label={DOCUMENT_LABELS[key]}
                  text={activeText[key] ?? ""}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* ③ Confirmar y continuar */}
          <div className="flex flex-col gap-4">
            <SectionHeader
              number={3}
              title="Confirma y envía a la IA"
              subtitle="Una vez confirmado, la IA de Gemini 2.5 Flash extraerá los datos estructurados de cada documento."
            />

            <div className="flex flex-col gap-3 pl-0 sm:pl-9">
              <p className="text-xs text-muted-foreground">
                ¿Ves algún problema con el texto extraído? Puedes volver al paso
                anterior y reemplazar el archivo.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={extractText}
                >
                  <RefreshCwIcon className="size-4" />
                  Re-extraer
                </Button>
                <Button
                  size="lg"
                  className="flex-1 gap-2 text-base sm:flex-none sm:px-8"
                  onClick={() => {
                    setStep(3 as WizardStep)
                    toast.success("¡Paso 2 completado!", {
                      description: "La IA procesará los documentos ahora.",
                    })
                  }}
                >
                  Continuar al paso 3
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
