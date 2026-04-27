"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react"

import { useWizardStore } from "@/lib/store"
import { getAllProfiles, saveProfile } from "@/lib/pdf/document-profiles"
import {
  calcularFechaLimite,
  diasHabilAsignados,
} from "@/lib/validations/fecha-limite"
import type {
  ARLData,
  ConfidenceLevel,
  ConfidenceMap,
  ContractData,
  ContractType,
  DocumentType,
  ExtractedData,
  PaymentSheetData,
  RawPDFText,
  RiskClass,
  WizardStep,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { SectionHeader } from "./section-header"

type ExtractionStatus =
  | "idle"
  | "loading-text"
  | "loading-ai"
  | "ready"
  | "error"
  | "manual"

// ─── Confidence indicator ─────────────────────────────────────────────────────

const CONFIDENCE_CONFIG = {
  high: {
    cls: "bg-green-500",
    title: "Extraído con seguridad — no necesita revisión",
  },
  medium: {
    cls: "bg-amber-400",
    title: "Confianza media — revisa que el valor sea correcto",
  },
  low: {
    cls: "bg-red-400",
    title: "No encontrado — ingresa el valor manualmente",
  },
} as const

function ConfidenceDot({ level }: { level?: ConfidenceLevel }) {
  if (!level) return null
  const { cls, title } = CONFIDENCE_CONFIG[level]
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${cls}`}
      title={title}
    />
  )
}

function ConfidenceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="font-medium">Color de confianza:</span>
      {(["high", "medium", "low"] as ConfidenceLevel[]).map((lvl) => (
        <span key={lvl} className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full ${CONFIDENCE_CONFIG[lvl].cls}`}
          />
          {lvl === "high"
            ? "Correcto"
            : lvl === "medium"
              ? "Verificar"
              : "Ingresar manualmente"}
        </span>
      ))}
    </div>
  )
}

