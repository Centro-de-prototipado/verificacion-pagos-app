"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ManualFormSchema,
  type ManualFormInput,
} from "@/lib/schemas/manual-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useWizardStore } from "@/lib/store"
import type { UploadedDocuments } from "@/lib/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

const COP = new Intl.NumberFormat("es-CO")

/** Input that displays COP-formatted number while storing a plain number. */
function CurrencyInput({
  value,
  onChange,
  onBlur,
  id,
  "aria-invalid": ariaInvalid,
}: {
  value: number | string
  onChange: (n: number | string) => void
  onBlur?: () => void
  id?: string
  "aria-invalid"?: boolean
}) {
  const [display, setDisplay] = useState(() =>
    value ? COP.format(Number(value)) : ""
  )
  const prevValue = useRef(value)

  useEffect(() => {
    if (value !== prevValue.current && value && !isNaN(Number(value))) {
      setDisplay(COP.format(Number(value)))
    }
    prevValue.current = value
  }, [value])

  return (
    <Input
      id={id}
      value={`$ ${display}`}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "")
        setDisplay(raw ? COP.format(Number(raw)) : "")
        onChange(raw ? Number(raw) : ("" as unknown as number))
      }}
      onBlur={onBlur}
      inputMode="numeric"
      placeholder="3.500.000"
      className=""
      aria-invalid={ariaInvalid}
    />
  )
}

/** Auto-inserts "/" after 2 digits for MM/YYYY period fields. */
function handlePeriodInput(
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (v: string) => void
) {
  let val = e.target.value.replace(/[^\d/]/g, "")
  if (val.length === 2 && !val.includes("/")) val += "/"
  if (val.length > 7) val = val.slice(0, 7)
  onChange(val)
}

/** Pill-button SI / NO toggle — equal-width grid columns. */
function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="grid w-24 grid-cols-2 overflow-hidden rounded-md border text-sm font-medium">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={[
          "py-1.5 text-center transition-colors",
          value
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        ].join(" ")}
      >
        SI
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "py-1.5 text-center transition-colors",
          !value
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted",
        ].join(" ")}
      >
        NO
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ManualFormProps {
  defaultValues?: Partial<ManualFormInput>
  onSubmit: (data: ManualFormInput) => void
  /** Notifica al padre cuando cambia el número de contratos */
  onContractCountChange?: (count: "1" | "2") => void
}

