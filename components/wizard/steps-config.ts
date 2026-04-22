import {
  BrainCircuitIcon,
  DownloadIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react"
import type { WizardStep } from "@/lib/types"

export interface StepConfig {
  readonly number: WizardStep
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
  readonly description: string
}

export const STEPS_CONFIG: readonly StepConfig[] = [
  {
    number: 1,
    label: "Documentos",
    icon: UploadIcon,
    description: "Sube los PDFs y completa los datos manuales",
  },
  {
    number: 2,
    label: "Extracción",
    icon: BrainCircuitIcon,
    description: "La IA extrae datos estructurados de los PDFs",
  },
  {
    number: 3,
    label: "Validación",
    icon: ShieldCheckIcon,
    description: "Se verifican los aportes a seguridad social",
  },
  {
    number: 4,
    label: "Resultado",
    icon: DownloadIcon,
    description: "Descarga los formatos listos para firma",
  },
] as const
