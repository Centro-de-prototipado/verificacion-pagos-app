"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertCircleIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"

import { useWizardStore } from "@/lib/store"
import { getAllProfiles, saveProfile } from "@/lib/pdf/document-profiles"
import {
  calcularFechaLimite,
  diasHabilAsignados,
} from "@/lib/validations/fecha-limite"
import type {
  ARLData,
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
import { Separator } from "@/components/ui/separator"
import { SectionHeader } from "./section-header"

type ExtractionStatus =
  | "idle"
  | "loading-text"
  | "loading-ai"
  | "ready"
  | "error"

// ─── Editable field primitives ────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  type = "text",
  highlight,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: "text" | "number"
  highlight?: "green" | "red"
  placeholder?: string
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
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
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
        {failed && (
          <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
        )}
        <p
          className={`text-xs font-semibold tracking-wide uppercase ${failed ? "text-destructive" : "text-muted-foreground"}`}
        >
          {title}
          {failed && " — no se pudo extraer"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  )
}

// ─── Document editors ─────────────────────────────────────────────────────────

function PlanillaEditor({
  data,
  onChange,
  deadlineCalcNote,
}: {
  data: PaymentSheetData | null
  onChange: (d: PaymentSheetData) => void
  deadlineCalcNote?: string
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
      <div className="flex flex-col gap-0.5">
        <EditField
          label="Fecha límite de pago"
          value={d.paymentDeadline ?? ""}
          onChange={(v) => set({ paymentDeadline: v || null })}
          placeholder="No encontrada — se calculará automáticamente"
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
      />
      <MoneyField
        label="Valor total pagado"
        value={d.totalAmountPaid}
        onChange={(v) => set({ totalAmountPaid: v })}
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
      <MoneyField
        label="Valor total sin impuestos"
        value={d.totalValueBeforeTax}
        onChange={(v) => set({ totalValueBeforeTax: v })}
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
    rawText,
    setRawText,
    extractedData,
    setExtractedData,
    manualData,
    setStep,
  } = useWizardStore()

  const [status, setStatus] = useState<ExtractionStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [planilla, setPlanilla] = useState<PaymentSheetData | null>(null)
  const [arl, setArl] = useState<ARLData | null>(null)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [contract2, setContract2] = useState<ContractData | null>(null)
  const [issuerKeys, setIssuerKeys] = useState<Record<string, string>>({})
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

      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawData, profiles: savedProfiles }),
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
        issuerKeys?: Record<string, string>
      }

      const {
        warnings = [],
        issuerKeys: keys = {},
        ...extracted
      } = extractedPayload
      setExtractedData(extracted)
      setIssuerKeys(keys)
      originalExtraction.current = extracted
      setStatus("ready")

      if (warnings.length > 0) {
        toast.warning("Extracción IA con observaciones.", {
          description: warnings.join(" · "),
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

  const allFailed = status === "ready" && !planilla && !arl && !contract
  const someFailed = status === "ready" && (!planilla || !arl || !contract)

  return (
    <div className="flex flex-col gap-8">
      {/* ① Extracción */}
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
              <p className="text-sm font-medium">
                Extrayendo texto de los PDFs…
              </p>
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
                En cuanto termine, los datos aparecerán abajo para que los
                revises.
              </p>
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
              Reintentar
            </Button>
          </div>
        )}
      </div>

      {/* ② Datos extraídos (aparecen al terminar la extracción) */}
      {status === "ready" && (
        <>
          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeader
              number={2}
              title="Datos extraídos por la IA"
              subtitle="Revisa y corrige los valores si es necesario. Los campos son editables."
            />

            {allFailed ? (
              <Alert variant="destructive" className="ml-9">
                <AlertDescription>
                  La IA no pudo extraer datos de ningún documento. Reintentar el
                  proceso automático.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-3 pl-9">
                <PlanillaEditor
                  data={planilla}
                  onChange={setPlanilla}
                  deadlineCalcNote={deadlineCalcNote}
                />
                <ARLEditor data={arl} onChange={setArl} />
                <ContractEditor
                  data={contract}
                  title={
                    manualData?.contractCount === "2"
                      ? "Contrato 1"
                      : "Contrato"
                  }
                  onChange={setContract}
                />
                {manualData?.contractCount === "2" && (
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
                  Algunos documentos no se pudieron extraer (marcados en rojo).
                  Puedes editar los campos vacíos manualmente antes de
                  continuar.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                onClick={processStep}
              >
                <RefreshCwIcon className="size-4" />
                Reintentar extracción
              </Button>
              <Button
                size="sm"
                className="w-fit"
                disabled={allFailed}
                onClick={handleConfirm}
              >
                Confirmar datos y continuar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
