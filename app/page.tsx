import Link from "next/link"
import {
  ArrowRightIcon,
  FileSpreadsheetIcon,
  ShieldIcon,
  FileTextIcon,
  BrainCircuitIcon,
  ShieldCheckIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"

// ─── Pasos del proceso ────────────────────────────────────────────────────────

const PROCESS_STEPS = [
  {
    icon: UploadIcon,
    title: "Sube los documentos",
    description:
      "Arrastra o selecciona los 3 PDFs y completa unos datos básicos.",
  },
  {
    icon: BrainCircuitIcon,
    title: "La IA extrae los datos",
    description:
      "Gemini 2.5 Flash lee los PDFs y devuelve información estructurada en segundos.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Validación automática",
    description:
      "Se verifican los aportes según la normativa colombiana vigente.",
  },
  {
    icon: DownloadIcon,
    title: "Descarga el PDF listo",
    description:
      "Constancia de cumplimiento + certificación cedular, listos para firma del supervisor.",
  },
] as const

// ─── Página ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-14 px-6 py-16">
      {/* ── Hero ── */}
      <section className="flex w-full flex-col items-center gap-5 text-center">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Image
            src="/un.svg"
            alt="UNAL"
            className="h-15 w-auto"
            width={20}
            height={20}
          />
        </span>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Verificación de Pagos
          <br />
          <span className="font-normal text-muted-foreground">
            a contratistas
          </span>
        </h1>

        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          Valida tus aportes a seguridad social y genera automáticamente los
          formatos <strong className="text-foreground">U.FT.12.010.053</strong>{" "}
          y <strong className="text-foreground">U.FT.12.010.069</strong> listos
          para firma.
        </p>

        <div className="flex flex-col items-center gap-2">
          <Button asChild size="lg" className="gap-2 px-8">
            <Link href="/verificar">
              Iniciar verificación
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Separator />
      {/* ── Cómo funciona ── */}
      <section className="flex w-full flex-col gap-5">
        <h2 className="text-base font-semibold">¿Cómo funciona?</h2>

        <div className="grid gap-3 sm:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 text-center"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <step.icon className="size-5 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
                  Paso {index + 1}
                </span>
                <p className="text-sm leading-snug font-medium">{step.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