export function ManualForm({
  defaultValues,
  onSubmit,
  onContractCountChange,
}: ManualFormProps) {
  const form = useForm<ManualFormInput>({
    resolver: zodResolver(ManualFormSchema as any) as Resolver<ManualFormInput>,
    mode: "onBlur",
    defaultValues: {
      contractCount: "1",
      isPensioner: false,
      paymentsToRequest: 1,
      paymentNumber: 1,
      amountToCharge: "" as unknown as number,
      paymentRequestPeriod: "",
      paymentType: "Parcial" as "Parcial" | "Final" | "Único",
      quipuCompany: "",
      dependencia: "",
      institutionalEmail: "",
      amendmentNumber: "",
      additionNumber: "",
      supervisorName: "",
      supervisorDocumentNumber: "",
      supervisorEmail: "",
      supervisorPhone: "",
      deductionDependents: false,
      deductionHealthPolicy: false,
      deductionMortgageInterest: false,
      deductionPrepaidMedicine: false,
      deductionAFC: false,
      deductionVoluntaryPension: false,
      ...defaultValues,
    },
  })

  const contractCount = form.watch("contractCount")
  const { setDocuments, documents, extractedData } = useWizardStore()

  // Lógica para deshabilitar Final/Único si ya tenemos la fecha fin del contrato
  const canSelectFinal = useMemo(() => {
    if (!extractedData?.contract?.endDate) return true
    const [d, m, y] = extractedData.contract.endDate.split("/").map(Number)
    const endDate = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today >= endDate
  }, [extractedData])

  // Notifica al padre cada vez que cambia contractCount
  useEffect(() => {
    onContractCountChange?.(contractCount)
  }, [contractCount, onContractCountChange])

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-8"
    >
      {/* ── Sección 2: Datos del pago ── */}
      <FieldSet>
        <FieldLegend>Datos del pago</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="paymentsToRequest"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Pagos a solicitar
                  </FieldLabel>
                  <FieldDescription>
                    ¿Cuántos meses de pago vas a cobrar?
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    min={1}
                    max={24}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="paymentNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>Número de pago</FieldLabel>
                  <FieldDescription>
                    Consecutivo: ¿es el 1.º, 2.º…?
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    min={1}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="amountToCharge"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>Valor a cobrar</FieldLabel>
                <FieldDescription>Pesos colombianos</FieldDescription>
                <CurrencyInput
                  id={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="paymentRequestPeriod"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Período de solicitud
                  </FieldLabel>
                  <FieldDescription>
                    Mes que estás cobrando —{" "}
                    <span className="font-mono">MM/AAAA</span>
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="04/2026"
                    maxLength={7}
                    inputMode="numeric"
                    onChange={(e) => handlePeriodInput(e, field.onChange)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="paymentType"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel>Tipo de pago</FieldLabel>
                  <FieldDescription>
                    Selecciona el tipo que corresponde a este pago.
                  </FieldDescription>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Parcial", "Final", "Único"] as const).map((val) => {
                      const isDisabled =
                        (val === "Final" || val === "Único") && !canSelectFinal
                      return (
                        <button
                          key={val}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => field.onChange(val)}
                          className={[
                            "rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            field.value === val
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-foreground hover:border-primary/40",
                            isDisabled &&
                              "cursor-not-allowed opacity-40 grayscale",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={
                            isDisabled
                              ? "Solo disponible al finalizar el contrato"
                              : ""
                          }
                        >
                          {val}
                        </button>
                      )
                    })}
                  </div>
                  {!canSelectFinal && (
                    <p className="mt-1.5 text-[10px] text-amber-600">
                      ⚠ Pago Final/Único bloqueado hasta el{" "}
                      {extractedData!.contract!.endDate}
                    </p>
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      {/* ── Sección 3: Datos del contratista ── */}
      <FieldSet>
        <FieldLegend>Datos del contratista</FieldLegend>
        <FieldGroup>
          <Controller
            name="dependencia"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>Dependencia</FieldLabel>
                <FieldDescription>
                  Dependencia a la que pertenece
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Ej. DIRECCIÓN DE INVESTIGACIÓN Y EXTENSIÓN"
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  aria-invalid={fieldState.invalid}
                  spellCheck={true}
                  lang="es"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="quipuCompany"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>
                  Código empresa QUIPU
                </FieldLabel>
                <FieldDescription>
                  Número de la dependencia contratante en el sistema QUIPU (solo
                  dígitos)
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="numeric"
                  placeholder="Ej. 4013"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="institutionalEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>Correo</FieldLabel>
                <FieldDescription>
                  Correo de contacto del contratista
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="correo@ejemplo.com"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="amendmentNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Otrosí No.{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </FieldLabel>
                  <FieldDescription>
                    Si el contrato fue modificado por otrosí
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ej. CSI 1/2026"
                    aria-invalid={fieldState.invalid}
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="additionNumber"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Adición No./Año{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </FieldLabel>
                  <FieldDescription>
                    Si el contrato tiene adición de valor o plazo
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ej. Adición 1/2026"
                    aria-invalid={fieldState.invalid}
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="isPensioner"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel>Soy pensionado</FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Activa esta opción si ya estás pensionado — afecta el
                    cálculo de aportes
                  </p>
                </div>
                <YesNoToggle value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      {/* ── Sección 5: Datos del interventor o supervisor ── */}
      <FieldSet>
        <FieldLegend>Interventor o supervisor</FieldLegend>
        <FieldGroup>
          <Controller
            name="supervisorName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>Nombre completo</FieldLabel>
                <FieldDescription>
                  Interventor o supervisor que firma la constancia
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Nombre completo"
                  aria-invalid={fieldState.invalid}
                  spellCheck={true}
                  lang="es"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="supervisorDocumentNumber"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>No. Identificación</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="numeric"
                  placeholder="Ej. 12345678"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="supervisorEmail"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Correo electrónico
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    placeholder="supervisor@unal.edu.co"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="supervisorPhone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    inputMode="tel"
                    placeholder="Ej. 3001234567"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      {/* ── Sección 4: Documentos para soporte de deducciones (Formato 069 §3) ── */}
      <FieldSet>
        <FieldLegend>Documentos para soporte de deducciones</FieldLegend>
        <FieldGroup>
          <p className="text-xs text-muted-foreground">
            Indica con SI/NO si el contratista aporta cada documento. Si marcas
            SI, adjunta el archivo PDF — se añadirá al final del PDF generado.
          </p>
          {(
            [
              {
                name: "deductionDependents",
                fileKey: "deductionDependentsFile",
                label: "Certificado de dependientes",
              },
              {
                name: "deductionHealthPolicy",
                fileKey: "deductionHealthPolicyFile",
                label: "Certificado de seguro de salud — Póliza",
              },
              {
                name: "deductionMortgageInterest",
                fileKey: "deductionMortgageInterestFile",
                label:
                  "Certificado de intereses o corrección monetaria por préstamos para vivienda",
              },
              {
                name: "deductionPrepaidMedicine",
                fileKey: "deductionPrepaidMedicineFile",
                label: "Comprobante de pago mensual de Medicina Prepagada",
              },
              {
                name: "deductionAFC",
                fileKey: "deductionAFCFile",
                label: "Certificado de cuentas AFC",
              },
              {
                name: "deductionVoluntaryPension",
                fileKey: "deductionVoluntaryPensionFile",
                label: "Aportes voluntarios a pensión",
              },
            ] as const
          ).map(({ name, fileKey, label }) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field }) => (
                <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm leading-snug">{label}</span>
                    <YesNoToggle
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        if (!v)
                          setDocuments({
                            [fileKey]: null,
                          } as Partial<UploadedDocuments>)
                      }}
                    />
                  </div>
                  {field.value && (
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60">
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        PDF
                      </span>
                      <span className="truncate text-muted-foreground">
                        {(
                          documents[
                            fileKey as keyof typeof documents
                          ] as File | null
                        )?.name ?? "Seleccionar archivo…"}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] ?? null
                          if (file) {
                            try {
                              const buffer = await file.arrayBuffer()
                              const bytes = new Uint8Array(buffer)
                              if (
                                bytes[0] !== 0x25 ||
                                bytes[1] !== 0x50 ||
                                bytes[2] !== 0x44 ||
                                bytes[3] !== 0x46
                              ) {
                                throw new Error(
                                  "El archivo no es un PDF válido."
                                )
                              }
                              const content = new TextDecoder().decode(
                                bytes.slice(0, 5000)
                              )
                              if (
                                content.includes("/JS") ||
                                content.includes("/JavaScript")
                              ) {
                                throw new Error(
                                  "El PDF contiene elementos no permitidos (/JS)."
                                )
                              }
                            } catch (err: any) {
                              import("sonner").then(({ toast }) => {
                                toast.error("Archivo rechazado", {
                                  description: err.message,
                                })
                              })
                              e.target.value = ""
                              return
                            }
                          }
                          setDocuments({
                            [fileKey]: file,
                          } as Partial<UploadedDocuments>)
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            />
          ))}
        </FieldGroup>
      </FieldSet>

      <Button type="submit" size="lg" className="w-full text-base">
        Continuar al paso 2 →
      </Button>
    </form>
  )
}
