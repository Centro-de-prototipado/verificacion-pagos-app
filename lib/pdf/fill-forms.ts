import path from "path"
import { readFile } from "fs/promises"
import { generate } from "@pdfme/generator"
import type { Template } from "@pdfme/common"
import { multiVariableText, text } from "@pdfme/schemas"
import { PDFDocument } from "pdf-lib"
import type { Format053Data, Format069Data } from "@/lib/types"
import { SEDE, DEPENDENCIA } from "@/lib/constants/institution"
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
        dependencia: DEPENDENCIA,
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
        ch_excelente: "X",
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
    plugins: { text, multiVariableText },
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
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Unificación final: 053 → 069 → planilla → ARL
// ---------------------------------------------------------------------------

export async function combinePDFs({
  bytes053,
  bytes069,
  bytesPlanilla,
  bytesPlanilla2,
  bytesARL,
  bytesInforme,
  bytesDeduccionFiles,
}: {
  bytes053?: Uint8Array | null
  bytes069?: Uint8Array | null
  bytesPlanilla: Uint8Array
  bytesPlanilla2?: Uint8Array
  bytesARL: Uint8Array
  bytesInforme?: Uint8Array | null
  bytesDeduccionFiles?: Uint8Array[]
}): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  const copy = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes)
    const paginas = await merged.copyPages(doc, doc.getPageIndices())
    paginas.forEach((p) => merged.addPage(p))
  }

  if (bytes053) await copy(bytes053)
  if (bytes069) await copy(bytes069)
  await copy(bytesPlanilla)
  if (bytesPlanilla2) await copy(bytesPlanilla2)
  await copy(bytesARL)
  if (bytesInforme) await copy(bytesInforme)
  if (bytesDeduccionFiles) {
    for (const bytes of bytesDeduccionFiles) await copy(bytes)
  }

  return merged.save()
}
