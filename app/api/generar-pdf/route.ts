import { NextRequest, NextResponse } from "next/server"

import type { ExtractedData, ManualFormData } from "@/lib/types"
import { runValidations } from "@/lib/validations"
import {
  buildFormat053Data,
  buildFormat069Data,
} from "@/lib/pdf/build-format-data"
import {
  llenarConstancia053,
  llenarCertificacion069,
  unificarPDFs,
} from "@/lib/pdf/llenar-formatos"
import { nombreArchivoFinal } from "@/lib/pdf/utils"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  let extracted: ExtractedData
  let manual: ManualFormData
  let planillaBytes: Uint8Array
  let arlBytes: Uint8Array
  let planilla2Bytes: Uint8Array | undefined

  try {
    const formData = await request.formData()

    const extractedRaw = formData.get("extracted")
    const manualRaw = formData.get("manual")
    const planillaFile = formData.get("planilla")
    const arlFile = formData.get("arl")
    const planilla2File = formData.get("planilla2")

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
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer la solicitud." },
      { status: 400 }
    )
  }

  try {
    // Run validations — informe assumed received if required (validated in step 3)
    const summary = runValidations(extracted, manual, false)

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
      llenarConstancia053(datos053),
      llenarCertificacion069(datos069),
    ])

    if (!bytes053 && !bytes069) {
      return NextResponse.json(
        { error: "No se encontró ningún template (053 ni 069)." },
        { status: 500 }
      )
    }

    const mergedBytes = await unificarPDFs({
      bytes053,
      bytes069,
      bytesPlanilla: planillaBytes,
      bytesPlanilla2: planilla2Bytes,
      bytesARL: arlBytes,
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
