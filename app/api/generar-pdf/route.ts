import { NextRequest, NextResponse } from "next/server"

import type { ExtractedData, ManualFormData } from "@/lib/types"
import { runValidations } from "@/lib/validations"
import {
  buildFormat053Data,
  buildFormat069Data,
} from "@/lib/pdf/build-format-data"
import { fill053, fill069, combinePDFs } from "@/lib/pdf/fill-forms"
import { nombreArchivoFinal } from "@/lib/pdf/utils"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  let extracted: ExtractedData
  let manual: ManualFormData
  let planillaBytes: Uint8Array
  let arlBytes: Uint8Array
  let planilla2Bytes: Uint8Array | undefined
  let informeBytes: Uint8Array | undefined
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
    const planillaFile = formData.get("planilla")
    const arlFile = formData.get("arl")
    const planilla2File = formData.get("planilla2")
    const informeFile = formData.get("informe")

    if (!extractedRaw || !manualRaw || !planillaFile || !arlFile) {
      return NextResponse.json(
        {
          error: "Se requieren los campos: extracted, manual, planilla, arl.",
        },
        { status: 400 }
      )
    }

    extracted = JSON.parse(extractedRaw as string) as ExtractedData
    manual = JSON.parse(manualRaw as string) as ManualFormData

    planillaBytes = new Uint8Array(await (planillaFile as File).arrayBuffer())
    arlBytes = new Uint8Array(await (arlFile as File).arrayBuffer())
    if (planilla2File) {
      planilla2Bytes = new Uint8Array(
        await (planilla2File as File).arrayBuffer()
      )
    }
    if (informeFile) {
      informeBytes = new Uint8Array(await (informeFile as File).arrayBuffer())
      informeAdjunto = true
    }
    for (const key of DEDUCTION_FILE_KEYS) {
      const file = formData.get(key)
      if (file) {
        deductionFileBytes.push(
          new Uint8Array(await (file as File).arrayBuffer())
        )
      }
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

    const datos053 = buildFormat053Data(extracted, manual, summary)
    const datos069 = buildFormat069Data(
      extracted,
      manual,
      summary.contributions,
      summary
    )

    const [bytes053, bytes069] = await Promise.all([
      fill053(datos053),
      fill069(datos069),
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
