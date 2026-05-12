"use client"

import React from "react"
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

// ─── Field primitives ─────────────────────────────────────────────────────────

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Read-only display of an extracted field. Used for every field except contractor names. */
function ReadField({
  label,
  value,
  confidence,
}: {
  label: string
  value: string | number | null | undefined
  confidence?: ConfidenceLevel
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? String(value)
        : value
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ConfidenceDot level={confidence} />
      </div>
      <span className="w-full text-sm font-medium text-foreground/90">
        {display}
      </span>
    </div>
  )
}

function ReadMoney({
  label,
  value,
  confidence,
}: {
  label: string
  value: number
  confidence?: ConfidenceLevel
}) {
  return (
    <ReadField
      label={label}
      value={value ? COP.format(value) : ""}
      confidence={confidence}
    />
  )
}

/** Editable text input — only used for contractor names. */
export function EditField({
  label,
  value,
  onChange,
  highlight,
  placeholder,
  confidence,
}: {
  label: string
  value: string
  onChange: (v: string) => void
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
        type="text"
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

// ─── Display helpers for select-like values ───────────────────────────────────

const COVERAGE_LABEL: Record<ARLData["coverageStatus"], string> = {
  ACTIVA: "ACTIVA",
  INACTIVA: "INACTIVA",
  SUSPENDIDA: "SUSPENDIDA",
}

const RISK_LABEL: Record<RiskClass, string> = {
  I: "Riesgo 1",
  II: "Riesgo 2",
  III: "Riesgo 3",
  IV: "Riesgo 4",
  V: "Riesgo 5",
}

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  CC: "CC — Cédula de ciudadanía",
  NIT: "NIT",
  CE: "CE — Cédula extranjería",
}

function labelOf<T extends string>(
  options: { value: T; label: string }[],
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? value
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
    contractorName: "",
    documentNumber: "",
  }
  const d = data ?? empty
  const set = (patch: Partial<PaymentSheetData>) => onChange({ ...d, ...patch })
  const c = confidenceMap

  return (
    <DocSection title="Planilla PILA" failed={!data} warnings={warnings}>
      <ReadField
        label="Número de planilla"
        value={d.sheetNumber}
        confidence={c?.sheetNumber}
      />
      <ReadField
        label="Fecha de pago"
        value={d.paymentDate}
        confidence={c?.paymentDate}
      />
      <div className="flex flex-col gap-0.5">
        <ReadField
          label="Fecha límite de pago"
          value={d.paymentDeadline ?? ""}
          confidence={c?.paymentDeadline}
        />
        {deadlineCalcNote && (
          <p className="pl-1 text-[11px] text-muted-foreground">
            {deadlineCalcNote}
          </p>
        )}
      </div>
      <ReadField
        label="Período (MM/YYYY)"
        value={d.period}
        confidence={c?.period}
      />
      <ReadMoney
        label="Valor total pagado"
        value={d.totalAmountPaid}
        confidence={c?.totalAmountPaid}
      />
      <EditField
        label="Nombre cotizante (Planilla)"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: v })}
        confidence={c?.contractorName}
      />
      <ReadField
        label="Documento (Planilla)"
        value={d.documentNumber}
        confidence={c?.documentNumber}
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
      <ReadField
        label="Inicio cobertura"
        value={d.startDate}
        confidence={c?.startDate}
      />
      <ReadField
        label="Fin cobertura"
        value={d.endDate}
        confidence={c?.endDate}
      />
      <ReadField
        label="Estado cobertura"
        value={COVERAGE_LABEL[d.coverageStatus]}
        confidence={c?.coverageStatus}
      />
      <ReadField
        label="Clase de riesgo"
        value={RISK_LABEL[d.riskClass]}
        confidence={c?.riskClass}
      />
      <ReadField
        label="Tasa cotización (%)"
        value={d.cotizationRate}
        confidence={c?.cotizationRate}
      />
      <EditField
        label="Nombre afiliado (ARL)"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: v })}
        confidence={c?.contractorName}
      />
      <ReadField
        label="Documento (ARL)"
        value={d.documentNumber}
        confidence={c?.documentNumber}
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
      <ReadField
        label="Tipo de contrato"
        value={labelOf(CONTRACT_TYPE_OPTIONS, d.contractType)}
        confidence={c?.contractType}
      />
      <ReadField
        label="Número de orden"
        value={d.orderNumber}
        confidence={c?.orderNumber}
      />
      <EditField
        label="Nombre contratista"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: v })}
        confidence={c?.contractorName}
      />
      <ReadField
        label="Tipo documento"
        value={DOC_TYPE_LABEL[d.documentType]}
        confidence={c?.documentType}
      />
      <ReadField
        label="Número documento"
        value={d.documentNumber}
        confidence={c?.documentNumber}
      />
      <ReadMoney
        label="Valor total sin impuestos"
        value={d.totalValueBeforeTax}
        confidence={c?.totalValueBeforeTax}
      />
      <ReadField
        label="Fecha inicio"
        value={d.startDate}
        confidence={c?.startDate}
      />
      <ReadField
        label="Fecha fin"
        value={d.endDate}
        confidence={c?.endDate}
      />
      <ReadField
        label="Informe de actividades"
        value={
          d.activityReport.required
            ? `Sí — cada ${d.activityReport.frequencyMonths ?? "—"} mes(es)`
            : "No requerido"
        }
      />
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
        onChange={(v) => set({ contractorName: v })}
      />
      <ReadField label="C.C. No." value={d.documentNumber} />
      <ReadField label="Fecha de firma" value={d.signatureDate} />
      <ReadField label="Periodo Desde" value={d.periodFrom} />
      <ReadField label="Periodo Hasta" value={d.periodTo} />
      <ReadField label="¿Está firmado?" value={d.isSigned ? "Sí" : "No"} />

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
