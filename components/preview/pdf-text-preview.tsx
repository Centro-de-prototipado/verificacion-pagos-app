"use client"

import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  FileTextIcon,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MIN_TEXT_LENGTH } from "@/lib/pdf/extract-text"
import { cn } from "@/lib/utils"

interface PdfTextPreviewProps {
  label: string
  text: string
  /** Número de orden para el badge */
  stepNumber?: number
}

export function PdfTextPreview({
  label,
  text,
  stepNumber,
}: PdfTextPreviewProps) {
  const [open, setOpen] = useState(false)
  const isScanned = text.trim().length < MIN_TEXT_LENGTH
  const charCount = text.trim().length

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {stepNumber && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {stepNumber}
          </span>
        )}
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {isScanned ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-3" />
                Posible escaneo
              </span>
            ) : (
              `${charCount.toLocaleString()} caracteres`
            )}
          </span>
        </div>
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Contenido expandido */}
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {isScanned && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="size-4" />
              <AlertDescription>
                Este PDF parece estar escaneado o no tiene capa de texto. La IA
                lo procesará de forma multimodal, pero la extracción puede ser
                menos precisa. Verifica que el archivo sea correcto.
              </AlertDescription>
            </Alert>
          )}
          <ScrollArea
            className={cn(
              "rounded-lg border bg-muted/30 p-3",
              isScanned ? "max-h-24" : "max-h-48"
            )}
          >
            {text.trim() ? (
              <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                {text}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No se extrajo texto de este documento.
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
