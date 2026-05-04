"use client"

import { useMemo, useState } from "react"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  Loader2Icon,
} from "lucide-react"

import { useWizardStore } from "@/lib/store"
import { runValidations } from "@/lib/validations"
import type {
  ActivityReportData,
  ContributionCalculation,
  ValidationResult,
  WizardStep,
} from "@/lib/types"
import { DocumentDropzone } from "@/components/upload/document-dropzone"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionHeader } from "./section-header"

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({ result }: { result: ValidationResult }) {
  const Icon = result.ok
    ? CheckCircle2Icon
    : result.blocking
      ? XCircleIcon
      : AlertTriangleIcon

  const color = result.ok
    ? "text-green-600"
    : result.blocking
      ? "text-destructive"
      : "text-amber-600"

  const typeLabel: Record<typeof result.type, string> = {
    contribution: "Aportes",
    date: "Fechas",
    report: "Informe",
    cedular: "Cedular",
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {typeLabel[result.type]}
        </span>
        <p className="text-sm leading-snug">{result.message}</p>
      </div>
    </div>
  )
}

// ─── Contribution grid ────────────────────────────────────────────────────────

function ContributionGrid({
  label,
  contributions,
  highlight = false,
}: {
  label?: string
  contributions: ContributionCalculation
  highlight?: boolean
}) {
  const rows: [string, number | string][] = [
    ["Meses del contrato", contributions.contractMonths],
    ["Valor mensualizado", contributions.monthlyValue],
    ["Base de cotización", contributions.calculationBase],
    ["Salud (12.5%)", contributions.healthContribution],
    ["Pensión (16%)", contributions.pensionContribution],
    ["Fondo solidaridad", contributions.solidarityFund],
    ["ARL", contributions.arlContribution],
    ["Total obligatorio", contributions.totalObligatory],
  ]
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p
          className={`text-xs font-semibold tracking-wide uppercase ${highlight ? "text-primary" : "text-muted-foreground"}`}
        >
          {label}
        </p>
      )}
      <div
        className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${highlight ? "rounded-lg border border-primary/20 bg-primary/5 p-3" : ""}`}
      >
        {rows.map(([l, v]) => (
          <div
            key={l}
            className="flex flex-col gap-1 rounded-lg border px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{l}</span>
            <span className="text-sm font-semibold">
              {l === "Meses del contrato"
                ? `${v} mes${Number(v) !== 1 ? "es" : ""}`
                : `$${Number(v).toLocaleString("es-CO")}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step component ───────────────────────────────────────────────────────────

