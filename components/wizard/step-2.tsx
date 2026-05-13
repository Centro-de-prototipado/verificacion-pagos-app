"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  ArrowRightIcon,
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

import { cn } from "@/lib/utils"
import { useWizardStore } from "@/lib/store"
import { getAllProfiles, saveProfile } from "@/lib/pdf/document-profiles"
import {
  calcularFechaLimite,
  diasHabilAsignados,
} from "@/lib/validations/fecha-limite"
import { checkNextPeriodDeadline } from "@/lib/validations/fechas"
import type {
  ActivityReportData,
  ARLData,
  ConfidenceMap,
  ContractData,
  ExtractedData,
  PaymentSheetData,
  RawPDFText,
  WizardStep,
} from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { SectionHeader } from "./section-header"
import {
  ConfidenceLegend,
  PlanillaEditor,
  ARLEditor,
  ContractEditor,
} from "./extraction-editors"

type ExtractionStatus =
  | "idle"
  | "loading-text"
  | "loading-ai"
  | "ready"
  | "error"
  | "manual"

function validateExtractedData(
  planilla: PaymentSheetData | null,
  arl: ARLData | null,
  contract: ContractData | null,
  contract2: ContractData | null,
  contractCount: "1" | "2",
  selectedContract: "1" | "2" | "Ambos" | null
): string[] {
  const errors: string[] = []
  const isDMY = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s)
  const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  const isDate = (s: string) => isDMY(s) || isISO(s)
  const isMY = (s: string) => /^\d{2}\/\d{4}$/.test(s)

  if (!planilla) {
    errors.push("Planilla PILA: no se encontraron datos.")
  } else {
    if (!planilla.sheetNumber?.trim())
      errors.push("Planilla: número de planilla requerido.")
    if (!isDMY(planilla.paymentDate ?? ""))
      errors.push(
        `Planilla: fecha de pago inválida ("${planilla.paymentDate ?? ""}"). Usa DD/MM/YYYY.`
      )
    if (!isMY(planilla.period ?? ""))
      errors.push(
        `Planilla: período inválido ("${planilla.period ?? ""}"). Usa MM/YYYY.`
      )
    if (!planilla.totalAmountPaid || planilla.totalAmountPaid <= 0)
      errors.push("Planilla: valor total pagado debe ser mayor a cero.")
    if (!planilla.contractorName?.trim())
      errors.push("Planilla: nombre del cotizante requerido.")
    if (!planilla.documentNumber?.trim())
      errors.push("Planilla: número de documento requerido.")
  }

  if (!arl) {
    errors.push("ARL: no se encontraron datos.")
  } else {
    if (!isDate(arl.startDate ?? ""))
      errors.push(`ARL: fecha de inicio inválida ("${arl.startDate ?? ""}").`)
    if (!isDate(arl.endDate ?? ""))
      errors.push(`ARL: fecha de fin inválida ("${arl.endDate ?? ""}").`)
    if (!arl.cotizationRate || arl.cotizationRate <= 0)
      errors.push("ARL: tasa de cotización debe ser mayor a cero.")
    if (!arl.contractorName?.trim())
      errors.push("ARL: nombre del contratista requerido.")
    if (!arl.documentNumber?.trim())
      errors.push("ARL: número de documento requerido.")
  }

  if (!contract) {
    errors.push("Contrato: no se encontraron datos.")
  } else {
    if (!contract.orderNumber?.trim())
      errors.push("Contrato: número de orden requerido.")
    if (!contract.contractorName?.trim())
      errors.push("Contrato: nombre del contratista requerido.")
    if (!contract.documentNumber?.trim())
      errors.push("Contrato: número de documento requerido.")
    if (!contract.totalValueBeforeTax || contract.totalValueBeforeTax <= 0)
      errors.push("Contrato: valor total debe ser mayor a cero.")
    if (!isDate(contract.startDate ?? ""))
      errors.push(
        `Contrato: fecha de inicio inválida ("${contract.startDate ?? ""}"). Usa DD/MM/YYYY.`
      )
    if (!isDate(contract.endDate ?? ""))
      errors.push(
        `Contrato: fecha de fin inválida ("${contract.endDate ?? ""}"). Usa DD/MM/YYYY.`
      )
  }

  if (contractCount === "2") {
    // The user must explicitly select which contract they are billing in this period
    if (!selectedContract) {
      errors.push(
        "Dos contratos detectados: debes seleccionar cuál contrato vas a cobrar en este período antes de continuar."
      )
    }
    if (!contract2) {
      errors.push("Contrato 2: no se encontraron datos.")
    } else {
      if (!contract2.orderNumber?.trim())
        errors.push("Contrato 2: número de orden requerido.")
      if (!contract2.contractorName?.trim())
        errors.push("Contrato 2: nombre del contratista requerido.")
      if (!contract2.documentNumber?.trim())
        errors.push("Contrato 2: número de documento requerido.")
      if (!contract2.totalValueBeforeTax || contract2.totalValueBeforeTax <= 0)
        errors.push("Contrato 2: valor total debe ser mayor a cero.")
      if (!isDate(contract2.startDate ?? ""))
        errors.push(
          `Contrato 2: fecha de inicio inválida ("${contract2.startDate ?? ""}"). Usa DD/MM/YYYY.`
        )
      if (!isDate(contract2.endDate ?? ""))
        errors.push(
          `Contrato 2: fecha de fin inválida ("${contract2.endDate ?? ""}"). Usa DD/MM/YYYY.`
        )
    }
  }

  return errors
}

