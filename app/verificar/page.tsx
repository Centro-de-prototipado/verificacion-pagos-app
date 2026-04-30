"use client"

import { useCallback } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { useWizardStore } from "@/lib/store"
import type { WizardStep } from "@/lib/types"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { STEPS_CONFIG } from "@/components/wizard/steps-config"
import { StepIndicator } from "@/components/wizard/step-indicator"
import { Step1 } from "@/components/wizard/step-1"
import { Step2 } from "@/components/wizard/step-2"
import { Step3 } from "@/components/wizard/step-3"
import { Step4 } from "@/components/wizard/step-4"
import Image from "next/image"

export default function VerificarPage() {
  const { step, setStep, reset } = useWizardStore()

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

        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Image
            src="/un.svg"
            alt="UNAL"
            className="h-10 w-auto"
            width={20}
            height={20}
          />
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
        <div className="flex items-center justify-center">
          {STEPS_CONFIG.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <StepIndicator step={s} currentStep={step} />
              {index < STEPS_CONFIG.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-px w-10 transition-colors sm:w-20",
                    step > s.number ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* ── Step title + back navigation ── */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <Button
            size="icon"
            onClick={handleBack}
            className="size-8 shrink-0"
            aria-label="Volver al paso anterior"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            Paso {step} de {STEPS_CONFIG.length}
          </p>
          <h1 className="text-lg font-semibold">
            {STEPS_CONFIG[step - 1].label}
          </h1>
        </div>
      </div>

      {/* ── Step content ── */}
      <main>
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </main>
    </div>
  )
}
