import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WizardStep } from "@/lib/types"
import type { StepConfig } from "./steps-config"

interface StepIndicatorProps {
  step: StepConfig
  currentStep: WizardStep
}

export function StepIndicator({ step, currentStep }: StepIndicatorProps) {
  const completed = currentStep > step.number
  const active = currentStep === step.number

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
          completed && "border-primary bg-primary text-primary-foreground",
          active && "border-primary bg-background text-primary",
          !completed &&
            !active &&
            "border-border bg-background text-muted-foreground"
        )}
      >
        {completed ? <CheckIcon className="size-4" /> : step.number}
      </div>
      <span
        className={cn(
          "hidden text-xs font-medium sm:block",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {step.label}
      </span>
    </div>
  )
}
