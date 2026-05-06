import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import type { ExtractedData, ManualFormData } from "@/lib/types"
import { runValidations } from "@/lib/validations"
import { ARLSchema } from "@/lib/schemas/arl"
import { ActivityReportSchema } from "@/lib/schemas/activity-report"
import { ContractSchema } from "@/lib/schemas/contract"
import { ManualFormSchema } from "@/lib/schemas/manual-form"
import { PaymentSheetSchema } from "@/lib/schemas/payment-sheet"
import {
  buildFormat053Data,
  buildFormat069Data,
} from "@/lib/pdf/build-format-data"
import {
  fill053,
  fill069,
  combinePDFs,
  generateValidationCertificate,
} from "@/lib/pdf/fill-forms"
import { getPdfPageCount } from "@/lib/pdf/page-count"
import { extractTextFromPDF } from "@/lib/pdf/extract-text"
import {
  extractPILACandidates,
  joinSplitDates,
} from "@/lib/pdf/parsers/keyword-extractor"
import { nombreArchivoFinal } from "@/lib/pdf/utils"
import {
  exceedsContentLength,
  getClientIp,
  isRateLimited,
  readPdfFile,
  readImageFile,
} from "@/lib/security/request-guards"
import {
  validateExtractedDataIntegrity,
  validateNoBlockingResults,
} from "@/lib/security/document-integrity"

export const runtime = "nodejs"

const ExtractedDataSchema = z.object({
  paymentSheet: PaymentSheetSchema.nullable(),
  paymentSheet2: PaymentSheetSchema.nullable().optional(),
  arl: ARLSchema.nullable(),
  contract: ContractSchema.nullable(),
  contract2: ContractSchema.nullable().optional(),
  activityReport: ActivityReportSchema.nullable().optional(),
})

