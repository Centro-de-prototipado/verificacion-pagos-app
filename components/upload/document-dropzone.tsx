"use client"

import { useRef, useState } from "react"
import {
  UploadCloudIcon,
  FileTextIcon,
  XIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DocumentDropzoneProps {
  label: string
  description?: string
  hint?: string
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
  /** Número de orden para mostrar como badge (1, 2, 3…) */
  stepNumber?: number
  accept?: string
  /** Muestra estado de procesamiento IA */
  loading?: boolean
}

export function DocumentDropzone({
  label,
  description,
  hint,
  file,
  onFileChange,
  disabled = false,
  stepNumber,
  accept = "application/pdf",
  loading = false,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function processFile(f: File | null) {
    if (!f) return
    // Simple check: if accept contains "*" or the specific type
    const isAccepted =
      accept === "*" ||
      accept.split(",").some((type) => {
        const t = type.trim()
        if (t === "image/*") return f.type.startsWith("image/")
        return f.type === t || f.name.toLowerCase().endsWith(t.replace(".", ""))
      })

    if (!isAccepted) {
      import("sonner").then(({ toast }) => {
        toast.error(
          `Solo se aceptan archivos de tipo: ${accept.replace("application/pdf", "PDF").replace("image/*", "Imagen")}`
        )
      })
      return
    }

    // --- SECURITY CHECK (CLIENT SIDE) ---
    try {
      const buffer = await f.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      if (f.name.toLowerCase().endsWith(".pdf")) {
        // PDF Magic Number
        if (
          bytes[0] !== 0x25 ||
          bytes[1] !== 0x50 ||
          bytes[2] !== 0x44 ||
          bytes[3] !== 0x46
        ) {
          throw new Error("El archivo no es un PDF válido (firma incorrecta).")
        }
        // Basic malware scan
        const content = new TextDecoder().decode(bytes.slice(0, 5000))
        const dangerousPatterns = ["/JS", "/JavaScript", "/OpenAction"]
        for (const pattern of dangerousPatterns) {
          if (content.includes(pattern)) {
            throw new Error(
              `Seguridad: Se detectó un elemento potencialmente malicioso (${pattern})`
            )
          }
        }
      } else if (
        f.type.startsWith("image/") ||
        f.name.match(/\.(jpg|jpeg|png)$/i)
      ) {
        // Image Magic Numbers
        const isJpg =
          bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        const isPng =
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47
        if (!isJpg && !isPng) {
          throw new Error("El archivo no es una imagen JPG o PNG válida.")
        }
      }
    } catch (error: any) {
      import("sonner").then(({ toast }) => {
        toast.error("Archivo rechazado por seguridad", {
          description: error.message,
        })
      })
      return
    }
    // --- END SECURITY CHECK ---

    onFileChange(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || loading) return
    processFile(e.dataTransfer.files[0] ?? null)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFile(e.target.files?.[0] ?? null)
    // clear input to allow re-uploading same file
    e.target.value = ""
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && !disabled && !loading) {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const uploaded = file !== null

  return (
    <div className="relative flex flex-col gap-2">
      {/* Badge de orden */}
      {stepNumber && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300",
              uploaded
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground",
              loading && "animate-pulse ring-2 ring-primary/30"
            )}
          >
            {loading ? (
              <span className="flex size-full items-center justify-center">
                <span className="size-2 animate-ping rounded-full bg-primary" />
              </span>
            ) : uploaded ? (
              <CheckCircle2Icon className="size-3.5" />
            ) : (
              stepNumber
            )}
          </span>
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
      )}

      {/* Zona de drop */}
      <div
        role="button"
        tabIndex={disabled || loading ? -1 : 0}
        aria-label={`Subir ${label}`}
        aria-disabled={disabled || loading}
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !loading) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          // Estado: arrastrando
          isDragging && "scale-[1.02] border-primary bg-primary/5",
          // Estado: cargado
          uploaded &&
            !isDragging &&
            "border-green-500/40 bg-green-500/5 dark:border-green-400/30 dark:bg-green-400/5",
          // Estado: vacío
          !uploaded &&
            !isDragging &&
            "border-dashed border-border hover:border-primary/50 hover:bg-muted/30",
          // Estado: deshabilitado
          (disabled || loading) && "cursor-not-allowed opacity-50",
          // Estado: cargando
          loading && "border-primary/30 bg-primary/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled || loading}
          tabIndex={-1}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative size-10">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <UploadCloudIcon className="absolute inset-0 m-auto size-5 text-primary opacity-50" />
            </div>
            <p className="text-xs font-medium text-primary">
              Procesando con IA...
            </p>
          </div>
        ) : uploaded ? (
          /* ── Estado: archivo cargado ── */
          <>
            <FileTextIcon className="size-6 shrink-0 text-green-600 dark:text-green-400" />
            <div className="flex w-full max-w-[180px] flex-col gap-0.5">
              <p className="truncate text-xs font-medium text-foreground">
                {file!.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(file!.size / 1024).toFixed(0)} KB ·{" "}
                {file!.type.startsWith("image/") ? "Imagen" : "PDF"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Haz clic para reemplazar
            </p>
            {/* Botón quitar */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-1.5 size-6 rounded-md text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onFileChange(null)
              }}
            >
              <XIcon className="size-3.5" />
              <span className="sr-only">Quitar {label}</span>
            </Button>
          </>
        ) : (
          /* ── Estado: sin archivo ── */
          <>
            <UploadCloudIcon className="size-7 shrink-0 text-muted-foreground/60" />
            <div className="flex flex-col gap-0.5">
              {!stepNumber && (
                <p className="text-xs font-medium text-foreground">{label}</p>
              )}
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
              {hint && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {hint}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground/50">
                {accept.includes("image") ? "Imagen (PNG/JPG)" : "PDF"} ·
                Arrastra aquí o haz clic
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
