"use client"

import { useCallback } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { useWizardStore } from "@/lib/store"
import type { WizardStep } from "@/lib/types"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { STEPS_CONFIG } from "@/components/wizard/steps-config"
import { StepIndicator } from "@/components/wizard/step-indicator"
import { Step1 } from "@/components/wizard/step-1"
import { Step2 } from "@/components/wizard/step-2"
import { Step3 } from "@/components/wizard/step-3"
import { Step4 } from "@/components/wizard/step-4"

export default function VerificarPage() {
  const { step, setStep, reset } = useWizardStore()

  const progress = ((step - 1) / (STEPS_CONFIG.length - 1)) * 100

  const handleBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as WizardStep)
  }, [step, setStep])

  return (
    <div className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
            Inicio
          </Link>
        </Button>

        <span className="text-xs font-medium text-muted-foreground">
          UNAL Sede Manizales
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            reset()
            toast.info("Proceso reiniciado.", {
              description: "Todos los datos han sido borrados.",
            })
          }}
        >
          Reiniciar
        </Button>
      </header>

      {/* ── Step indicators ── */}
      <nav aria-label="Pasos del proceso">
        <div className="flex items-center justify-between">
          {STEPS_CONFIG.map((s, index) => (
            <div key={s.number} className="flex flex-1 items-center">
              <StepIndicator step={s} currentStep={step} />
              {index < STEPS_CONFIG.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px flex-1 transition-colors sm:mx-2",
                    step > s.number ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <Progress value={progress} className="mt-3 h-1 sm:hidden" />
      </nav>

      {/* ── Active step title ── */}
      <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Paso {step} de {STEPS_CONFIG.length}
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          {STEPS_CONFIG[step - 1].label}
        </h1>
        <p className="text-sm text-muted-foreground">
          {STEPS_CONFIG[step - 1].description}
        </p>
      </div>

      {/* ── Step content ── */}
      <main>
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </main>

      {/* ── Bottom navigation ── */}
      {step > 1 && (
        <div className="sticky bottom-4 mt-4">
          <div className="flex items-center rounded-xl border bg-background/95 px-4 py-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeftIcon className="size-4" />
              Paso {step - 1} — {STEPS_CONFIG[step - 2].label}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