// ─── Editable field primitives ────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  type = "text",
  highlight,
  placeholder,
  confidence,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: "text" | "number"
  highlight?: "green" | "red"
  placeholder?: string
  confidence?: ConfidenceLevel
}) {
  const color =
    highlight === "green"
      ? "text-green-600"
      : highlight === "red"
        ? "text-destructive"
        : ""

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ConfidenceDot level={confidence} />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50 ${color}`}
      />
    </div>
  )
}

function EditSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  confidence,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  confidence?: ConfidenceLevel
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ConfidenceDot level={confidence} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-transparent text-sm font-medium outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function MoneyField({
  label,
  value,
  onChange,
  confidence,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  confidence?: ConfidenceLevel
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ConfidenceDot level={confidence} />
      </div>
      <input
        type={focused ? "number" : "text"}
        value={focused ? value || "" : value ? COP.format(value) : ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="$ 0"
        className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function DocSection({
  title,
  failed,
  warnings,
  children,
}: {
  title: string
  failed?: boolean
  warnings?: string[]
  children: React.ReactNode
}) {
  const hasWarnings = warnings && warnings.length > 0
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-4 ${
        failed
          ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/20"
          : hasWarnings
            ? "border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/10"
            : "bg-muted/20"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {(failed || hasWarnings) && (
            <AlertCircleIcon className="size-3.5 shrink-0 text-amber-500" />
          )}
          <p
            className={`text-xs font-semibold tracking-wide uppercase ${failed || hasWarnings ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
          >
            {title}
          </p>
        </div>
        {failed && (
          <p className="pl-5 text-[11px] text-amber-700 dark:text-amber-400">
            No se pudo extraer — completa los campos a mano, son editables.
          </p>
        )}
      </div>
      {hasWarnings && (
        <ul className="flex flex-col gap-0.5">
          {warnings!.map((w) => (
            <li
              key={w}
              className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400"
            >
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{w.replace(/^[^—]+—\s*/, "")}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  )
}

// ─── Document editors ─────────────────────────────────────────────────────────

function PlanillaEditor({
  data,
  onChange,
  deadlineCalcNote,
  warnings,
  confidenceMap,
}: {
  data: PaymentSheetData | null
  onChange: (d: PaymentSheetData) => void
  deadlineCalcNote?: string
  warnings?: string[]
  confidenceMap?: ConfidenceMap
}) {
  const empty: PaymentSheetData = {
    sheetNumber: "",
    paymentDate: "",
    paymentDeadline: null,
    period: "",
    totalAmountPaid: 0,
  }
  const d = data ?? empty
  const set = (patch: Partial<PaymentSheetData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title="Planilla PILA" failed={!data} warnings={warnings}>
      <EditField
        label="Número de planilla"
        value={d.sheetNumber}
        onChange={(v) => set({ sheetNumber: v })}
        confidence={c?.sheetNumber}
      />
      <EditField
        label="Fecha de pago"
        value={d.paymentDate}
        onChange={(v) => set({ paymentDate: v })}
        confidence={c?.paymentDate}
      />
      <div className="flex flex-col gap-0.5">
        <EditField
          label="Fecha límite de pago"
          value={d.paymentDeadline ?? ""}
          onChange={(v) => set({ paymentDeadline: v || null })}
          placeholder="No encontrada — se calculará automáticamente"
          confidence={c?.paymentDeadline}
        />
        {deadlineCalcNote && (
          <p className="pl-1 text-[11px] text-muted-foreground">
            {deadlineCalcNote}
          </p>
        )}
      </div>
      <EditField
        label="Período (MM/YYYY)"
        value={d.period}
        onChange={(v) => set({ period: v })}
        confidence={c?.period}
      />
      <MoneyField
        label="Valor total pagado"
        value={d.totalAmountPaid}
        onChange={(v) => set({ totalAmountPaid: v })}
        confidence={c?.totalAmountPaid}
      />
    </DocSection>
  )
}

const COVERAGE_OPTIONS: { value: ARLData["coverageStatus"]; label: string }[] =
  [
    { value: "ACTIVA", label: "ACTIVA" },
    { value: "INACTIVA", label: "INACTIVA" },
    { value: "SUSPENDIDA", label: "SUSPENDIDA" },
  ]

const RISK_OPTIONS: { value: RiskClass; label: string }[] = [
  { value: "I", label: "Riesgo 1" },
  { value: "II", label: "Riesgo 2" },
  { value: "III", label: "Riesgo 3" },
  { value: "IV", label: "Riesgo 4" },
  { value: "V", label: "Riesgo 5" },
]

function ARLEditor({
  data,
  onChange,
  warnings,
  confidenceMap,
}: {
  data: ARLData | null
  onChange: (d: ARLData) => void
  warnings?: string[]
  confidenceMap?: ConfidenceMap
}) {
  const empty: ARLData = {
    startDate: "",
    endDate: "",
    coverageStatus: "ACTIVA",
    riskClass: "I",
    cotizationRate: 0,
  }
  const d = data ?? empty
  const set = (patch: Partial<ARLData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title="Certificado ARL" failed={!data} warnings={warnings}>
      <EditField
        label="Inicio cobertura"
        value={d.startDate}
        onChange={(v) => set({ startDate: v })}
        confidence={c?.startDate}
      />
      <EditField
        label="Fin cobertura"
        value={d.endDate}
        onChange={(v) => set({ endDate: v })}
        confidence={c?.endDate}
      />
      <EditSelect
        label="Estado cobertura"
        value={d.coverageStatus}
        onChange={(v) => set({ coverageStatus: v })}
        options={COVERAGE_OPTIONS}
        confidence={c?.coverageStatus}
      />
      <EditSelect
        label="Clase de riesgo"
        value={d.riskClass}
        onChange={(v) => set({ riskClass: v as RiskClass })}
        options={RISK_OPTIONS}
        confidence={c?.riskClass}
      />
      <EditField
        label="Tasa cotización (%)"
        type="number"
        value={String(d.cotizationRate)}
        onChange={(v) => set({ cotizationRate: Number(v) || 0 })}
        confidence={c?.cotizationRate}
      />
    </DocSection>
  )
}

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  // Órdenes contractuales
  "OCA",
  "OCO",
  "ODC",
  "ODO",
  "OPS",
  "OSE",
  "OSU",
  // Contratos
  "CCO",
  "CDA",
  "CDC",
  "CDO",
  "CIS",
  "CON",
  "COV",
  "CPS",
  "CSE",
  "CSU",
  // Vigencia futura
  "OEF",
  "OFA",
  "OFC",
  "OFO",
  "OFS",
  "OOF",
  "OSF",
  "OUF",
  "CAF",
  "CCF",
  "CIF",
  "COF",
  "CPF",
  "CSF",
  "CTF",
  "CUF",
  "CVF",
].map((t) => ({ value: t as ContractType, label: t }))

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "CC — Cédula de ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "CE — Cédula extranjería" },
]

function ContractEditor({
  data,
  title,
  onChange,
  warnings,
  confidenceMap,
}: {
  data: ContractData | null
  title: string
  onChange: (d: ContractData) => void
  warnings?: string[]
  confidenceMap?: ConfidenceMap
}) {
  const empty: ContractData = {
    contractType: "OSE",
    orderNumber: "",
    contractorName: "",
    documentType: "CC",
    documentNumber: "",
    totalValueBeforeTax: 0,
    startDate: "",
    endDate: "",
    activityReport: { required: false, frequencyMonths: null },
  }
  const d = data ?? empty
  const set = (patch: Partial<ContractData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title={title} failed={!data} warnings={warnings}>
      <EditSelect
        label="Tipo de contrato"
        value={d.contractType}
        onChange={(v) => set({ contractType: v as ContractType })}
        options={CONTRACT_TYPE_OPTIONS}
        confidence={c?.contractType}
      />
      <EditField
        label="Número de orden"
        value={d.orderNumber}
        onChange={(v) => set({ orderNumber: v })}
        confidence={c?.orderNumber}
      />
      <EditField
        label="Nombre contratista"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: v })}
        confidence={c?.contractorName}
      />
      <EditSelect
        label="Tipo documento"
        value={d.documentType}
        onChange={(v) => set({ documentType: v as DocumentType })}
        options={DOC_TYPE_OPTIONS}
        confidence={c?.documentType}
      />
      <EditField
        label="Número documento"
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: v })}
        confidence={c?.documentNumber}
      />
      <MoneyField
        label="Valor total sin impuestos"
        value={d.totalValueBeforeTax}
        onChange={(v) => set({ totalValueBeforeTax: v })}
        confidence={c?.totalValueBeforeTax}
      />
      <EditField
        label="Fecha inicio"
        value={d.startDate}
        onChange={(v) => set({ startDate: v })}
        confidence={c?.startDate}
      />
      <EditField
        label="Fecha fin"
        value={d.endDate}
        onChange={(v) => set({ endDate: v })}
        confidence={c?.endDate}
      />
      <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Informe de actividades
        </span>
        <div className="flex items-center gap-2">
          <select
            value={d.activityReport.required ? "si" : "no"}
            onChange={(e) =>
              set({
                activityReport: {
                  required: e.target.value === "si",
                  frequencyMonths:
                    e.target.value === "si"
                      ? (d.activityReport.frequencyMonths ?? 3)
                      : null,
                },
              })
            }
            className="bg-transparent text-sm font-medium outline-none"
          >
            <option value="no">No requerido</option>
            <option value="si">Sí</option>
          </select>
          {d.activityReport.required && (
            <>
              <span className="text-xs text-muted-foreground">cada</span>
              <input
                type="number"
                value={d.activityReport.frequencyMonths ?? ""}
                onChange={(e) =>
                  set({
                    activityReport: {
                      required: true,
                      frequencyMonths: Number(e.target.value) || null,
                    },
                  })
                }
                className="w-12 bg-transparent text-sm font-medium outline-none"
                min={1}
              />
              <span className="text-xs text-muted-foreground">mes(es)</span>
            </>
          )}
        </div>
      </div>
    </DocSection>
  )
}

