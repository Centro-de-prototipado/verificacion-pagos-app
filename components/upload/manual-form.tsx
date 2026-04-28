"use client"

import { useEffect, useState, useRef } from "react"
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
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

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
      // Explicit empty strings so every input starts controlled, not undefined
      amountToCharge: "" as unknown as number,
      paymentRequestPeriod: "",
      paymentType: "Parcial" as "Parcial" | "Final" | "Único",
      quipuCompany: "",
      institutionalEmail: "",
      amendmentNumber: "",
      supervisorName: "",
      supervisorDocumentNumber: "",
      supervisorEmail: "",
      supervisorPhone: "",
      ...defaultValues,
    },
  })

  const contractCount = form.watch("contractCount")
  const paymentsToRequest = form.watch("paymentsToRequest")
  const paymentNumber = form.watch("paymentNumber")

  // Auto-detect payment type whenever paymentNumber or paymentsToRequest change
  useEffect(() => {
    const auto: "Parcial" | "Final" | "Único" =
      Number(paymentsToRequest) === 1
        ? "Único"
        : Number(paymentNumber) >= Number(paymentsToRequest)
          ? "Final"
          : "Parcial"
    form.setValue("paymentType", auto, { shouldValidate: false })
  }, [paymentsToRequest, paymentNumber]) // eslint-disable-line react-hooks/exhaustive-deps

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

            {/* Tipo de pago — auto-detected, user can override */}
            <Controller
              name="paymentType"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel>Tipo de pago</FieldLabel>
                  <FieldDescription>
                    Se detecta automáticamente; ajusta si es necesario.
                  </FieldDescription>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Parcial", "Final", "Único"] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => field.onChange(val)}
                        className={[
                          "rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          field.value === val
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground hover:border-primary/40",
                        ].join(" ")}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
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

          <Controller
            name="amendmentNumber"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={field.name}>
                  Número de otrosí{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </FieldLabel>
                <FieldDescription>
                  Solo si tu contrato tiene adición o modificación por otrosí
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Ej. CSI 1/2026"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="isPensioner"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={field.name} className="cursor-pointer">
                    Soy pensionado
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Activa esta opción si ya estás pensionado — afecta el
                    cálculo de aportes
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      {/* ── Sección 4: Datos del interventor o supervisor ── */}
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

      <Button type="submit" size="lg" className="w-full text-base">
        Continuar al paso 2 →
      </Button>
    </form>
  )
}
