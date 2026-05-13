"use client"

import React, { useEffect, useState } from "react"
import { AlertCircleIcon } from "lucide-react"

import { CONTRACT_TYPE_OPTIONS } from "@/lib/constants/contracts"
import type {
  ActivityReportData,
  ARLData,
  ConfidenceLevel,
  ConfidenceMap,
  ContractData,
  DocumentType,
  PaymentSheetData,
  RiskClass,
} from "@/lib/types"

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

export function ConfidenceDot({ level }: { level?: ConfidenceLevel }) {
  if (!level) return null
  const { cls, title } = CONFIDENCE_CONFIG[level]
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${cls}`}
      title={title}
    />
  )
}

export function ConfidenceLegend() {
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

// ─── Format helpers ───────────────────────────────────────────────────────────

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Normalize a date string to DD/MM/YYYY. Accepts DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, DD-MM-YYYY. */
function formatDate(input: string): string {
  const t = input.trim()
  if (!t) return ""
  const iso = t.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (iso)
    return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`
  const dmy = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy)
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`
  return t
}

/** Normalize a period to MM/YYYY. Accepts MM/YYYY, M/YYYY, YYYY-MM, YYYY/MM. */
function formatPeriod(input: string): string {
  const t = input.trim()
  if (!t) return ""
  const my = t.match(/^(\d{1,2})[/\-](\d{4})$/)
  if (my) return `${my[1].padStart(2, "0")}/${my[2]}`
  const ym = t.match(/^(\d{4})[/\-](\d{1,2})$/)
  if (ym) return `${ym[2].padStart(2, "0")}/${ym[1]}`
  return t
}

function formatUppercase(input: string): string {
  return input.trim().toUpperCase()
}

function digitsOnly(input: string): string {
  return input.replace(/\D/g, "")
}

function parseAmount(input: string): number {
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : Math.round(n)
}

// ─── Editable field primitives ────────────────────────────────────────────────

type FieldFormat =
  | "text"
  | "date"
  | "period"
  | "uppercase"
  | "digits"
  | "money"
  | "rate"

interface EditFieldProps {
  label: string
  value: string | number | null | undefined
  onChange: (v: string | number) => void
  confidence?: ConfidenceLevel
  format?: FieldFormat
  placeholder?: string
}

/** Universal editable field with optional auto-format on blur. */
export function EditField({
  label,
  value,
  onChange,
  confidence,
  format = "text",
  placeholder,
}: EditFieldProps) {
  const initial =
    value === null || value === undefined
      ? ""
      : format === "money"
        ? value
          ? COP.format(value as number)
          : ""
        : String(value)
  const [text, setText] = useState(initial)

  useEffect(() => {
    setText(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (v: string) => {
    if (format === "digits") setText(digitsOnly(v))
    else if (format === "money")
      setText(v) // allow free typing, format on blur
    else setText(v)
  }

  const handleBlur = () => {
    let next = text
    if (format === "date") next = formatDate(text)
    else if (format === "period") next = formatPeriod(text)
    else if (format === "uppercase") next = formatUppercase(text)
    else if (format === "digits") next = digitsOnly(text)
    else if (format === "money") {
      const n = parseAmount(text)
      next = n ? COP.format(n) : ""
      setText(next)
      onChange(n)
      return
    } else if (format === "rate") {
      const n = parseFloat(text.replace(",", "."))
      next = isNaN(n) ? "" : String(n)
      setText(next)
      onChange(isNaN(n) ? 0 : n)
      return
    } else next = text.trim()

    setText(next)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2 focus-within:border-primary/60">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ConfidenceDot level={confidence} />
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
        spellCheck={format === "text" || format === "uppercase"}
        lang="es"
        inputMode={
          format === "digits" || format === "money"
            ? "numeric"
            : format === "rate"
              ? "decimal"
              : undefined
        }
      />
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  confidence?: ConfidenceLevel
}

/** Editable dropdown for enum values. */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  confidence,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2 focus-within:border-primary/60">
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

export function DocSection({
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
            No se pudo extraer — re-sube el documento.
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

// ─── Enum option lists ────────────────────────────────────────────────────────

const COVERAGE_OPTIONS: { value: ARLData["coverageStatus"]; label: string }[] =
  [
    { value: "ACTIVA", label: "ACTIVA" },
    { value: "INACTIVA", label: "INACTIVA" },
    { value: "SUSPENDIDA", label: "SUSPENDIDA" },
  ]

const RISK_OPTIONS: { value: RiskClass; label: string }[] = [
  { value: "I", label: "I — Riesgo 1" },
  { value: "II", label: "II — Riesgo 2" },
  { value: "III", label: "III — Riesgo 3" },
  { value: "IV", label: "IV — Riesgo 4" },
  { value: "V", label: "V — Riesgo 5" },
]

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "CC — Cédula de ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "CE — Cédula extranjería" },
]

// ─── Document editors ─────────────────────────────────────────────────────────

export function PlanillaEditor({
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
    contractorName: "",
    documentNumber: "",
  }
  const d = data ?? empty
  const set = (patch: Partial<PaymentSheetData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title="Planilla PILA" failed={!data} warnings={warnings}>
      <EditField
        label="Número de planilla"
        value={d.sheetNumber}
        onChange={(v) => set({ sheetNumber: String(v) })}
        confidence={c?.sheetNumber}
        format="digits"
      />
      <EditField
        label="Fecha de pago"
        value={d.paymentDate}
        onChange={(v) => set({ paymentDate: String(v) })}
        confidence={c?.paymentDate}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <div className="flex flex-col gap-0.5">
        <EditField
          label="Fecha límite de pago"
          value={d.paymentDeadline ?? ""}
          onChange={(v) => set({ paymentDeadline: String(v) || null })}
          confidence={c?.paymentDeadline}
          format="date"
          placeholder="DD/MM/YYYY"
        />
      </div>
      <EditField
        label="Período (MM/YYYY)"
        value={d.period}
        onChange={(v) => set({ period: String(v) })}
        confidence={c?.period}
        format="period"
        placeholder="MM/YYYY"
      />
      <EditField
        label="Valor total pagado"
        value={d.totalAmountPaid}
        onChange={(v) => set({ totalAmountPaid: Number(v) })}
        confidence={c?.totalAmountPaid}
        format="money"
      />
      <EditField
        label="Nombre cotizante (Planilla)"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: String(v) })}
        confidence={c?.contractorName}
        format="uppercase"
      />
      <EditField
        label="Documento (Planilla)"
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: String(v) })}
        confidence={c?.documentNumber}
        format="digits"
      />
    </DocSection>
  )
}

export function ARLEditor({
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
    contractorName: "",
    documentNumber: "",
  }
  const d = data ?? empty
  const set = (patch: Partial<ARLData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title="Certificado ARL" failed={!data} warnings={warnings}>
      <EditField
        label="Inicio cobertura"
        value={d.startDate}
        onChange={(v) => set({ startDate: String(v) })}
        confidence={c?.startDate}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <EditField
        label="Fin cobertura"
        value={d.endDate}
        onChange={(v) => set({ endDate: String(v) })}
        confidence={c?.endDate}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <SelectField
        label="Estado cobertura"
        value={d.coverageStatus}
        onChange={(v) => set({ coverageStatus: v })}
        options={COVERAGE_OPTIONS}
        confidence={c?.coverageStatus}
      />
      <SelectField
        label="Clase de riesgo"
        value={d.riskClass}
        onChange={(v) => set({ riskClass: v })}
        options={RISK_OPTIONS}
        confidence={c?.riskClass}
      />
      <EditField
        label="Tasa cotización (%)"
        value={d.cotizationRate}
        onChange={(v) => set({ cotizationRate: Number(v) })}
        confidence={c?.cotizationRate}
        format="rate"
      />
      <EditField
        label="Nombre afiliado (ARL)"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: String(v) })}
        confidence={c?.contractorName}
        format="uppercase"
      />
      <EditField
        label="Documento (ARL)"
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: String(v) })}
        confidence={c?.documentNumber}
        format="digits"
      />
    </DocSection>
  )
}

export function ContractEditor({
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
    specificObligations: [],
  }
  const d = data ?? empty
  const set = (patch: Partial<ContractData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title={title} failed={!data} warnings={warnings}>
      <SelectField
        label="Tipo de contrato"
        value={d.contractType}
        onChange={(v) => set({ contractType: v })}
        options={CONTRACT_TYPE_OPTIONS}
        confidence={c?.contractType}
      />
      <EditField
        label="Número de orden"
        value={d.orderNumber}
        onChange={(v) => set({ orderNumber: String(v) })}
        confidence={c?.orderNumber}
        format="digits"
      />
      <EditField
        label="Nombre contratista"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: String(v) })}
        confidence={c?.contractorName}
        format="uppercase"
      />
      <SelectField
        label="Tipo documento"
        value={d.documentType}
        onChange={(v) => set({ documentType: v })}
        options={DOC_TYPE_OPTIONS}
        confidence={c?.documentType}
      />
      <EditField
        label="Número documento"
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: String(v) })}
        confidence={c?.documentNumber}
        format="digits"
      />
      <EditField
        label="Valor total sin impuestos"
        value={d.totalValueBeforeTax}
        onChange={(v) => set({ totalValueBeforeTax: Number(v) })}
        confidence={c?.totalValueBeforeTax}
        format="money"
      />
      <EditField
        label="Fecha inicio"
        value={d.startDate}
        onChange={(v) => set({ startDate: String(v) })}
        confidence={c?.startDate}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <EditField
        label="Fecha fin"
        value={d.endDate}
        onChange={(v) => set({ endDate: String(v) })}
        confidence={c?.endDate}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Informe de actividades
        </span>
        <span className="text-sm font-medium">
          {d.activityReport.required
            ? `Sí — cada ${d.activityReport.frequencyMonths ?? "—"} mes(es)`
            : "No requerido"}
        </span>
      </div>
    </DocSection>
  )
}

export function ActivityReportEditor({
  data,
  onChange,
  warnings,
}: {
  data: ActivityReportData | null
  onChange: (d: ActivityReportData) => void
  warnings?: string[]
}) {
  const empty: ActivityReportData = {
    items: [],
    signatureDate: "",
    periodFrom: "",
    periodTo: "",
    opsStartDate: "",
    opsEndDate: "",
    contractorName: "",
    documentNumber: "",
    isSigned: false,
  }
  const d = data ?? empty
  const set = (patch: Partial<ActivityReportData>) =>
    onChange({ ...d, ...patch })

  return (
    <DocSection
      title="Informe de actividades"
      failed={!data}
      warnings={warnings}
    >
      <EditField
        label="Nombre contratista"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: String(v) })}
        format="uppercase"
      />
      <EditField
        label="C.C. No."
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: String(v) })}
        format="digits"
      />
      <EditField
        label="Fecha de firma"
        value={d.signatureDate}
        onChange={(v) => set({ signatureDate: String(v) })}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <EditField
        label="Periodo Desde"
        value={d.periodFrom}
        onChange={(v) => set({ periodFrom: String(v) })}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <EditField
        label="Periodo Hasta"
        value={d.periodTo}
        onChange={(v) => set({ periodTo: String(v) })}
        format="date"
        placeholder="DD/MM/YYYY"
      />
      <SelectField
        label="¿Está firmado?"
        value={d.isSigned ? "Sí" : "No"}
        onChange={(v) => set({ isSigned: v === "Sí" })}
        options={[
          { value: "Sí", label: "Sí" },
          { value: "No", label: "No" },
        ]}
      />

      <div className="col-span-2 mt-2 flex flex-col gap-2 sm:col-span-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Actividades / Obligaciones extraídas
        </p>
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
          {d.items.length > 0 ? (
            <div className="flex flex-col gap-2">
              {d.items.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 border-b pb-2 last:border-0"
                >
                  <p className="text-[11px] font-medium whitespace-pre-wrap">
                    {item.activityDescription}
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground">
                      Periodo:{" "}
                      <span className="font-bold text-foreground">
                        {item.periodPercentage}%
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Acumulado:{" "}
                      <span className="font-bold text-foreground">
                        {item.accumulatedPercentage}%
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No se extrajeron actividades.
            </p>
          )}
        </div>
      </div>
    </DocSection>
  )
}
