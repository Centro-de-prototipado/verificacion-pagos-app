"use client"

import { useState } from "react"
import { AlertCircleIcon } from "lucide-react"

import { useWizardStore } from "@/lib/store"
import type {
  ARLData,
  ContractData,
  ContractType,
  DocumentType,
  PaymentSheetData,
  RiskClass,
  WizardStep,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionHeader } from "./section-header"

// ─── Editable field primitives ────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  type = "text",
  highlight,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: "text" | "number"
  highlight?: "green" | "red"
}) {
  const color =
    highlight === "green"
      ? "text-green-600"
      : highlight === "red"
        ? "text-destructive"
        : ""

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
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

function DocSection({
  title,
  failed,
  children,
}: {
  title: string
  failed?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-4 ${failed ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"}`}
    >
      <div className="flex items-center gap-2">
        {failed && <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />}
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${failed ? "text-destructive" : "text-muted-foreground"}`}
        >
          {title}
          {failed && " — no se pudo extraer"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  )
}

// ─── Planilla editable ────────────────────────────────────────────────────────

function PlanillaEditor({
  data,
  onChange,
}: {
  data: PaymentSheetData | null
  onChange: (d: PaymentSheetData) => void
}) {
  const empty: PaymentSheetData = {
    sheetNumber: "",
    paymentDate: "",
    paymentDeadline: "",
    period: "",
    totalAmountPaid: 0,
  }
  const d = data ?? empty
  const set = (patch: Partial<PaymentSheetData>) => onChange({ ...d, ...patch })

  return (
    <DocSection title="Planilla PILA" failed={!data}>
      <EditField
        label="Número de planilla"
        value={d.sheetNumber}
        onChange={(v) => set({ sheetNumber: v })}
      />
      <EditField
        label="Fecha de pago"
        value={d.paymentDate}
        onChange={(v) => set({ paymentDate: v })}
      />
      <EditField
        label="Fecha límite de pago"
        value={d.paymentDeadline}
        onChange={(v) => set({ paymentDeadline: v })}
      />
      <EditField
        label="Período (MM/YYYY)"
        value={d.period}
        onChange={(v) => set({ period: v })}
      />
      <EditField
        label="Valor total pagado"
        type="number"
        value={String(d.totalAmountPaid)}
        onChange={(v) => set({ totalAmountPaid: Number(v) || 0 })}
      />
    </DocSection>
  )
}

// ─── ARL editable ─────────────────────────────────────────────────────────────

const COVERAGE_OPTIONS: { value: ARLData["coverageStatus"]; label: string }[] = [
  { value: "ACTIVA", label: "ACTIVA" },
  { value: "INACTIVA", label: "INACTIVA" },
  { value: "SUSPENDIDA", label: "SUSPENDIDA" },
]

const RISK_OPTIONS: { value: RiskClass; label: string }[] = [
  { value: "I", label: "Riesgo I" },
  { value: "II", label: "Riesgo II" },
  { value: "III", label: "Riesgo III" },
  { value: "IV", label: "Riesgo IV" },
  { value: "V", label: "Riesgo V" },
]

function ARLEditor({
  data,
  onChange,
}: {
  data: ARLData | null
  onChange: (d: ARLData) => void
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

  return (
    <DocSection title="Certificado ARL" failed={!data}>
      <EditField
        label="Inicio cobertura"
        value={d.startDate}
        onChange={(v) => set({ startDate: v })}
      />
      <EditField
        label="Fin cobertura"
        value={d.endDate}
        onChange={(v) => set({ endDate: v })}
      />
      <EditSelect
        label="Estado cobertura"
        value={d.coverageStatus}
        onChange={(v) => set({ coverageStatus: v })}
        options={COVERAGE_OPTIONS}
      />
      <EditSelect
        label="Clase de riesgo"
        value={d.riskClass}
        onChange={(v) => set({ riskClass: v as RiskClass })}
        options={RISK_OPTIONS}
      />
      <EditField
        label="Tasa cotización (%)"
        type="number"
        value={String(d.cotizationRate)}
        onChange={(v) => set({ cotizationRate: Number(v) || 0 })}
      />
    </DocSection>
  )
}

// ─── Contrato editable ────────────────────────────────────────────────────────

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  "OSE", "OPS", "OCE", "OFS", "OCO", "ODS", "ODO", "OCU",
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
}: {
  data: ContractData | null
  title: string
  onChange: (d: ContractData) => void
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

  return (
    <DocSection title={title} failed={!data}>
      <EditSelect
        label="Tipo de contrato"
        value={d.contractType}
        onChange={(v) => set({ contractType: v as ContractType })}
        options={CONTRACT_TYPE_OPTIONS}
      />
      <EditField
        label="Número de orden"
        value={d.orderNumber}
        onChange={(v) => set({ orderNumber: v })}
      />
      <EditField
        label="Nombre contratista"
        value={d.contractorName}
        onChange={(v) => set({ contractorName: v })}
      />
      <EditSelect
        label="Tipo documento"
        value={d.documentType}
        onChange={(v) => set({ documentType: v as DocumentType })}
        options={DOC_TYPE_OPTIONS}
      />
      <EditField
        label="Número documento"
        value={d.documentNumber}
        onChange={(v) => set({ documentNumber: v })}
      />
      <EditField
        label="Valor total sin impuestos"
        type="number"
        value={String(d.totalValueBeforeTax)}
        onChange={(v) => set({ totalValueBeforeTax: Number(v) || 0 })}
      />
      <EditField
        label="Fecha inicio"
        value={d.startDate}
        onChange={(v) => set({ startDate: v })}
      />
      <EditField
        label="Fecha fin"
        value={d.endDate}
        onChange={(v) => set({ endDate: v })}
      />
      <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
        <span className="text-xs text-muted-foreground">Informe de actividades</span>
        <div className="flex items-center gap-2">
          <select
            value={d.activityReport.required ? "si" : "no"}
            onChange={(e) =>
              set({
                activityReport: {
                  required: e.target.value === "si",
                  frequencyMonths:
                    e.target.value === "si" ? (d.activityReport.frequencyMonths ?? 3) : null,
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

export function Step3() {
  const { extractedData, manualData, setExtractedData, setStep } = useWizardStore()

  // Local editable copies — initialized once from store
  const [planilla, setPlanilla] = useState<PaymentSheetData | null>(
    extractedData?.paymentSheet ?? null
  )
  const [arl, setArl] = useState<ARLData | null>(extractedData?.arl ?? null)
  const [contract, setContract] = useState<ContractData | null>(
    extractedData?.contract ?? null
  )
  const [contract2, setContract2] = useState<ContractData | null>(
    extractedData?.contract2 ?? null
  )

  if (!extractedData || !manualData) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No hay datos extraídos. Regresa al paso anterior y vuelve a intentarlo.
        </AlertDescription>
      </Alert>
    )
  }

  const allFailed = !planilla && !arl && !contract
  const someFailed = !planilla || !arl || !contract

  const handleConfirm = () => {
    setExtractedData({
      paymentSheet: planilla,
      arl,
      contract,
      contract2,
    })
    setStep(4 as WizardStep)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SectionHeader
          number={1}
          title="Datos extraídos por la IA"
          subtitle="Revisa y corrige los valores si es necesario. Los campos son editables."
        />

        {allFailed ? (
          <Alert variant="destructive" className="ml-9">
            <AlertDescription>
              La IA no pudo extraer datos de ningún documento. Regresa al paso anterior y reintenta.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-3 pl-9">
            <PlanillaEditor data={planilla} onChange={setPlanilla} />
            <ARLEditor data={arl} onChange={setArl} />
            <ContractEditor
              data={contract}
              title={manualData.contractCount === "2" ? "Contrato 1" : "Contrato"}
              onChange={setContract}
            />
            {manualData.contractCount === "2" && (
              <ContractEditor
                data={contract2}
                title="Contrato 2"
                onChange={setContract2}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {someFailed && !allFailed && (
          <Alert className="ml-9">
            <AlertDescription>
              Algunos documentos no se pudieron extraer (marcados en rojo). Puedes editar los campos vacíos manualmente antes de continuar.
            </AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          ¿Los datos son correctos? Puedes editarlos directamente antes de confirmar.
        </p>
        <Button className="w-fit" disabled={allFailed} onClick={handleConfirm}>
          Confirmar datos y continuar
        </Button>
      </div>
    </div>
  )
}
