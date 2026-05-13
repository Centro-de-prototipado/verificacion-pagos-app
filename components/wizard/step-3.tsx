"use client"

import { useMemo, useState } from "react"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useWizardStore } from "@/lib/store"
import { runValidations } from "@/lib/validations"
import type {
  ContributionCalculation,
  ValidationResult,
  WizardStep,
} from "@/lib/types"
import { DocumentDropzone } from "@/components/upload/document-dropzone"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionHeader } from "./section-header"

// ─── Result row ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ValidationResult["type"], string> = {
  contribution: "Aportes",
  date: "Fechas",
  report: "Informe",
  cedular: "Cedular",
}

function ResultRow({ result }: { result: ValidationResult }) {
  if (result.ok) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/50 px-4 py-3 dark:border-green-900 dark:bg-green-950/20">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-green-700 dark:text-green-400 uppercase">
            {TYPE_LABELS[result.type]}
          </span>
          <p className="text-sm leading-snug text-green-800 dark:text-green-300">
            {result.message}
          </p>
        </div>
      </div>
    )
  }

  if (result.blocking) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-destructive uppercase">
            {TYPE_LABELS[result.type]}
          </span>
          <p className="text-sm leading-snug whitespace-pre-line text-destructive/90">
            {result.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400 uppercase">
          {TYPE_LABELS[result.type]}
        </span>
        <p className="text-sm leading-snug whitespace-pre-line text-amber-800 dark:text-amber-300">
          {result.message}
        </p>
      </div>
    </div>
  )
}

// ─── Validation results section ───────────────────────────────────────────────

