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
        ({ docType, issuer, example }) => ({ docType, issuer, example })
      )

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
