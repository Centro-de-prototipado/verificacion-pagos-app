import { STEPS_CONFIG } from "./steps-config"
import type { WizardStep } from "@/lib/types"

interface ComingSoonStepProps {
  number: Exclude<WizardStep, 1>
}

export function ComingSoonStep({ number }: ComingSoonStepProps) {
  const config = STEPS_CONFIG[number - 1]

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
      <config.icon className="size-10 text-muted-foreground/30" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">
          Paso {number}: {config.label}
        </p>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
        En desarrollo — próximamente disponible
      </span>
    </div>
  )
}
