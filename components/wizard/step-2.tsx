"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"

import { useWizardStore } from "@/lib/store"
import type { ExtractedData, RawPDFText, WizardStep } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionHeader } from "./section-header"

type ExtractionStatus =
  | "idle"
  | "loading-text"
  | "loading-ai"
  | "ready"
  | "error"

export function Step2() {
  const { documents, rawText, setRawText, setExtractedData, setStep } =
    useWizardStore()

  const [status, setStatus] = useState<ExtractionStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const buildFormData = useCallback(() => {
    const formData = new FormData()

    if (documents.paymentSheet) {
      formData.append("paymentSheet", documents.paymentSheet)
    }
    if (documents.arl) {
      formData.append("arl", documents.arl)
    }
    if (documents.contract) {
      formData.append("contract", documents.contract)
    }
    if (documents.contract2) {
      formData.append("contract2", documents.contract2)
    }

    return formData
  }, [documents])

  const processStep = useCallback(async () => {
    setStatus("loading-text")
    setErrorMessage(null)

    const parseApiError = async (res: Response, fallback: string) => {
      try {
        const payload = (await res.json()) as {
          error?: string
          details?: string
        }

        return payload.details ?? payload.error ?? fallback
      } catch {
        return fallback
      }
    }

    try {
      const textRes = await fetch("/api/extract-text", {
        method: "POST",
        body: buildFormData(),
      })

      if (!textRes.ok) {
        const details = await parseApiError(
          textRes,
          `Error del servidor en extracción de texto: ${textRes.status}`
        )
        throw new Error(details)
      }

      const rawData: RawPDFText = await textRes.json()
      setRawText(rawData)

      setStatus("loading-ai")

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rawText: rawData }),
      })

      if (!aiRes.ok) {
        const details = await parseApiError(
          aiRes,
          `Error del servidor en extracción IA: ${aiRes.status}`
        )
        throw new Error(details)
      }

      const extractedPayload = (await aiRes.json()) as ExtractedData & {
        warnings?: string[]
      }

      const { warnings = [], ...extractedData } = extractedPayload

      setExtractedData(extractedData)
      setStatus("ready")

      if (warnings.length > 0) {
        toast.warning("Extracción IA con observaciones.", {
          description: warnings.join(" · "),
        })
      }

      toast.success("Proceso automático completado.", {
        description: "Todo está listo. Presiona continuar para avanzar.",
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido al procesar los PDFs."

      setErrorMessage(message)
      setStatus("error")

      toast.error("No se pudo completar el proceso automático.", {
        description: message,
      })
    }
  }, [buildFormData, setExtractedData, setRawText])

  useEffect(() => {
    processStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={1}
          title="Procesamiento automático de documentos"
          subtitle="El sistema extrae texto y luego ejecuta la extracción con IA."
          done={status === "ready"}
        />

        {status === "loading-text" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 pl-9 text-center">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Extrayendo texto de los PDFs…</p>
              <p className="text-xs text-muted-foreground">
                Esto puede tardar unos segundos según el tamaño de los archivos.
              </p>
            </div>
          </div>
        )}

        {status === "loading-ai" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 pl-9 text-center">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Extrayendo datos con IA…</p>
              <p className="text-xs text-muted-foreground">
                En cuanto termine, podrás continuar con un solo click.
              </p>
            </div>
          </div>
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed py-6 pl-9">
            <p className="text-sm font-medium">Listo para continuar</p>
            <p className="text-xs text-muted-foreground">
              El texto y la extracción con IA ya terminaron correctamente.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                onClick={processStep}
              >
                <RefreshCwIcon className="size-4" />
                Reintentar proceso automático
              </Button>
              <Button size="sm" className="w-fit" onClick={() => setStep(3 as WizardStep)}>
                Continuar
              </Button>
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
              onClick={processStep}
            >
              <RefreshCwIcon className="size-4" />
              Reintentar proceso automático
            </Button>
          </div>
        )}
      </div>

      {status === "idle" && !rawText && (
        <p className="text-sm text-muted-foreground">Preparando proceso…</p>
      )}
    </div>
  )
}