function ValidationResults({
  results,
  isExtractingReport,
  isExtractingPS2,
}: {
  results: ValidationResult[]
  isExtractingReport: boolean
  isExtractingPS2: boolean
}) {
  const [showPassed, setShowPassed] = useState(false)

  const { errors, warnings, passed } = useMemo(() => {
    const errors: ValidationResult[] = []
    const warnings: ValidationResult[] = []
    const passed: ValidationResult[] = []
    for (const r of results) {
      if (r.ok) passed.push(r)
      else if (r.blocking) errors.push(r)
      else warnings.push(r)
    }
    return { errors, warnings, passed }
  }, [results])

  const isAnalyzing = isExtractingReport || isExtractingPS2

  return (
    <div className="flex flex-col gap-3">
      {/* Summary banner */}
      {isAnalyzing ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
          <p className="text-sm font-medium text-primary">
            {isExtractingReport
              ? "Analizando informe de actividades con IA…"
              : "Analizando planilla del mes siguiente con IA…"}
          </p>
        </div>
      ) : errors.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
          <XCircleIcon className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {errors.length === 1
                ? "1 error bloqueante"
                : `${errors.length} errores bloqueantes`}
            </p>
            <p className="text-xs text-destructive/70">
              Debes corregir los problemas antes de generar el PDF.
            </p>
          </div>
        </div>
      ) : warnings.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {warnings.length === 1
                ? "1 advertencia no bloqueante"
                : `${warnings.length} advertencias no bloqueantes`}
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              Puedes continuar, pero revisa estos puntos.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 dark:border-green-900 dark:bg-green-950/30">
          <ShieldCheckIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Todas las validaciones pasaron
            </p>
            <p className="text-xs text-green-700/70 dark:text-green-400/70">
              La documentación cumple con los requisitos.
            </p>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-2">
          {errors.map((r, i) => (
            <ResultRow key={`err-${i}`} result={r} />
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((r, i) => (
            <ResultRow key={`warn-${i}`} result={r} />
          ))}
        </div>
      )}

      {/* Passed — collapsible */}
      {passed.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassed ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
            {showPassed
              ? "Ocultar validaciones aprobadas"
              : `Ver ${passed.length} validación${passed.length !== 1 ? "es" : ""} aprobada${passed.length !== 1 ? "s" : ""}`}
          </button>
          {showPassed && (
            <div className="flex flex-col gap-2">
              {passed.map((r, i) => (
                <ResultRow key={`ok-${i}`} result={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Contribution row ─────────────────────────────────────────────────────────

function ContributionRow({
  label,
  value,
  isMonths = false,
  bold = false,
}: {
  label: string
  value: number
  isMonths?: boolean
  bold?: boolean
}) {
  const formatted = isMonths
    ? `${value} mes${value !== 1 ? "es" : ""}`
    : `$ ${value.toLocaleString("es-CO")}`

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5",
        bold && "border-primary/20 bg-primary/5"
      )}
    >
      <span
        className={cn(
          "text-sm",
          bold ? "font-semibold" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className={cn("text-sm tabular-nums", bold && "font-bold")}>
        {formatted}
      </span>
    </div>
  )
}

function ContributionGrid({
  label,
  contributions,
  highlight = false,
}: {
  label?: string
  contributions: ContributionCalculation
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            highlight ? "text-primary" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <ContributionRow
          label="Meses del contrato"
          value={contributions.contractMonths}
          isMonths
        />
        <ContributionRow
          label="Valor mensualizado"
          value={contributions.monthlyValue}
        />
        <ContributionRow
          label="Base de cotización"
          value={contributions.calculationBase}
        />
        <ContributionRow
          label="Salud (12.5%)"
          value={contributions.healthContribution}
        />
        <ContributionRow
          label="Pensión (16%)"
          value={contributions.pensionContribution}
        />
        <ContributionRow
          label="Fondo solidaridad"
          value={contributions.solidarityFund}
        />
        <ContributionRow label="ARL" value={contributions.arlContribution} />
        <ContributionRow
          label="Total obligatorio"
          value={contributions.totalObligatory}
          bold
        />
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
  const [reportError, setReportError] = useState<string | null>(null)
  const [ps2Error, setPs2Error] = useState<string | null>(null)

  const handlePaymentSheet2Upload = async (file: File | null) => {
    setDocuments({ paymentSheet2: file })
    setPs2Error(null)
    if (!file) {
      if (extractedData) setExtractedData({ ...extractedData, paymentSheet2: null })
      return
    }

    setIsExtractingPS2(true)
    try {
      const formData = new FormData()
      formData.append("paymentSheet", file)

      const textRes = await fetch("/api/extract-text", { method: "POST", body: formData })
      if (!textRes.ok) throw new Error("Error extrayendo texto de la planilla")
      const rawText = await textRes.json()

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: { paymentSheet2: rawText.paymentSheet }, profiles: [] }),
      })
      if (!aiRes.ok || !aiRes.body) throw new Error("Error analizando la planilla con IA")

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
            if (event.type === "result" && event.data.paymentSheet2 && extractedData) {
              setExtractedData({ ...extractedData, paymentSheet2: event.data.paymentSheet2 })
            }
          } catch {}
        }
      }
    } catch (err) {
      setPs2Error("No se pudo analizar la planilla. Verifica que sea un PDF válido e intenta de nuevo.")
      console.error("Error extracting ps2:", err)
    } finally {
      setIsExtractingPS2(false)
    }
  }

  const handleReportUpload = async (file: File | null) => {
    setDocuments({ activityReport: file })
    setReportError(null)
    if (!file) {
      if (extractedData) setExtractedData({ ...extractedData, activityReport: null })
      return
    }

    setIsExtractingReport(true)
    try {
      const formData = new FormData()
      formData.append("activityReport", file)

      const textRes = await fetch("/api/extract-text", { method: "POST", body: formData })
      if (!textRes.ok) throw new Error("Error extrayendo texto del informe")
      const rawText = await textRes.json()

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: { activityReport: rawText.activityReport },
          profiles: [],
          obligationsHint: extractedData?.contract?.specificObligations || [],
        }),
      })
      if (!aiRes.ok || !aiRes.body) throw new Error("Error analizando el informe con IA")

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
            if (event.type === "result" && event.data.activityReport && extractedData) {
              setExtractedData({ ...extractedData, activityReport: event.data.activityReport })
            }
          } catch {}
        }
      }
    } catch (err) {
      setReportError("No se pudo analizar el informe. Verifica que sea un PDF válido e intenta de nuevo.")
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

  let sectionN = 1
  const nextN = () => sectionN++

  return (
    <div className="flex flex-col gap-8">
      {/* ── Informe de actividades ── */}
      {needsInforme && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={nextN()}
            title="Informe de actividades"
            subtitle={`El contrato exige informe cada ${contract!.activityReport.frequencyMonths} mes(es). Adjunta el PDF para incluirlo en el paquete final.`}
          />
          <div className="flex flex-col gap-2 pl-9">
            <DocumentDropzone
              stepNumber={4}
              label="Informe de actividades (U.FT.12.011.020)"
              description="Se adjuntará al PDF final"
              hint="Formato U.FT.12.011.020 de la Universidad Nacional"
              file={documents.activityReport ?? null}
              onFileChange={handleReportUpload}
              loading={isExtractingReport}
            />
            {reportError && (
              <p className="text-sm text-destructive">{reportError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Planilla mes siguiente (pago extemporáneo o atraso en el trámite) ── */}
      {summary?.isLatePayment && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={nextN()}
            title="Planilla del mes siguiente"
            subtitle="El plazo de la próxima planilla ya venció. Adjunta la del mes siguiente para validar el trámite."
          />
          <div className="flex flex-col gap-2 pl-9">
            <DocumentDropzone
              stepNumber={5}
              label="Planilla mes siguiente"
              description="Planilla de seguridad social del período posterior"
              hint="Mismo formato que la planilla original"
              file={documents.paymentSheet2 ?? null}
              onFileChange={handlePaymentSheet2Upload}
              loading={isExtractingPS2}
            />
            {ps2Error && (
              <p className="text-sm text-destructive">{ps2Error}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Resultados de validación ── */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          number={nextN()}
          title="Resultados de validación"
          subtitle="Verificación automática de aportes y requisitos contractuales."
          done={summary?.blocked === false && !isExtractingReport && !isExtractingPS2}
        />
        {summary && (
          <div className="pl-9">
            <ValidationResults
              results={summary.results}
              isExtractingReport={isExtractingReport}
              isExtractingPS2={isExtractingPS2}
            />
          </div>
        )}
      </div>

      {/* ── Aportes calculados ── */}
      {summary?.contributions && (
        <div className="flex flex-col gap-3">
          <SectionHeader
            number={nextN()}
            title="Aportes calculados"
            subtitle={
              summary.contributions2
                ? "Aportes por contrato y total combinado para el formato 069."
                : "Valores que se imprimirán en el formato 069."
            }
          />
          {summary.contributions2 ? (
            <div className="flex flex-col gap-5 pl-9">
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
      <Button
        size="lg"
        className="w-full text-base"
        disabled={
          !summary ||
          summary.blocked ||
          isExtractingReport ||
          isExtractingPS2
        }
        onClick={() => setStep(4 as WizardStep)}
      >
        Continuar — Generar PDF
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  )
}
