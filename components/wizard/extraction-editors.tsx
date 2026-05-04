"use client"

import React, { useState } from "react"
import { AlertCircleIcon } from "lucide-react"

import { CONTRACT_TYPE_OPTIONS } from "@/lib/constants/contracts"
import type {
  ARLData,
  ConfidenceLevel,
  ConfidenceMap,
  ContractData,
  ContractType,
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

// ─── Editable field primitives ────────────────────────────────────────────────

export function EditField({
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
        spellCheck={true}
        lang="es"
      />
    </div>
  )
}

export function EditSelect<T extends string>({
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

export function MoneyField({
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

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "CC — Cédula de ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "CE — Cédula extranjería" },
]

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
