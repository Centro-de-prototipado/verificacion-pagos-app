"use client"

import { useState } from "react"
import { DownloadIcon, Loader2Icon, FileCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { useWizardStore } from "@/lib/store"
import { nombreArchivoFinal } from "@/lib/pdf/utils"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionHeader } from "./section-header"

type DownloadStatus = "idle" | "loading" | "ready" | "error"

export function Step5() {
  const { extractedData, manualData, documents } = useWizardStore()

  const [status, setStatus] = useState<DownloadStatus>("idle")
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const filename =
    extractedData?.contract && manualData
      ? nombreArchivoFinal(
          manualData.quipuCompany,
          extractedData.contract.contractType,
          extractedData.contract.orderNumber
        )
      : "Anexos.pdf"

  const generarPDF = async () => {
    if (!extractedData || !manualData || !documents.paymentSheet || !documents.arl) {
      toast.error("Faltan documentos o datos para generar el PDF.")
      return
    }

    setStatus("loading")
    setErrorMessage(null)
    setPdfBlob(null)

    try {
      const formData = new FormData()
      formData.append("extracted", JSON.stringify(extractedData))
      formData.append("manual", JSON.stringify(manualData))
      formData.append("planilla", documents.paymentSheet)
      formData.append("arl", documents.arl)
      if (documents.paymentSheet2) {
        formData.append("planilla2", documents.paymentSheet2)
      }

      const res = await fetch("/api/generar-pdf", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string
          details?: string
        }
        throw new Error(
          payload.details ?? payload.error ?? `Error del servidor: ${res.status}`
        )
      }

      const blob = await res.blob()
      setPdfBlob(blob)
      setStatus("ready")
      toast.success("PDF generado correctamente.", { description: filename })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido al generar el PDF."
      setErrorMessage(message)
      setStatus("error")
      toast.error("No se pudo generar el PDF.", { description: message })
    }
  }

  const descargarPDF = () => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Generar ── */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          number={1}
          title="Generar formatos PDF"
          subtitle="Se generará el PDF unificado con los formatos 053 y 069 listos para firma."
          done={status === "ready"}
        />

        <div className="flex flex-col gap-4 pl-9">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">Contenido del PDF</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              <li>• U.FT.12.010.053 — Constancia de cumplimiento contractual</li>
              <li>• U.FT.12.010.069 — Certificación determinación cedular</li>
              <li>• Planilla de seguridad social adjunta</li>
              <li>• Certificado ARL adjunto</li>
            </ul>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{filename}</p>
          </div>

          {status === "idle" && (
            <Button className="w-fit" onClick={generarPDF}>
              <FileCheckIcon className="size-4" />
              Generar PDF
            </Button>
          )}

          {status === "loading" && (
            <div className="flex items-center gap-3">
              <Loader2Icon className="size-5 animate-spin text-primary" />
              <p className="text-sm">Generando PDF, por favor espera…</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <AlertDescription>
                  {errorMessage ?? "Ocurrió un error al generar el PDF."}
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="w-fit" onClick={generarPDF}>
                Reintentar
              </Button>
            </div>
          )}

          {status === "ready" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
                <FileCheckIcon className="size-4 text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  PDF generado correctamente.
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={descargarPDF}>
                  <DownloadIcon className="size-4" />
                  Descargar {filename}
                </Button>
                <Button variant="outline" onClick={generarPDF}>
                  Regenerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pasos siguientes ── */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          number={2}
          title="Pasos siguientes"
          subtitle="Una vez descargado el PDF."
        />
        <ol className="flex flex-col gap-2 pl-9 text-sm text-muted-foreground">
          <li>1. Revisa que todos los datos sean correctos.</li>
          <li>2. Imprime o comparte el PDF con el supervisor para su firma.</li>
          <li>3. El supervisor firma los formatos 053 y 069 y los devuelve escaneados.</li>
          <li>
            4. Adjunta el PDF firmado al proceso contractual en el sistema universitario.
          </li>
        </ol>
      </div>
    </div>
  )
}