// ─── Step component ───────────────────────────────────────────────────────────

export function Step2() {
  const {
    documents,

    setRawText,
    extractedData,
    setExtractedData,
    manualData,
    setStep,
  } = useWizardStore()

  const [status, setStatus] = useState<ExtractionStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Per-document extraction progress shown during loading-ai
  type DocStatus = "waiting" | "trying" | "done" | "failed"
  type DocProgress = { status: DocStatus; model?: string; finalModel?: string }
  const [docProgress, setDocProgress] = useState<Record<string, DocProgress>>(
    {}
  )

  const updateDoc = (doc: string, patch: Partial<DocProgress>) =>
    setDocProgress((prev) => ({
      ...prev,
      [doc]: { ...prev[doc], status: "waiting", ...patch },
    }))

  const [planilla, setPlanilla] = useState<PaymentSheetData | null>(null)
  const [arl, setArl] = useState<ARLData | null>(null)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [contract2, setContract2] = useState<ContractData | null>(null)
  const [issuerKeys, setIssuerKeys] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [confidence, setConfidence] = useState<Record<string, ConfidenceMap>>(
    {}
  )
  const originalExtraction = useRef<ExtractedData | null>(null)

  // Note shown under deadline field so the user can verify the inputs used
  const deadlineCalcNote = useMemo(() => {
    const period = planilla?.period
    const docNumber = contract?.documentNumber
    if (!period || !docNumber) return undefined
    try {
      const last2 = docNumber.replace(/\D/g, "").slice(-2)
      const n = diasHabilAsignados(docNumber)
      return `Calculada: período ${period} · últimos 2 dígitos ${last2} → día hábil ${n}`
    } catch {
      return undefined
    }
  }, [planilla?.period, contract?.documentNumber])

  // Populate editors once extraction finishes; calculate and validate paymentDeadline
  useEffect(() => {
    if (!extractedData) return
    const ps = extractedData.paymentSheet
    const ct = extractedData.contract

    let paymentDate = ps?.paymentDate ?? ""
    let deadline = ps?.paymentDeadline ?? null

    if (ps?.period && ct?.documentNumber) {
      try {
        // The calculated deadline is authoritative (Decreto 780/2016)
        const calculated = calcularFechaLimite(ps.period, ct.documentNumber)

        // If the extracted paymentDate matches the calculated deadline, the two
        // date fields were captured in reverse order — swap them back.
        if (paymentDate === calculated) {
          paymentDate = deadline ?? ""
          deadline = calculated
        } else {
          deadline = calculated
        }
      } catch {
        // malformed period or documentNumber — leave as-is
      }
    }

    setPlanilla(ps ? { ...ps, paymentDate, paymentDeadline: deadline } : null)

    const arlData = extractedData.arl

    // Convert an ARL ISO date (YYYY-MM-DD) to DD/MM/YYYY for contract fields
    const arlToDMY = (iso: string) => {
      const [y, m, d] = iso.split("-")
      return `${d}/${m}/${y}`
    }

    // Contract start/end always come from the ARL certificate — the ARL coverage
    // period is the same as the contract period, and ARL dates are reliably extracted.
    const applyARLDates = (c: typeof ct) => {
      if (!c) return null
      return {
        ...c,
        startDate: arlData ? arlToDMY(arlData.startDate) : c.startDate,
        endDate: arlData ? arlToDMY(arlData.endDate) : c.endDate,
      }
    }

    setArl(arlData)
    setContract(applyARLDates(ct))
    setContract2(applyARLDates(extractedData.contract2 ?? null))
  }, [extractedData])

  const buildFormData = useCallback(() => {
    const formData = new FormData()
    if (documents.paymentSheet)
      formData.append("paymentSheet", documents.paymentSheet)
    if (documents.arl) formData.append("arl", documents.arl)
    if (documents.contract) formData.append("contract", documents.contract)
    if (documents.contract2) formData.append("contract2", documents.contract2)
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

      const savedProfiles = getAllProfiles().map(
        ({ docType, issuer, example }) => ({
          docType,
          issuer,
          example,
        })
      )

      // Reset doc progress for the new run
      setDocProgress({})

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawData, profiles: savedProfiles }),
      })

      if (!aiRes.ok || !aiRes.body) {
        const details = await parseApiError(
          aiRes,
          `Error del servidor en extracción IA: ${aiRes.status}`
        )
        throw new Error(details)
      }

      // Read streaming NDJSON events
      const reader = aiRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let extractedPayload:
        | (ExtractedData & {
            warnings?: string[]
            issuerKeys?: Record<string, string>
            confidence?: Record<string, ConfidenceMap>
          })
        | null = null

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as {
            type: string
            doc?: string
            model?: string
            data?: ExtractedData
            warnings?: string[]
            issuerKeys?: Record<string, string>
            confidence?: Record<string, ConfidenceMap>
            message?: string
            details?: string
          }
          if (event.type === "trying" && event.doc && event.model) {
            updateDoc(event.doc, { status: "trying", model: event.model })
          } else if (event.type === "failed" && event.doc) {
            updateDoc(event.doc, { status: "trying" }) // still trying, just this model failed
          } else if (event.type === "success" && event.doc && event.model) {
            updateDoc(event.doc, { status: "done", finalModel: event.model })
          } else if (event.type === "result" && event.data) {
            extractedPayload = {
              ...event.data,
              warnings: event.warnings,
              issuerKeys: event.issuerKeys,
              confidence: event.confidence,
            }
          } else if (event.type === "error") {
            throw new Error(
              event.details ?? event.message ?? "Error en extracción IA"
            )
          }
        }
      }

      if (!extractedPayload) throw new Error("La IA no devolvió datos.")

      const {
        warnings = [],
        issuerKeys: keys = {},
        confidence: conf = {},
        ...extracted
      } = extractedPayload
      setExtractedData(extracted)
      setIssuerKeys(keys)
      setWarnings(warnings)
      setConfidence(conf)
      originalExtraction.current = extracted
      setStatus("ready")

      if (warnings.length > 0) {
        toast.warning(`${warnings.length} observación(es) en la extracción.`, {
          description: "Revisa los campos marcados abajo.",
        })
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido al procesar los PDFs."
      setErrorMessage(message)
      setStatus("error")
      toast.error("No se pudo completar la extracción.", {
        description: message,
      })
    }
  }, [buildFormData, setExtractedData, setRawText])

  useEffect(() => {
    processStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = () => {
    // Cross-validate: detect fields the user changed vs AI output
    const orig = originalExtraction.current
    const changed: string[] = []
    if (orig) {
      const ps = orig.paymentSheet
      if (ps && planilla) {
        if (ps.sheetNumber !== planilla.sheetNumber) changed.push("N° planilla")
        if (ps.paymentDate !== planilla.paymentDate)
          changed.push("Fecha de pago")
        if (ps.period !== planilla.period) changed.push("Período")
        if (ps.totalAmountPaid !== planilla.totalAmountPaid)
          changed.push("Valor total")
      }
      const ar = orig.arl
      if (ar && arl) {
        if (ar.startDate !== arl.startDate) changed.push("Inicio ARL")
        if (ar.endDate !== arl.endDate) changed.push("Fin ARL")
        if (ar.coverageStatus !== arl.coverageStatus) changed.push("Estado ARL")
        if (ar.riskClass !== arl.riskClass) changed.push("Clase riesgo")
        if (ar.cotizationRate !== arl.cotizationRate) changed.push("Tasa ARL")
      }
      const ct = orig.contract
      if (ct && contract) {
        if (ct.contractType !== contract.contractType)
          changed.push("Tipo contrato")
        if (ct.orderNumber !== contract.orderNumber) changed.push("N° orden")
        if (ct.contractorName !== contract.contractorName)
          changed.push("Nombre contratista")
        if (ct.documentNumber !== contract.documentNumber)
          changed.push("N° documento")
        if (ct.totalValueBeforeTax !== contract.totalValueBeforeTax)
          changed.push("Valor contrato")
        if (ct.startDate !== contract.startDate) changed.push("Inicio contrato")
        if (ct.endDate !== contract.endDate) changed.push("Fin contrato")
      }
    }
    if (changed.length > 0) {
      toast.info("Correcciones guardadas.", {
        description: `Campos modificados: ${changed.join(", ")}`,
      })
    }

    // Save document profiles to localStorage for future extractions
    if (issuerKeys.paymentSheet && planilla)
      saveProfile(
        "pila",
        issuerKeys.paymentSheet,
        planilla as unknown as Record<string, unknown>
      )
    if (issuerKeys.arl && arl)
      saveProfile(
        "arl",
        issuerKeys.arl,
        arl as unknown as Record<string, unknown>
      )
    if (issuerKeys.contract && contract)
      saveProfile(
        "contract",
        issuerKeys.contract,
        contract as unknown as Record<string, unknown>
      )

    setExtractedData({ paymentSheet: planilla, arl, contract, contract2 })
    setStep(3 as WizardStep)
  }

  const isReady = status === "ready" || status === "manual"
  const allFailed = isReady && !planilla && !arl && !contract
  const someFailed = isReady && (!planilla || !arl || !contract)

  const handleSkipToManual = () => {
    setStatus("manual")
    setErrorMessage(null)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ① Extracción */}
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={1}
          title="Procesamiento automático de documentos"
          subtitle="El sistema extrae el texto de los PDFs y los analiza con inteligencia artificial."
          done={isReady}
        />

        {status === "loading-text" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Leyendo los archivos PDF…</p>
              <p className="text-xs text-muted-foreground">
                Puede tardar unos segundos según el tamaño de los documentos.
              </p>
            </div>
          </div>
        )}

        {status === "loading-ai" &&
          (() => {
            const docs = [
              {
                key: "paymentSheet",
                label: "Planilla PILA",
                Icon: ReceiptTextIcon,
              },
              { key: "arl", label: "Certificado ARL", Icon: ShieldCheckIcon },
              { key: "contract", label: "Contrato 1", Icon: ScrollTextIcon },
              ...(documents.contract2
                ? [
                    {
                      key: "contract2",
                      label: "Contrato 2",
                      Icon: ScrollTextIcon,
                    },
                  ]
                : []),
            ] as { key: string; label: string; Icon: React.ElementType }[]
            const doneCount = docs.filter(
              (d) => docProgress[d.key]?.status === "done"
            ).length
            return (
              <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed px-6 py-10">
                {/* Header */}
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                    <SparklesIcon className="size-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">
                      Analizando con inteligencia artificial
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doneCount} de {docs.length} documentos completados
                    </p>
                  </div>
                  <div className="w-48">
                    <Progress
                      value={(doneCount / docs.length) * 100}
                      className="h-1.5"
                    />
                  </div>
                </div>

                {/* Doc cards */}
                <div className="flex w-full gap-3">
                  {docs.map(({ key, label, Icon }) => {
                    const p = docProgress[key]
                    const isDone = p?.status === "done"
                    const isTrying = p?.status === "trying"
                    const isFailed = p?.status === "failed"
                    return (
                      <div
                        key={key}
                        className={`flex flex-col items-center gap-3 rounded-xl border p-5 text-center transition-all duration-300 ${
                          isDone
                            ? "border-green-200 bg-green-50/70 dark:border-green-800 dark:bg-green-950/30"
                            : isTrying
                              ? "border-primary/40 bg-primary/5 shadow-sm"
                              : isFailed
                                ? "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
                                : "border-border bg-muted/20"
                        }`}
                      >
                        {/* Icon with status badge */}
                        <div className="relative">
                          <div
                            className={`flex size-11 items-center justify-center rounded-xl transition-colors duration-300 ${
                              isDone
                                ? "bg-green-100 dark:bg-green-900/50"
                                : isTrying
                                  ? "bg-primary/10"
                                  : "bg-muted"
                            }`}
                          >
                            <Icon
                              className={`size-5 transition-colors duration-300 ${
                                isDone
                                  ? "text-green-600 dark:text-green-400"
                                  : isTrying
                                    ? "text-primary"
                                    : "text-muted-foreground/60"
                              }`}
                            />
                          </div>
                          <div className="absolute -right-1.5 -bottom-1.5">
                            {isDone ? (
                              <CheckCircle2Icon className="size-4.5 fill-white text-green-500 dark:fill-background" />
                            ) : isTrying ? (
                              <Loader2Icon className="size-4.5 animate-spin text-primary" />
                            ) : isFailed ? (
                              <XCircleIcon className="size-4.5 fill-white text-amber-500 dark:fill-background" />
                            ) : (
                              <CircleDashedIcon className="size-4.5 text-muted-foreground/30" />
                            )}
                          </div>
                        </div>

                        {/* Label + model */}
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                            {!p || p.status === "waiting"
                              ? "En cola…"
                              : isTrying
                                ? p.model
                                : isDone
                                  ? p.finalModel
                                  : "Sin respuesta"}
                          </p>
                        </div>

                        {/* Status pill */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                            isDone
                              ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300"
                              : isTrying
                                ? "bg-primary/10 text-primary"
                                : isFailed
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isDone
                            ? "Listo"
                            : isTrying
                              ? "Analizando"
                              : isFailed
                                ? "Sin respuesta"
                                : "En cola"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
              <AlertCircleIcon className="size-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <strong>La extracción automática no funcionó.</strong>{" "}
                {errorMessage ?? "Ocurrió un error al procesar los documentos."}{" "}
                Puedes reintentar o continuar ingresando los datos tú mismo.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={processStep}
              >
                <RefreshCwIcon className="size-4" />
                Reintentar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkipToManual}>
                Ingresar datos manualmente →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ② Datos (aparecen al terminar la extracción o en modo manual) */}
      {isReady && (
        <>
          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeader
              number={2}
              title="Revisa y completa los datos"
              subtitle="Todos los campos son editables. Haz clic sobre cualquier valor para corregirlo."
            />

            {allFailed && (
              <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  <strong>La IA no encontró datos en los documentos.</strong> No
                  te preocupes — puedes completar todos los campos a mano en los
                  formularios de abajo. Los campos están marcados en naranja
                  para que sepas cuáles necesitan tu atención.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3">
              {!allFailed && <ConfidenceLegend />}
              <PlanillaEditor
                data={planilla}
                onChange={setPlanilla}
                deadlineCalcNote={deadlineCalcNote}
                warnings={warnings.filter((w) => w.startsWith("Planilla"))}
                confidenceMap={confidence.paymentSheet}
              />
              <ARLEditor
                data={arl}
                onChange={setArl}
                warnings={warnings.filter((w) => w.startsWith("ARL"))}
                confidenceMap={confidence.arl}
              />
              <ContractEditor
                data={contract}
                title={
                  manualData?.contractCount === "2" ? "Contrato 1" : "Contrato"
                }
                onChange={setContract}
                warnings={warnings.filter((w) => w.startsWith("Contrato —"))}
                confidenceMap={confidence.contract}
              />
              {manualData?.contractCount === "2" && (
                <ContractEditor
                  data={contract2}
                  title="Contrato 2"
                  onChange={setContract2}
                  warnings={warnings.filter((w) => w.startsWith("Contrato 2"))}
                  confidenceMap={confidence.contract2}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {someFailed && !allFailed && (
              <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Algunos documentos no se pudieron leer automáticamente
                  (aparecen en naranja). Completa los campos vacíos manualmente
                  — son todos editables.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              {status !== "manual" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={processStep}
                >
                  <RefreshCwIcon className="size-4" />
                  Reintentar extracción
                </Button>
              )}
              <Button size="sm" onClick={handleConfirm}>
                Confirmar datos y continuar →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
