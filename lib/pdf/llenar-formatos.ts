import path from "path"
import { readFile } from "fs/promises"
import { generate } from "@pdfme/generator"
import type { Template } from "@pdfme/common"
import { PDFDocument } from "pdf-lib"
import type { ContractType, Format053Data, Format069Data } from "@/lib/types"
import { SEDE, DEPENDENCIA } from "@/lib/validations/constantes"

const TEMPLATES_DIR = path.join(process.cwd(), "lib", "templates")

function num(value: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(value))
}

function peso(value: number): string {
  return value > 0 ? `$ ${num(value)}` : "$ -"
}

const CONTRACT_LABELS: Record<ContractType, string> = {
  OSE: "OSE - Orden contractual de servicios",
  OPS: "OPS - Orden de prestación de servicios",
  OCE: "OCE - Orden de compras especiales",
  OFS: "OFS - Orden de suministros",
  OCO: "OCO - Orden contractual de obras",
  ODS: "ODS - Orden de servicios",
  ODO: "ODO - Orden de dotaciones",
  OCU: "OCU - Orden de consultoría",
}

async function loadTemplate(name: string): Promise<Template> {
  const json = await readFile(path.join(TEMPLATES_DIR, name), "utf-8")
  return JSON.parse(json) as Template
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.053 — Constancia de cumplimiento contractual
// ---------------------------------------------------------------------------

export async function llenarConstancia053(
  datos: Format053Data
): Promise<Uint8Array> {
  const template = await loadTemplate("template_053.json")
  const [numero_orden, anio] = datos.orderNumberYear.split("/")

  return generate({
    template,
    inputs: [
      {
        sede: SEDE,
        dependencia: DEPENDENCIA,
        modalidad_contrato: CONTRACT_LABELS[datos.contractType],
        numero_orden,
        anio,
        csi_label: datos.amendmentLabel ?? "",
        codigo_quipu: datos.quipuCompany,
        nombre_contratista: datos.contractorName,
        numero_documento: datos.documentNumber,
        numero_planilla: datos.sheetNumber,
        fecha_pago_planilla: datos.paymentDate,
        periodo_mes: datos.payrollPeriodName,
        ch_parcial: datos.paymentType === "Parcial" ? "X" : "",
        ch_final: datos.paymentType === "Final" ? "X" : "",
        ch_unico: datos.paymentType === "Único" ? "X" : "",
        numero_pago: String(datos.paymentNumber),
        valor_pago: `$ ${num(datos.amountToCharge)}`,
        ch_excelente: "X",
        ch_informe_si: datos.activityReportReceived === true ? "X" : "",
        ch_informe_na: datos.activityReportReceived === "N/A" ? "X" : "",
        ciudad: "Manizales",
        fecha_expedicion: datos.expeditionDate,
        nombre_supervisor: datos.supervisorName,
        id_supervisor: datos.supervisorDocumentNumber,
        correo_supervisor: datos.supervisorEmail,
        telefono_supervisor: datos.supervisorPhone,
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.069 — Certificación determinación cedular
// ---------------------------------------------------------------------------

export async function llenarCertificacion069(
  datos: Format069Data
): Promise<Uint8Array> {
  const template = await loadTemplate("template_069.json")

  const totalContractValue =
    datos.contractTotalValue + (datos.contract2TotalValue ?? 0)
  // calculationBase = max(IBC, SMMLV) = healthContribution / 12.5%
  const calculationBase = Math.round(datos.healthContribution / 0.125)

  return generate({
    template,
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
        valor_total_contrato: `$ ${num(datos.contractTotalValue)}`,
        fecha_inicio_contrato: datos.startDate,
        fecha_fin_contrato: datos.endDate,
        clase_riesgo: datos.riskClassLabel,
        // Sección 2 — Contrato 2 (vacío si solo hay uno)
        tipo_contrato_2: datos.contract2Type ?? "",
        numero_orden_2: datos.contract2OrderNumber ?? "",
        valor_total_contrato_2:
          datos.contract2TotalValue != null
            ? `$ ${num(datos.contract2TotalValue)}`
            : "",
        fecha_inicio_contrato_2: datos.contract2StartDate ?? "",
        fecha_fin_contrato_2: datos.contract2EndDate ?? "",
        // Fila TOTAL de la tabla de contratos
        valor_total_suma: `$ ${num(totalContractValue)}`,
        // Sección 3 — Períodos
        ref_deducciones: datos.deductionsContractRef,
        periodo_solicitud: datos.paymentRequestPeriod,
        periodo_planilla: datos.payrollPeriod,
        // Sección 4 — Aportes
        aporte_salud: peso(datos.healthContribution),
        aporte_pension: datos.isPensioner ? "" : peso(datos.pensionContribution),
        fondo_solidaridad: datos.isPensioner
          ? ""
          : peso(datos.solidarityFund),
        aporte_arl: peso(datos.arlContribution),
        total_aportes: peso(datos.totalObligatory),
        // Sección 5 — Tabla mensualización (fila de datos)
        valor_mensualizado: `$ ${num(datos.monthlyValue)}`,
        numero_meses: String(datos.contractMonths),
        ibc: `$ ${num(datos.ibc)}`,
        aporte_salud_tabla: peso(datos.healthContribution),
        aporte_pension_tabla: datos.isPensioner
          ? ""
          : peso(datos.pensionContribution),
        fondo_solidaridad_tabla: datos.isPensioner
          ? ""
          : peso(datos.solidarityFund),
        base_retencion: `$ ${num(datos.monthlyRetentionBase)}`,
        // Sección 5 — Tabla mensualización (fila TOTAL)
        valor_mensualizado_total: `$ ${num(datos.monthlyValue)}`,
        calculo_base_total: `$ ${num(calculationBase)}`,
        base_retencion_total: `$ ${num(datos.monthlyRetentionBase)}`,
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

export async function unificarPDFs({
  bytes053,
  bytes069,
  bytesPlanilla,
  bytesPlanilla2,
  bytesARL,
}: {
  bytes053: Uint8Array
  bytes069: Uint8Array
  bytesPlanilla: Uint8Array
  bytesPlanilla2?: Uint8Array
  bytesARL: Uint8Array
}): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  const [doc053, doc069, docPlanilla, docARL] = await Promise.all([
    PDFDocument.load(bytes053),
    PDFDocument.load(bytes069),
    PDFDocument.load(bytesPlanilla),
    PDFDocument.load(bytesARL),
  ])
  const docPlanilla2 = bytesPlanilla2
    ? await PDFDocument.load(bytesPlanilla2)
    : null

  const copiar = async (origen: PDFDocument) => {
    const indices = origen.getPageIndices()
    const paginas = await merged.copyPages(origen, indices)
    paginas.forEach((p) => merged.addPage(p))
  }

  await copiar(doc053)
  await copiar(doc069)
  await copiar(docPlanilla)
  if (docPlanilla2) await copiar(docPlanilla2)
  await copiar(docARL)

  return merged.save()
}
