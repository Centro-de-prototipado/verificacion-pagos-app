"use client"

import { useMemo, useEffect, useRef, useState } from "react"
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  Loader2Icon,
} from "lucide-react"

import { useWizardStore } from "@/lib/store"
import { runValidations } from "@/lib/validations"
import type {
  ContributionCalculation,
  ValidationResult,
  WizardStep,
} from "@/lib/types"
import { DocumentDropzone } from "@/components/upload/document-dropzone"
import type { InformeAuditResult } from "@/app/api/extract-informe/route"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
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
  const rows: [string, number][] = [
    ["Base de cotización", contributions.calculationBase],
    ["Valor mensualizado", contributions.monthlyValue],
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
              ${v.toLocaleString("es-CO")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Informe audit display ─────────────────────────────────────────────────────

function InformeAuditPanel({
  status,
  result,
}: {
  status: "idle" | "loading" | "done" | "error"
  result: InformeAuditResult | null
}) {
  if (status === "idle") return null

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>Auditando informe de actividades…</span>
      </div>
    )
  }

  if (status === "error" || !result) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon className="size-4" />
        <AlertDescription>
          No se pudo auditar el informe. Verifica que el PDF sea legible.
        </AlertDescription>
      </Alert>
    )
  }

  if (result.ok) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
        <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
        <p className="text-sm text-green-700 dark:text-green-400">
          Informe auditado correctamente — {result.filas} fila(s) revisada(s),
          sin observaciones.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
        <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" />
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Advertencia — Informe de actividades ({result.filas} filas revisadas)
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 pl-1">
        {result.warnings.map((w, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
            {w}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Puedes continuar igualmente, pero se recomienda corregir el informe
        antes de entregarlo.
      </p>
    </div>
  )
}

// ─── Step component ───────────────────────────────────────────────────────────

export function Step4() {
  const {
    extractedData,
    manualData,
    documents,
    informeRecibido,
    setInformeRecibido,
    setDocuments,
    setStep,
  } = useWizardStore()

  // ── Informe audit state ────────────────────────────────────────────────────
  const [auditStatus, setAuditStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle")
  const [auditResult, setAuditResult] = useState<InformeAuditResult | null>(
    null
  )
  // Track last audited file to avoid re-auditing the same file
  const lastAuditedFile = useRef<File | null>(null)

  useEffect(() => {
    const file = documents.activityReport ?? null
    if (!informeRecibido || !file) {
      // Reset audit if informe toggle is off or file removed
      if (!file) {
        setAuditStatus("idle")
        setAuditResult(null)
        lastAuditedFile.current = null
      }
      return
    }
    if (file === lastAuditedFile.current) return // already audited this file

    lastAuditedFile.current = file
    setAuditStatus("loading")
    setAuditResult(null)

    const fd = new FormData()
    fd.append("informe", file)

    fetch("/api/extract-informe", { method: "POST", body: fd })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<InformeAuditResult>
      })
      .then((data) => {
        setAuditResult(data)
        setAuditStatus("done")
      })
      .catch(() => {
        setAuditStatus("error")
      })
  }, [documents.activityReport, informeRecibido])

  // ── Main validation summary ────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!extractedData || !manualData) return null
    return runValidations(extractedData, manualData, informeRecibido)
  }, [extractedData, manualData, informeRecibido])

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
            subtitle={`El contrato exige informe cada ${contract!.activityReport.frequencyMonths} mes(es). Confirma si fue recibido.`}
          />
          <div className="flex flex-col gap-3 pl-9">
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <Switch
                id="informe-recibido"
                checked={informeRecibido}
                onCheckedChange={(checked) => {
                  setInformeRecibido(checked)
                  // Clear uploaded informe when toggle is switched off
                  if (!checked) setDocuments({ activityReport: null })
                }}
              />
              <label
                htmlFor="informe-recibido"
                className="cursor-pointer text-sm"
              >
                Informe de actividades recibido y verificado
              </label>
            </div>
            {informeRecibido && (
              <div className="flex flex-col gap-3">
                <DocumentDropzone
                  stepNumber={4}
                  label="Informe de actividades (U.FT.12.011.020)"
                  description="Sube el PDF del informe para auditarlo automáticamente"
                  hint="Se verificará que todas las casillas estén diligenciadas y que el cumplimiento del período no supere el acumulado"
                  file={documents.activityReport ?? null}
                  onFileChange={(file) =>
                    setDocuments({ activityReport: file })
                  }
                />
                {/* Audit result — non-blocking */}
                <InformeAuditPanel status={auditStatus} result={auditResult} />
              </div>
            )}
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
              onFileChange={(file) => setDocuments({ paymentSheet2: file })}
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
          className="w-fit"
          disabled={!summary || summary.blocked}
          onClick={() => setStep(4 as WizardStep)}
        >
          Continuar — Generar PDF
        </Button>
      </div>
    </div>
  )
}
