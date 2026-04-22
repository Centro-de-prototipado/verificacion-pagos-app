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

// ─── Documentos que el usuario necesita tener listos ─────────────────────────

const REQUIRED_DOCUMENTS = [
  {
    icon: FileSpreadsheetIcon,
    name: "Planilla de Seguridad Social",
    description:
      "Comprobante de pago a salud, pensión y ARL del mes que vas a cobrar (PILA o equivalente).",
    tip: "Descárgala desde tu operador de planilla",
  },
  {
    icon: ShieldIcon,
    name: "Certificado ARL",
    description:
      "Certificado vigente de afiliación a riesgos laborales, emitido por tu ARL.",
    tip: "Positiva, Sura, Colmena, AXA, etc.",
  },
  {
    icon: FileTextIcon,
    name: "Contrato u Orden contractual",
    description:
      "Orden de prestación de servicios u otro tipo de contrato firmado con la UNAL.",
    tip: "OSE, OPS, OCE, OFS…",
  },
] as const

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
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center gap-14 px-6 py-16">
      {/* ── Hero ── */}
      <section className="flex w-full flex-col items-center gap-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          Universidad Nacional de Colombia · Sede Manizales
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
          <p className="text-xs text-muted-foreground/60">
            Sin base de datos · Los documentos no se almacenan · Privacidad
            garantizada
          </p>
        </div>
      </section>

      <Separator />

      {/* ── Documentos que necesitas ── */}
      <section className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">
            Antes de empezar, necesitarás:
          </h2>
          <p className="text-sm text-muted-foreground">
            Ten estos 3 documentos en formato PDF listos en tu computador.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {REQUIRED_DOCUMENTS.map((doc, index) => (
            <div
              key={doc.name}
              className="flex gap-4 rounded-xl border bg-card/50 p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <doc.icon className="size-5 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium">{doc.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doc.description}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  💡 {doc.tip}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button asChild variant="outline" className="w-full sm:w-fit">
          <Link href="/verificar">Ya tengo mis documentos — comenzar →</Link>
        </Button>
      </section>

      <Separator />

      {/* ── Cómo funciona ── */}
      <section className="flex w-full flex-col gap-5">
        <h2 className="text-base font-semibold">¿Cómo funciona?</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {PROCESS_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex size-8 shrink-0 flex-col items-center justify-center gap-0.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <step.icon className="size-4 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
