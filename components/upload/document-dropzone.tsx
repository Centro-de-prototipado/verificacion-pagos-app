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
}

export function DocumentDropzone({
  label,
  description,
  hint,
  file,
  onFileChange,
  disabled = false,
  stepNumber,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function processFile(f: File | null) {
    if (!f) return
    if (f.type !== "application/pdf") {
      alert("Solo se aceptan archivos PDF.")
      return
    }
    onFileChange(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    processFile(e.dataTransfer.files[0] ?? null)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFile(e.target.files?.[0] ?? null)
    // clear input to allow re-uploading same file
    e.target.value = ""
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
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
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              uploaded
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {uploaded ? <CheckCircle2Icon className="size-3.5" /> : stepNumber}
          </span>
          <span className="text-xs font-medium text-foreground">{label}</span>
          {uploaded && (
            <span className="ml-auto text-[10px] font-medium text-green-600 dark:text-green-400">
              ✓ Listo
            </span>
          )}
        </div>
      )}

      {/* Zona de drop */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Subir ${label}`}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
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
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
          tabIndex={-1}
        />

        {uploaded ? (
          /* ── Estado: archivo cargado ── */
          <>
            <FileTextIcon className="size-6 shrink-0 text-green-600 dark:text-green-400" />
            <div className="flex w-full max-w-[180px] flex-col gap-0.5">
              <p className="truncate text-xs font-medium text-foreground">
                {file!.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(file!.size / 1024).toFixed(0)} KB · PDF
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
                PDF · Arrastra aquí o haz clic
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
