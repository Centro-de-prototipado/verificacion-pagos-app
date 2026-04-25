"use client"

import { useEffect } from "react"
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      payrollPeriod: "",
      quipuCompany: "",
      institutionalEmail: "",
      amendmentNumber: "",
      ...defaultValues,
    },
  })

  const contractCount = form.watch("contractCount")

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
                <FieldLabel htmlFor={field.name}>
                  Valor a cobrar (COP)
                </FieldLabel>
                <FieldDescription>
                  Monto en pesos colombianos que vas a facturar en esta
                  solicitud
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Ej. 3 500 000"
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
                  <FieldDescription>Mes que estás cobrando</FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="MM/YYYY — ej. 04/2026"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="payrollPeriod"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    Período de la planilla
                  </FieldLabel>
                  <FieldDescription>
                    Mes que cubre tu planilla SS
                  </FieldDescription>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="MM/YYYY — ej. 03/2026"
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
                <FieldLabel htmlFor={field.name}>
                  Correo institucional
                </FieldLabel>
                <FieldDescription>
                  Tu cuenta de correo @unal.edu.co
                </FieldDescription>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="usuario@unal.edu.co"
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
                  placeholder="Ej. 1"
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

      <Button type="submit" size="lg" className="w-full text-base">
        Continuar al paso 2 →
      </Button>
    </form>
  )
}