export function Step3() {
  const {
    extractedData,
    manualData,
    documents,
    setDocuments,
    setStep,
    setExtractedData,
  } = useWizardStore()

  const [isExtractingReport, setIsExtractingReport] = useState(false)
  const [isExtractingPS2, setIsExtractingPS2] = useState(false)

  const handlePaymentSheet2Upload = async (file: File | null) => {
    setDocuments({ paymentSheet2: file })
    if (!file) {
      if (extractedData) {
        setExtractedData({ ...extractedData, paymentSheet2: null })
      }
      return
    }

    setIsExtractingPS2(true)
    try {
      const formData = new FormData()
      formData.append("paymentSheet", file) // API expects 'paymentSheet' key for PILA

      const textRes = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      })
      if (!textRes.ok) throw new Error("Error extrayendo texto de la planilla")
      const rawText = await textRes.json()

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: { paymentSheet2: rawText.paymentSheet },
          profiles: [],
        }),
      })

      if (!aiRes.ok || !aiRes.body)
        throw new Error("Error analizando la planilla con IA")

      const reader = aiRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === "result" && event.data.paymentSheet2) {
              if (extractedData) {
                setExtractedData({
                  ...extractedData,
                  paymentSheet2: event.data.paymentSheet2,
                })
              }
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Error extracting ps2:", err)
    } finally {
      setIsExtractingPS2(false)
    }
  }

  const handleReportUpload = async (file: File | null) => {
    setDocuments({ activityReport: file })
    if (!file) {
      if (extractedData) {
        setExtractedData({ ...extractedData, activityReport: null })
      }
      return
    }

    setIsExtractingReport(true)
    try {
      const formData = new FormData()
      formData.append("activityReport", file)

      const textRes = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      })
      if (!textRes.ok) throw new Error("Error extrayendo texto del informe")
      const rawText = await textRes.json()

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: { activityReport: rawText.activityReport },
          profiles: [],
        }),
      })

      if (!aiRes.ok || !aiRes.body)
        throw new Error("Error analizando el informe con IA")

      const reader = aiRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === "result" && event.data.activityReport) {
              if (extractedData) {
                setExtractedData({
                  ...extractedData,
                  activityReport: event.data.activityReport,
                })
              }
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
    } catch (err) {
      console.error("Error extracting report:", err)
    } finally {
      setIsExtractingReport(false)
    }
  }

  const summary = useMemo(() => {
    if (!extractedData || !manualData) return null
    return runValidations(extractedData, manualData, !!documents.activityReport)
  }, [extractedData, manualData, documents.activityReport])

  if (!extractedData || !manualData) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No hay datos para validar. Regresa al paso anterior.
        </AlertDescription>
      </Alert>
    )
  }

  const contract = extractedData.contract
  const needsInforme =
    contract?.activityReport.required &&
    contract.activityReport.frequencyMonths !== null &&
    manualData.paymentNumber % contract.activityReport.frequencyMonths === 0

  return (
    <div className="flex flex-col gap-8">
      {/* ── Informe de actividades ── */}
      {needsInforme && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={1}
            title="Informe de actividades"
            subtitle={`El contrato exige informe cada ${contract!.activityReport.frequencyMonths} mes(es). Adjunta el PDF para incluirlo en el paquete final.`}
          />
          <div className="pl-9">
            <DocumentDropzone
              stepNumber={4}
              label="Informe de actividades (U.FT.12.011.020)"
              description="Se adjuntará al PDF final"
              hint="Formato U.FT.12.011.020 de la Universidad Nacional"
              file={documents.activityReport ?? null}
              onFileChange={handleReportUpload}
              loading={isExtractingReport}
            />
          </div>
        </div>
      )}

      {/* ── Planilla vencida ── */}
      {summary?.isLatePayment && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={needsInforme ? 2 : 1}
            title="Planilla del mes siguiente"
            subtitle="El pago fue extemporáneo. Adjunta la planilla del mes siguiente para incluirla en el PDF."
          />
          <div className="pl-9">
            <DocumentDropzone
              stepNumber={5}
              label="Planilla mes siguiente"
              description="Planilla de seguridad social del período posterior"
              hint="Mismo formato que la planilla original"
              file={documents.paymentSheet2 ?? null}
              onFileChange={handlePaymentSheet2Upload}
              loading={isExtractingPS2}
            />
          </div>
        </div>
      )}

      {/* ── Resultados de validación ── */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          number={
            needsInforme && summary?.isLatePayment
              ? 3
              : needsInforme || summary?.isLatePayment
                ? 2
                : 1
          }
          title="Resultados de validación"
          subtitle="Verificación automática de aportes y requisitos contractuales."
          done={summary?.blocked === false}
        />

        {summary && (
          <div className="flex flex-col gap-2 pl-9">
            {isExtractingReport && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                <p className="text-sm">Analizando contenido del informe con IA...</p>
              </div>
            )}
            {isExtractingPS2 && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                <p className="text-sm">Analizando planilla del mes siguiente con IA...</p>
              </div>
            )}
            {summary.results.map((r, i) => (
              <ResultRow key={i} result={r} />
            ))}
          </div>
        )}
      </div>

      {/* ── Aportes calculados ── */}
      {summary?.contributions && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={
              needsInforme && summary?.isLatePayment
                ? 4
                : needsInforme || summary?.isLatePayment
                  ? 3
                  : 2
            }
            title="Aportes calculados"
            subtitle={
              summary.contributions2
                ? "Aportes por contrato y total combinado para el formato 069."
                : "Valores que se imprimirán en el formato 069."
            }
          />
          {summary.contributions2 ? (
            <div className="flex flex-col gap-4 pl-9">
              <ContributionGrid
                label="Contrato 1"
                contributions={summary.contributions1!}
              />
              <ContributionGrid
                label="Contrato 2"
                contributions={summary.contributions2}
              />
              <ContributionGrid
                label="Total combinado"
                contributions={summary.contributions}
                highlight
              />
            </div>
          ) : (
            <div className="pl-9">
              <ContributionGrid contributions={summary.contributions} />
            </div>
          )}
        </div>
      )}

      {/* ── Acción ── */}
      <div className="flex flex-col gap-3">
        {summary?.blocked && (
          <Alert variant="destructive">
            <AlertDescription>
              Hay validaciones bloqueantes. Corrige los problemas antes de
              generar el PDF.
            </AlertDescription>
          </Alert>
        )}

        {summary && !summary.blocked && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
            <ShieldCheckIcon className="size-4 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Todas las validaciones pasaron. Puedes generar el PDF.
            </p>
          </div>
        )}

        <Button
          size="lg"
          className="w-full text-base"
          disabled={!summary || summary.blocked}
          onClick={() => setStep(4 as WizardStep)}
        >
          Continuar — Generar PDF
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
