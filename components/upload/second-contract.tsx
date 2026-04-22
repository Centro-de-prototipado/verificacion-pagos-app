"use client"

import { useWizardStore } from "@/lib/store"
import { DocumentDropzone } from "./document-dropzone"

export function SecondContract() {
  const { documents, setDocuments } = useWizardStore()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Sube el PDF del <strong>segundo contrato</strong> para que la IA
        extraiga sus datos adicionales.
      </p>
      <DocumentDropzone
        label="Segundo contrato (PDF)"
        description="Orden de prestación u otro contrato complementario"
        file={documents.contract2 ?? null}
        onFileChange={(file) => setDocuments({ contract2: file })}
      />
    </div>
  )
}