export function Step2() {
  const {
    documents,
    extractedData,
    setExtractedData,
    setRawText,
    manualData,
    setManualData,
    setStep,
  } = useWizardStore()

  const [status, setStatus] = useState<ExtractionStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<string[]>([])

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
  const [activityReport, setActivityReport] = useState<ActivityReportData | null>(null)
  const [issuerKeys, setIssuerKeys] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [confidence, setConfidence] = useState<Record<string, ConfidenceMap>>(
    {}
  )
  // Which contract is being billed this period (only relevant when contractCount === "2")
  const [selectedContract, setSelectedContract] = useState<
    "1" | "2" | "Ambos" | null
  >(manualData?.involvedContracts ?? null)
  const abortRef = useRef<AbortController | null>(null)

  // Check if today is at/past the payment deadline for the next period.
  // Used to show a preventive alert BEFORE step-3 so signers can act fast.
  const nextPeriodCheck = useMemo(() => {
    if (!planilla?.period || !contract?.documentNumber) return null
    try {
      return checkNextPeriodDeadline(planilla.period, contract.documentNumber)
    } catch {
      return null
    }
  }, [planilla?.period, contract?.documentNumber])

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

  const planillaConfidence = useMemo(() => {
    const base = confidence.paymentSheet
      ? { ...confidence.paymentSheet }
      : undefined
    if (!base) return base
    if (
      planilla?.paymentDeadline &&
      planilla?.period &&
      contract?.documentNumber
    ) {
      base.paymentDeadline = "high"
    }
    return base
  }, [
    confidence.paymentSheet,
    planilla?.paymentDeadline,
    planilla?.period,
    contract?.documentNumber,
  ])

  // startDate and endDate in contracts are always overridden with ARL dates,
  // so inherit ARL confidence for those two fields instead of showing contract extraction confidence.
  const contractConfidence = useMemo(() => {
    const base = confidence.contract ? { ...confidence.contract } : undefined
    if (!base) return base
    if (arl) {
      base.startDate = confidence.arl?.startDate ?? "medium"
      base.endDate = confidence.arl?.endDate ?? "medium"
    }
    return base
  }, [confidence.contract, confidence.arl, arl])

  const contract2Confidence = useMemo(() => {
    const base = confidence.contract2 ? { ...confidence.contract2 } : undefined
    if (!base) return base
    if (arl) {
      base.startDate = confidence.arl?.startDate ?? "medium"
      base.endDate = confidence.arl?.endDate ?? "medium"
    }
    return base
  }, [confidence.contract2, confidence.arl, arl])

  // Populate editors when extractedData changes (initial load or coming back from a later step)
  useEffect(() => {
    if (!extractedData) return
    const ps = extractedData.paymentSheet
    const ct = extractedData.contract

    let paymentDate = ps?.paymentDate ?? ""
    let deadline = ps?.paymentDeadline ?? null

    if (ps?.period && ct?.documentNumber) {
      try {
        const calculated = calcularFechaLimite(ps.period, ct.documentNumber)
        // If the AI reversed paymentDate and deadline, swap them back
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
    const arlToDMY = (iso: string) => {
      const [y, m, d] = iso.split("-")
      return `${d}/${m}/${y}`
    }
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
    setActivityReport(extractedData.activityReport ?? null)
  }, [extractedData])

  const buildFormData = useCallback(() => {
    const formData = new FormData()
    if (documents.paymentSheet)
      formData.append("paymentSheet", documents.paymentSheet)
    if (documents.arl) formData.append("arl", documents.arl)
    if (documents.contract) formData.append("contract", documents.contract)
    if (documents.contract2) formData.append("contract2", documents.contract2)
    if (documents.activityReport)
      formData.append("activityReport", documents.activityReport)
    return formData
  }, [documents])

  const processStep = useCallback(async () => {
    const controller = new AbortController()
    abortRef.current = controller

    setStatus("loading-text")
    setErrorMessage(null)
    setDocProgress({})

    try {
      // Step 1: extract raw text from PDFs
      const textRes = await fetch("/api/extract-text", {
        method: "POST",
        body: buildFormData(),
        signal: controller.signal,
      })
      if (!textRes.ok) {
        const payload = (await textRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(
          payload.error ?? `Error del servidor: ${textRes.status}`
        )
      }
      const rawData = (await textRes.json()) as RawPDFText
      setRawText(rawData)

      // Block scanned / image-only PDFs before calling the AI.
      // A PDF with < 150 chars almost certainly has no embedded text layer.
      const SCAN_THRESHOLD = 150
      const scannedDocs: string[] = []
      if (
        documents.paymentSheet &&
        (rawData.paymentSheet?.trim().length ?? 0) < SCAN_THRESHOLD
      )
        scannedDocs.push("Planilla de Seguridad Social")
      if (documents.arl && (rawData.arl?.trim().length ?? 0) < SCAN_THRESHOLD)
        scannedDocs.push("Certificado ARL")
      if (
        documents.contract &&
        (rawData.contract?.trim().length ?? 0) < SCAN_THRESHOLD
      )
        scannedDocs.push("Contrato")
      if (
        documents.contract2 &&
        (rawData.contract2?.trim().length ?? 0) < SCAN_THRESHOLD
      )
        scannedDocs.push("Contrato 2")

      if (scannedDocs.length > 0) {
        throw new Error(
          `Los siguientes documentos no tienen texto extraíble (PDF escaneado o imagen): ${scannedDocs.join(", ")}. ` +
            "Descarga la versión digital desde el portal de tu operadora o entidad y vuelve a intentarlo."
        )
      }

      // Step 2: AI structured extraction
      setStatus("loading-ai")
      const savedProfiles = getAllProfiles()
      const aiRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawData,
          profiles: savedProfiles,
          paymentRequestPeriod: manualData?.paymentRequestPeriod,
          contractCount: manualData?.contractCount,
          involvedContracts: manualData?.involvedContracts,
        }),
        signal: controller.signal,
      })

      if (!aiRes.ok || !aiRes.body) {
        const payload = (await aiRes.json().catch(() => ({}))) as {
          error?: string
          details?: string
        }
        throw new Error(
          payload.details ??
            payload.error ??
            `Error del servidor: ${aiRes.status}`
        )
      }

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

      while (true) {
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
            updateDoc(event.doc, { status: "trying" })
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
      setStatus("ready")

      if (warnings.length > 0) {
        toast.warning(`${warnings.length} observación(es) en la extracción.`, {
          description: "Revisa los campos marcados abajo.",
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("manual")
        return
      }
      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido al procesar los PDFs."
      setErrorMessage(message)
      setStatus("error")
      toast.error("No se pudo completar la extracción.", {
        description: message,
      })
    } finally {
      abortRef.current = null
    }
  }, [buildFormData, setExtractedData, setRawText])

  useEffect(() => {
    // If extractedData already exists the user is coming back from a later step —
    // restore the editors without re-running the AI extraction.
    if (extractedData) {
      setStatus("ready")
      return
    }
    processStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = () => {
    const errors = validateExtractedData(
      planilla,
      arl,
      contract,
      contract2,
      manualData?.contractCount ?? "1",
      selectedContract
    )
    if (errors.length > 0) {
      setConfirmErrors(errors)
      return
    }
    setConfirmErrors([])

    // Persist the selected contract to manualData so downstream steps can use it
    if (
      manualData &&
      manualData.contractCount === "2" &&
      selectedContract &&
      selectedContract !== manualData.involvedContracts
    ) {
      setManualData({ ...manualData, involvedContracts: selectedContract })
    }

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

    setExtractedData({
      paymentSheet: planilla,
      arl,
      contract,
      contract2,
      activityReport,
    })
    setStep(3 as WizardStep)
  }

  const isReady = status === "ready" || status === "manual"
  const allFailed = isReady && !planilla && !arl && !contract
  const someFailed = isReady && (!planilla || !arl || !contract)

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleSkipToManual = () => {
    setStatus("manual")
    setErrorMessage(null)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ① Extracción */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <SectionHeader
            number={1}
            title="Procesamiento automático de documentos"
            subtitle="El sistema extrae el texto de los PDFs y los analiza con inteligencia artificial."
            done={isReady}
          />
          {isReady && status !== "manual" && (
            <Button
              variant="outline"
              size="lg"
              className="shrink-0 gap-1.5"
              onClick={processStep}
            >
              <RefreshCwIcon className="size-3.5" />
              Reintentar
            </Button>
          )}
        </div>

        {(status === "loading-text" || status === "loading-ai") &&
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
              ...(documents.activityReport
                ? [
                    {
                      key: "activityReport",
                      label: "Informe de Actividades",
                      Icon: ScrollTextIcon,
                    },
                  ]
                : []),
            ] as { key: string; label: string; Icon: React.ElementType }[]
            const doneCount = docs.filter(
              (d) => docProgress[d.key]?.status === "done"
            ).length
            return (
              <div className="flex flex-col gap-5 rounded-2xl border border-dashed px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <SparklesIcon className="size-6 animate-pulse text-primary" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {status === "loading-text"
                          ? "Extrayendo texto de PDFs…"
                          : "Analizando documentos…"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {doneCount}/{docs.length}
                      </span>
                    </div>
                    <Progress
                      value={(doneCount / docs.length) * 100}
                      className="h-1.5"
                    />
                  </div>
                </div>

                {/* Doc list */}
                <div className="flex flex-col gap-2">
                  {docs.map(({ key, label, Icon }) => {
                    const p = docProgress[key]
                    const isDone = p?.status === "done"
                    const isTrying = p?.status === "trying"
                    const isFailed = p?.status === "failed"
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300",
                          isDone &&
                            "border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-950/20",
                          isTrying &&
                            "border-primary/40 bg-primary/5 shadow-sm",
                          isFailed &&
                            "border-amber-200 bg-amber-50/60 dark:border-amber-800",
                          !isDone &&
                            !isTrying &&
                            !isFailed &&
                            "border-border bg-muted/20"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors duration-300",
                            isDone
                              ? "text-green-600 dark:text-green-400"
                              : isTrying
                                ? "text-primary"
                                : "text-muted-foreground/40"
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm font-medium">{label}</span>
                          {(isTrying || isDone || isFailed) && (
                            <span className="truncate text-[11px] text-muted-foreground">
                              {isTrying
                                ? p?.model
                                : isDone
                                  ? p?.finalModel
                                  : p?.model}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isDone ? (
                            <CheckCircle2Icon className="size-4 text-green-500" />
                          ) : isTrying ? (
                            <Loader2Icon className="size-4 animate-spin text-primary" />
                          ) : isFailed ? (
                            <XCircleIcon className="size-4 text-amber-500" />
                          ) : (
                            <CircleDashedIcon className="size-4 text-muted-foreground/30" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isDone
                                ? "text-green-600 dark:text-green-400"
                                : isTrying
                                  ? "text-primary"
                                  : isFailed
                                    ? "text-amber-600"
                                    : "text-muted-foreground/50"
                            )}
                          >
                            {isDone
                              ? "Listo"
                              : isTrying
                                ? "Analizando"
                                : isFailed
                                  ? "Falló"
                                  : "En cola"}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Cancel button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2 self-center text-muted-foreground"
                  onClick={handleCancel}
                >
                  <XCircleIcon className="size-4" />
                  Cancelar e ingresar manualmente
                </Button>
              </div>
            )
          })()}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
              <AlertCircleIcon className="size-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <strong>La extracción no funcionó.</strong>{" "}
                {errorMessage ?? "Ocurrió un error al procesar los documentos."}
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
                Ingresar manualmente
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
              title="Revisa los datos extraídos"
              subtitle="Verifica que la información extraída sea correcta. Solo el campo de nombre es editable."
            />

            {allFailed && (
              <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  <strong>La IA no encontró datos en los documentos.</strong>{" "}
                  Revisa que los archivos subidos sean los correctos y vuelve a
                  intentarlo. Si el problema persiste, contacta soporte.
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
                confidenceMap={planillaConfidence}
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
                confidenceMap={contractConfidence}
              />
              {manualData?.contractCount === "2" && (
                <>
                  <ContractEditor
                    data={contract2}
                    title="Contrato 2"
                    onChange={setContract2}
                    warnings={warnings.filter((w) =>
                      w.startsWith("Contrato 2")
                    )}
                    confidenceMap={contract2Confidence}
                  />
                  {/* Contract selection required when billing period has 2 contracts */}
                  <div className="flex flex-col gap-2 rounded-xl border px-4 py-4 bg-muted/20">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      ¿Cuál contrato vas a cobrar este período?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["1", "2", "Ambos"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedContract(opt)}
                          className={cn(
                            "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                            selectedContract === opt
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted"
                          )}
                        >
                          {opt === "1"
                            ? "Contrato 1"
                            : opt === "2"
                              ? "Contrato 2"
                              : "Ambos contratos"}
                        </button>
                      ))}
                    </div>
                    {!selectedContract && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Debes seleccionar una opción para continuar.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {someFailed && !allFailed && (
              <Alert className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Algunos documentos no se pudieron leer automáticamente
                  (aparecen en naranja). Verifica que subiste los archivos
                  correctos y vuelve a intentar la extracción.
                </AlertDescription>
              </Alert>
            )}
            {/* Preventive deadline alert — shown when approaching or past next-period deadline */}
            {nextPeriodCheck &&
              nextPeriodCheck.alertLevel !== "none" &&
              (() => {
                const { nextPeriod, nextDeadline, daysUntilDeadline, alertLevel } =
                  nextPeriodCheck
                if (alertLevel === "overdue") {
                  return (
                    <Alert className="border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-950/30">
                      <AlertCircleIcon className="size-4 text-red-600" />
                      <AlertDescription className="text-red-800 dark:text-red-300">
                        <strong>Se requiere planilla adicional.</strong> La fecha
                        límite para pagar la planilla de{" "}
                        <strong>{nextPeriod}</strong> venció el{" "}
                        <strong>{nextDeadline}</strong> (hace{" "}
                        {Math.abs(daysUntilDeadline)} días). En el siguiente
                        paso deberás adjuntarla obligatoriamente.
                      </AlertDescription>
                    </Alert>
                  )
                }
                const isUrgent = alertLevel === "urgent"
                return (
                  <Alert
                    className={
                      isUrgent
                        ? "border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-950/30"
                        : "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
                    }
                  >
                    <AlertCircleIcon
                      className={`size-4 ${isUrgent ? "text-red-600" : "text-amber-600"}`}
                    />
                    <AlertDescription
                      className={
                        isUrgent
                          ? "text-red-800 dark:text-red-300"
                          : "text-amber-800 dark:text-amber-300"
                      }
                    >
                      <strong>
                        {isUrgent ? "¡Atención urgente!" : "Aviso preventivo."}
                      </strong>{" "}
                      La fecha límite para pagar la planilla de{" "}
                      <strong>{nextPeriod}</strong> vence el{" "}
                      <strong>{nextDeadline}</strong> (en{" "}
                      {daysUntilDeadline} día
                      {daysUntilDeadline !== 1 ? "s" : ""}). Si el proceso de
                      firmas no concluye antes de esa fecha, deberás adjuntar
                      esa planilla también y el trámite será devuelto.{" "}
                      <strong>Agiliza las firmas con tu supervisor.</strong>
                    </AlertDescription>
                  </Alert>
                )
              })()}
            {confirmErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertDescription>
                  <p className="mb-1 font-semibold">
                    Corrige los siguientes campos antes de continuar:
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {confirmErrors.map((e, i) => (
                      <li key={i} className="text-sm">
                        {e}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Button
              size="lg"
              className="w-full text-base"
              onClick={handleConfirm}
            >
              Confirmar y continuar
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