const MAX_FORM_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_PDF_BYTES = 12 * 1024 * 1024 // 12 MB por archivo
const MAX_PDF_PAGES = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 8

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (
    isRateLimited({
      key: `generar-pdf:${ip}`,
      limit: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    )
  }

  if (exceedsContentLength(request, MAX_FORM_BYTES)) {
    return NextResponse.json(
      { error: "La carga es demasiado grande." },
      { status: 413 }
    )
  }

  let extracted: ExtractedData
  let manual: ManualFormData
  let planillaBytes: Uint8Array
  let arlBytes: Uint8Array
  let contractBytes: Uint8Array
  let contract2Bytes: Uint8Array | undefined
  let planilla2Bytes: Uint8Array | undefined
  let informeBytes: Uint8Array | undefined
  let signatureBase64: string | undefined
  let sourceText: {
    paymentSheet: string
    arl: string
    contract: string
    contract2?: string
    paymentSheet2?: string
  }
  let informeAdjunto = false
  const deductionFileBytes: Uint8Array[] = []

  const DEDUCTION_FILE_KEYS = [
    "deductionDependentsFile",
    "deductionHealthPolicyFile",
    "deductionMortgageInterestFile",
    "deductionPrepaidMedicineFile",
    "deductionAFCFile",
    "deductionVoluntaryPensionFile",
  ] as const

  try {
    const formData = await request.formData()

    const extractedRaw = formData.get("extracted")
    const manualRaw = formData.get("manual")
    planillaBytes = (await readPdfFile(formData.get("planilla"), "planilla", {
      required: true,
      maxBytes: MAX_PDF_BYTES,
    }))!

    arlBytes = (await readPdfFile(formData.get("arl"), "arl", {
      required: true,
      maxBytes: MAX_PDF_BYTES,
    }))!

    contractBytes = (await readPdfFile(formData.get("contract"), "contract", {
      required: true,
      maxBytes: MAX_PDF_BYTES,
    }))!

    const contract2FileBytes = await readPdfFile(
      formData.get("contract2"),
      "contract2",
      {
        required: false,
        maxBytes: MAX_PDF_BYTES,
      }
    )
    if (contract2FileBytes) contract2Bytes = contract2FileBytes

    const planilla2FileBytes = await readPdfFile(
      formData.get("planilla2"),
      "planilla2",
      {
        required: false,
        maxBytes: MAX_PDF_BYTES,
      }
    )
    if (planilla2FileBytes) planilla2Bytes = planilla2FileBytes

    const informeFileBytes = await readPdfFile(
      formData.get("informe"),
      "informe",
      {
        required: false,
        maxBytes: MAX_PDF_BYTES,
      }
    )
    if (informeFileBytes) {
      informeBytes = informeFileBytes
      informeAdjunto = true
    }

    const signatureFile = await readImageFile(
      formData.get("signature"),
      "signature",
      {
        required: true,
        maxBytes: MAX_PDF_BYTES,
      }
    )

    if (
      !extractedRaw ||
      !manualRaw ||
      !planillaBytes ||
      !arlBytes ||
      !contractBytes ||
      !signatureFile
    ) {
      return NextResponse.json(
        {
          error:
            "Se requieren los campos: extracted, manual, planilla, arl, contract, signature.",
        },
        { status: 400 }
      )
    }

    if (typeof extractedRaw !== "string" || typeof manualRaw !== "string") {
      return NextResponse.json(
        { error: "Los campos extracted y manual deben ser texto JSON." },
        { status: 400 }
      )
    }

    const parsedExtracted = ExtractedDataSchema.safeParse(
      JSON.parse(extractedRaw)
    )
    const parsedManual = ManualFormSchema.safeParse(JSON.parse(manualRaw))
    if (!parsedExtracted.success || !parsedManual.success) {
      return NextResponse.json(
        { error: "Los datos de entrada no cumplen el formato esperado." },
        { status: 422 }
      )
    }
    extracted = parsedExtracted.data as ExtractedData
    manual = parsedManual.data as ManualFormData

    if ((await getPdfPageCount(planillaBytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "planilla" supera ${MAX_PDF_PAGES} páginas.` },
        { status: 422 }
      )
    }
    if ((await getPdfPageCount(arlBytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "arl" supera ${MAX_PDF_PAGES} páginas.` },
        { status: 422 }
      )
    }
    if ((await getPdfPageCount(contractBytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "contract" supera ${MAX_PDF_PAGES} paginas.` },
        { status: 422 }
      )
    }
    if (planilla2Bytes && (await getPdfPageCount(planilla2Bytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "planilla2" supera ${MAX_PDF_PAGES} páginas.` },
        { status: 422 }
      )
    }
    if (contract2Bytes && (await getPdfPageCount(contract2Bytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "contract2" supera ${MAX_PDF_PAGES} paginas.` },
        { status: 422 }
      )
    }
    if (informeBytes && (await getPdfPageCount(informeBytes)) > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `El archivo "informe" supera ${MAX_PDF_PAGES} páginas.` },
        { status: 422 }
      )
    }

    if (signatureFile) {
      const buffer = await signatureFile.arrayBuffer()
      const type = signatureFile.type
      signatureBase64 = `data:${type};base64,${Buffer.from(buffer).toString("base64")}`
    }
    for (const key of DEDUCTION_FILE_KEYS) {
      const file = await readPdfFile(formData.get(key), key, {
        required: false,
        maxBytes: MAX_PDF_BYTES,
      })
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if ((await getPdfPageCount(bytes)) > MAX_PDF_PAGES) {
          return NextResponse.json(
            { error: `El archivo "${key}" supera ${MAX_PDF_PAGES} páginas.` },
            { status: 422 }
          )
        }
        deductionFileBytes.push(bytes)
      }
    }

    sourceText = {
      paymentSheet: joinSplitDates(
        await extractTextFromPDF(
          planillaBytes.buffer.slice(
            planillaBytes.byteOffset,
            planillaBytes.byteOffset + planillaBytes.byteLength
          ) as ArrayBuffer
        )
      ),
      arl: joinSplitDates(
        await extractTextFromPDF(
          arlBytes.buffer.slice(
            arlBytes.byteOffset,
            arlBytes.byteOffset + arlBytes.byteLength
          ) as ArrayBuffer
        )
      ),
      contract: joinSplitDates(
        await extractTextFromPDF(
          contractBytes.buffer.slice(
            contractBytes.byteOffset,
            contractBytes.byteOffset + contractBytes.byteLength
          ) as ArrayBuffer
        )
      ),
    }
    if (planilla2Bytes) {
      const ab = planilla2Bytes.buffer.slice(
        planilla2Bytes.byteOffset,
        planilla2Bytes.byteOffset + planilla2Bytes.byteLength
      ) as ArrayBuffer
      sourceText.paymentSheet2 = joinSplitDates(await extractTextFromPDF(ab))
    }
    if (contract2Bytes) {
      const ab = contract2Bytes.buffer.slice(
        contract2Bytes.byteOffset,
        contract2Bytes.byteOffset + contract2Bytes.byteLength
      ) as ArrayBuffer
      sourceText.contract2 = joinSplitDates(await extractTextFromPDF(ab))
    }
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer la solicitud." },
      { status: 400 }
    )
  }

  try {
    // Run validations; report check is non-blocking warning.
    const summary = runValidations(extracted, manual, informeAdjunto)

    if (!summary.contributions) {
      return NextResponse.json(
        { error: "No se pudieron calcular los aportes." },
        { status: 422 }
      )
    }

    const blockingErrors = validateNoBlockingResults(summary)
    if (blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error: "La solicitud tiene validaciones bloqueantes.",
          details: blockingErrors.join(" "),
        },
        { status: 422 }
      )
    }

    const integrityErrors = validateExtractedDataIntegrity({
      extracted,
      manual,
      sourceText,
    })
    if (integrityErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Los datos enviados no coinciden con los documentos adjuntos.",
          details: integrityErrors.join(" "),
        },
        { status: 422 }
      )
    }

    // Extract basic data from planilla2 (sheet number, dates, period) if present.
    let paymentSheet2Data:
      | { sheetNumber?: string; paymentDate?: string; period?: string }
      | undefined
    if (planilla2Bytes) {
      try {
        // Crear un ArrayBuffer limpio desde los bytes (evita problemas de offset con .buffer)
        const ab = planilla2Bytes.buffer.slice(
          planilla2Bytes.byteOffset,
          planilla2Bytes.byteOffset + planilla2Bytes.byteLength
        ) as ArrayBuffer
        const text = await extractTextFromPDF(ab)
        const cands = extractPILACandidates(joinSplitDates(text))
        paymentSheet2Data = {
          sheetNumber: cands.sheetNumber,
          paymentDate: cands.paymentDate,
          period: cands.period,
        }
      } catch {
        // Non-fatal: proceed without planilla2 data
      }
    }

    const datos053 = buildFormat053Data(
      extracted,
      manual,
      summary,
      informeAdjunto,
      paymentSheet2Data
    )
    const datos069 = buildFormat069Data(
      extracted,
      manual,
      summary.contributions,
      summary,
      paymentSheet2Data,
      signatureBase64
    )

    const [bytes053, bytes069, bytesCertificado] = await Promise.all([
      fill053(datos053),
      fill069(datos069),
      generateValidationCertificate({
        contractorName: extracted.contract!.contractorName,
        orderNumber: extracted.contract!.orderNumber,
        expeditionDate: datos053.expeditionDate,
      }),
    ])

    if (!bytes053 && !bytes069) {
      return NextResponse.json(
        { error: "No se encontró ningún template (053 ni 069)." },
        { status: 500 }
      )
    }

    const mergedBytes = await combinePDFs({
      bytes053,
      bytes069,
      bytesPlanilla: planillaBytes,
      bytesPlanilla2: planilla2Bytes,
      bytesARL: arlBytes,
      bytesInforme: informeBytes,
      bytesDeduccionFiles: deductionFileBytes.length
        ? deductionFileBytes
        : undefined,
      bytesCertificado: bytesCertificado,
    })

    const contract = extracted.contract!
    const year = manual.paymentRequestPeriod.split("/")[1]
    const filename = nombreArchivoFinal(
      manual.quipuCompany,
      contract.contractType,
      contract.orderNumber
    )

    return new NextResponse(Buffer.from(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-PDF-Year": year,
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al generar PDF."
    return NextResponse.json(
      { error: "Falló la generación del PDF.", details: message },
      { status: 500 }
    )
  }
}
