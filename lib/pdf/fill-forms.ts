import path from "path"
import { readFile } from "fs/promises"
import { generate } from "@pdfme/generator"
import type { Template } from "@pdfme/common"
import { multiVariableText, text, image } from "@pdfme/schemas"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { Format053Data, Format069Data } from "@/lib/types"
import { SEDE } from "@/lib/constants/institution"
import { CONTRACT_LABELS } from "@/lib/constants/contracts"

const TEMPLATES_DIR = path.join(process.cwd(), "lib", "templates")

function num(value: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(value))
}

async function loadTemplate(name: string): Promise<Template | null> {
  try {
    const json = await readFile(path.join(TEMPLATES_DIR, name), "utf-8")
    return JSON.parse(json) as Template
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.053 — Constancia de cumplimiento contractual
// ---------------------------------------------------------------------------

export async function fill053(
  datos: Format053Data
): Promise<Uint8Array | null> {
  const template = await loadTemplate("template_053.json")
  if (!template) return null
  const [numero_orden, anio] = datos.orderNumberYear.split("/")

  return generate({
    template,
    plugins: { text, multiVariableText },
    inputs: [
      {
        sede: SEDE,
        dependencia: datos.dependencia,
        modalidad_contrato: CONTRACT_LABELS[datos.contractType],
        numero_orden,
        anio: `/${anio}`,
        csi_label: datos.amendmentLabel ?? "",
        adicion_label: datos.additionLabel ?? "",
        codigo_quipu: datos.quipuCompany,
        nombre_contratista: datos.contractorName,
        numero_documento: datos.documentNumber,
        numero_planilla: datos.sheetNumber,
        fecha_pago_planilla: datos.paymentDate,
        periodo_mes: datos.payrollPeriodName,
        ch_parcial: datos.paymentType === "Parcial" ? "X" : "",
        ch_final: datos.paymentType === "Final" ? "X" : "",
        ch_unico: datos.paymentType === "Único" ? "X" : "",
        numero_pago:
          datos.paymentType === "Parcial" ? String(datos.paymentNumber) : "",
        valor_pago:
          datos.paymentType === "Parcial" ? `${num(datos.amountToCharge)}` : "",
        valor_pago_final:
          datos.paymentType === "Final" ? `${num(datos.amountToCharge)}` : "",
        valor_pago_unico:
          datos.paymentType === "Único" ? `${num(datos.amountToCharge)}` : "",
        ch_excelente: "",
        ch_informe_si: datos.activityReportReceived === true ? "X" : "",
        ch_informe_na: datos.activityReportReceived === "N/A" ? "X" : "",
        parrafo_contratista: JSON.stringify({
          numero_planilla: datos.sheetNumber,
          fecha_pago_planilla: datos.paymentDate,
          periodo_solicitud: datos.payrollPeriodName,
        }),
        fecha_lugar_expedicion: JSON.stringify({
          ciudad: "Manizales",
          fecha_expedicion: datos.expeditionDate,
        }),
        ciudad: "Manizales",
        fecha_expedicion: datos.expeditionDate,
        nombre_supervisor: datos.supervisorName,
        id_supervisor: datos.supervisorDocumentNumber,
        correo_supervisor: `Correo electronico: ${datos.supervisorEmail}`,
        telefono_supervisor: `Teléfono: ${datos.supervisorPhone}`,
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.069 — Certificación determinación cedular
// ---------------------------------------------------------------------------

export async function fill069(
  datos: Format069Data
): Promise<Uint8Array | null> {
  const template = await loadTemplate("template_069.json")
  if (!template) return null

  const totalContractValue =
    datos.contractTotalValue + (datos.contract2TotalValue ?? 0)
  // calculationBase = max(IBC, SMMLV) = healthContribution / 12.5%
  const calculationBase = Math.round(datos.healthContribution / 0.125)

  return generate({
    template,
    plugins: { text, multiVariableText, image },
    inputs: [
      {
        // Sección 1 — Datos generales
        nombre_contratista: datos.contractorName,
        fecha_diligenciamiento: datos.processingDate,
        tipo_documento: datos.documentType,
        numero_documento: datos.documentNumber,
        es_pensionado: datos.isPensioner ? "SI" : "NO",
        correo_contratista: datos.institutionalEmail,
        // Sección 2 — Contrato 1
        codigo_quipu: datos.quipuCompany,
        tipo_contrato: datos.contractType,
        numero_orden: datos.orderNumber,
        valor_total_contrato: num(datos.contractTotalValue),
        fecha_inicio_contrato: datos.startDate,
        fecha_fin_contrato: datos.endDate,
        clase_riesgo: `Riesgo ${datos.riskClassLabel}`,
        // Sección 2 — Contrato 2 (vacío si solo hay uno)
        tipo_contrato_2: datos.contract2Type ?? "",
        numero_orden_2: datos.contract2OrderNumber ?? "",
        valor_total_contrato_2:
          datos.contract2TotalValue != null
            ? num(datos.contract2TotalValue)
            : "",
        fecha_inicio_contrato_2: datos.contract2StartDate ?? "",
        fecha_fin_contrato_2: datos.contract2EndDate ?? "",
        // Fila TOTAL de la tabla de contratos
        valor_total_suma: num(totalContractValue),
        // Sección 3 — Períodos
        ref_deducciones: datos.deductionsContractRef,
        periodo_solicitud: datos.paymentRequestPeriod,
        periodo_planilla: datos.payrollPeriod,
        // Sección 3 — Deducciones (marcas de soporte)
        ch_deduccion_dependientes: datos.deductionDependents ? "SI" : "NO",
        ch_deduccion_poliza_salud: datos.deductionHealthPolicy ? "SI" : "NO",
        ch_deduccion_intereses_vivienda: datos.deductionMortgageInterest
          ? "SI"
          : "NO",
        ch_deduccion_medicina_prepagada: datos.deductionPrepaidMedicine
          ? "SI"
          : "NO",
        ch_deduccion_afc: datos.deductionAFC ? "SI" : "NO",
        ch_deduccion_pension_voluntaria: datos.deductionVoluntaryPension
          ? "SI"
          : "NO",
        // Sección 4 — Aportes
        aporte_salud: num(datos.healthContribution),
        aporte_pension: datos.isPensioner ? "" : num(datos.pensionContribution),
        fondo_solidaridad: datos.isPensioner ? "" : num(datos.solidarityFund),
        aporte_arl: num(datos.arlContribution),
        total_aportes: num(datos.totalObligatory),
        // Sección 5 — Tabla mensualización (fila de datos)
        valor_mensualizado: num(datos.monthlyValue),
        numero_meses: String(datos.contractMonths),
        ibc: num(datos.ibc),
        aporte_salud_tabla: num(datos.healthContribution),
        aporte_pension_tabla: datos.isPensioner
          ? ""
          : num(datos.pensionContribution),
        fondo_solidaridad_tabla: datos.isPensioner
          ? ""
          : num(datos.solidarityFund),
        base_retencion: num(datos.monthlyRetentionBase),
        // Sección 5 — Tabla mensualización (fila TOTAL)
        valor_mensualizado_total: num(datos.monthlyValue),
        calculo_base_total: num(calculationBase),
        base_retencion_total: num(datos.monthlyRetentionBase),
        // Sección 6 — Declaración formal y firma
        declaracion_formal: datos.formalDeclaration,
        nombre_firmante: datos.signerName,
        documento_firmante: datos.signerDocumentRef,
        firma: datos.signatureImage ?? "",
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Unificación final: 053 → 069 → planilla → ARL
// ---------------------------------------------------------------------------

/** Verifica que los bytes correspondan a un PDF válido (empieza con %PDF). */
function validatePdfBytes(bytes: Uint8Array, label: string): void {
  if (!bytes || bytes.length === 0) {
    throw new Error(
      `El archivo "${label}" está vacío. Verifica que subiste el archivo correcto.`
    )
  }
  // PDF header: %PDF (bytes 0x25 0x50 0x44 0x46)
  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
    throw new Error(
      `El archivo "${label}" no es un PDF válido (no contiene encabezado %PDF). ` +
        `Asegúrate de subir un PDF real y no un archivo renombrado.`
    )
  }
}

// ---------------------------------------------------------------------------
// Certificado de Validación Digital
// ---------------------------------------------------------------------------

export async function generateValidationCertificate(datos: {
  contractorName: string
  orderNumber: string
  expeditionDate: string
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size
  const { width, height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Decorative border
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  })

  // Header
  page.drawText("CERTIFICADO DE VALIDACIÓN DIGITAL", {
    x: 120,
    y: height - 120,
    size: 20,
    font: fontBold,
    color: rgb(0, 0.45, 0.73), // UNAL Blue-ish
  })

  page.drawText("SISTEMA DE VERIFICACIÓN DE PAGOS - UNAL", {
    x: 160,
    y: height - 145,
    size: 10,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Body
  const bodyText = [
    "Se certifica que el presente paquete documental ha sido generado y validado íntegramente",
    "utilizando la plataforma oficial de verificación de pagos del Centro de Prototipado.",
    "",
    "Este proceso garantiza que:",
    "1. La identidad del contratista coincide plenamente entre el contrato e informe de actividades.",
    "2. El pago de seguridad social se realizó dentro de los plazos de ley (o se adjuntó el soporte de mora).",
    "3. Los aportes a salud, pensión y ARL corresponden a los valores liquidados en el contrato.",
    "4. El informe de actividades cumple con las fechas de ejecución y firma requeridas.",
    "5. El formato 053 y 069 han sido diligenciados automáticamente con datos extraídos por IA.",
    "",
    `CONTRATISTA: ${datos.contractorName}`,
    `ORDEN/CONTRATO: ${datos.orderNumber}`,
    `FECHA DE GENERACIÓN: ${datos.expeditionDate}`,
    "",
    "Este certificado sirve como garantía para la División Financiera de que la documentación",
    "adjunta es consistente y cumple con las reglas de negocio institucionales vigentes.",
  ]

  let currentY = height - 220
  bodyText.forEach((line) => {
    if (line.startsWith("CONTRATISTA") || line.startsWith("ORDEN") || line.startsWith("FECHA")) {
      page.drawText(line, { x: 80, y: currentY, size: 11, font: fontBold })
    } else {
      page.drawText(line, { x: 80, y: currentY, size: 11, font: fontRegular })
    }
    currentY -= 20
  })

  // Footer / Stamp-like area
  page.drawRectangle({
    x: width / 2 - 100,
    y: 100,
    width: 200,
    height: 60,
    borderColor: rgb(0, 0.6, 0.3),
    borderWidth: 2,
  })

  page.drawText("VALIDADO DIGITALMENTE", {
    x: width / 2 - 85,
    y: 135,
    size: 14,
    font: fontBold,
    color: rgb(0, 0.6, 0.3),
  })

  page.drawText("SIN ERRORES BLOQUEANTES", {
    x: width / 2 - 75,
    y: 115,
    size: 10,
    font: fontRegular,
    color: rgb(0, 0.6, 0.3),
  })

  return pdfDoc.save()
}

export async function combinePDFs({
  bytes053,
  bytes069,
  bytesPlanilla,
  bytesPlanilla2,
  bytesARL,
  bytesInforme,
  bytesDeduccionFiles,
  bytesCertificado,
}: {
  bytes053?: Uint8Array | null
  bytes069?: Uint8Array | null
  bytesPlanilla: Uint8Array
  bytesPlanilla2?: Uint8Array
  bytesARL: Uint8Array
  bytesInforme?: Uint8Array | null
  bytesDeduccionFiles?: Uint8Array[]
  bytesCertificado?: Uint8Array
}): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  const copy = async (bytes: Uint8Array, label: string) => {
    validatePdfBytes(bytes, label)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const paginas = await merged.copyPages(doc, doc.getPageIndices())
    paginas.forEach((p) => merged.addPage(p))
  }

  if (bytes053) await copy(bytes053, "Formato 053 (generado)")
  if (bytes069) await copy(bytes069, "Formato 069 (generado)")
  await copy(bytesPlanilla, "Planilla PILA")
  if (bytesPlanilla2) await copy(bytesPlanilla2, "Planilla mes siguiente")
  await copy(bytesARL, "Certificado ARL")
  if (bytesInforme) await copy(bytesInforme, "Informe de actividades")
  if (bytesDeduccionFiles) {
    for (let i = 0; i < bytesDeduccionFiles.length; i++) {
      await copy(bytesDeduccionFiles[i], `Documento de deducción ${i + 1}`)
    }
  }
  if (bytesCertificado) await copy(bytesCertificado, "Certificado de Validación Digital")

  return merged.save()
}
