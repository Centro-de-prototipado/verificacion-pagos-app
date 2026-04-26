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
  // Órdenes contractuales
  OCA: "OCA - Orden contractual de arrendamiento",
  OCO: "OCO - Orden contractual de consultoría",
  ODC: "ODC - Orden contractual de compra",
  ODO: "ODO - Orden contractual de obra",
  OPS: "OPS - Orden contractual de prestación de servicios personales de apoyo a la gestión",
  OSE: "OSE - Orden contractual de servicios",
  OSU: "OSU - Orden contractual de suministros",
  // Contratos
  CCO: "CCO - Contrato de consultoría",
  CDA: "CDA - Contrato de arrendamiento",
  CDC: "CDC - Contrato de compra venta",
  CDO: "CDO - Contrato de obra",
  CIS: "CIS - Contrato de intermediación de seguros",
  CON: "CON - Contrato",
  COV: "COV - Convenio",
  CPS: "CPS - Contrato de prestación de servicios personales de apoyo a la gestión",
  CSE: "CSE - Contrato de servicios",
  CSU: "CSU - Contrato de suministro",
  // Órdenes de vigencia futura
  OEF: "OEF - Orden contractual de servicios Vigencia Futura",
  OFA: "OFA - Orden contractual de arrendamiento Vigencia Futura",
  OFC: "OFC - Orden contractual de compra Vigencia Futura",
  OFO: "OFO - Orden contractual de consultoría Vigencia Futura",
  OFS: "OFS - Orden contractual de prestación de servicios Vigencia Futura",
  OOF: "OOF - Orden contractual de obra Vigencia Futura",
  OSF: "OSF - Orden contractual de prestación de servicios Vigencia Futura",
  OUF: "OUF - Orden contractual de suministro Vigencia Futura",
  // Contratos de vigencia futura
  CAF: "CAF - Contrato de vigencia futura de arrendamiento",
  CCF: "CCF - Contrato de vigencia futura de consultoría",
  CIF: "CIF - Contrato de vigencia futura de intermediación de seguros",
  COF: "COF - Contrato de vigencia futura de obra",
  CPF: "CPF - Contrato de vigencia futura de prestación de servicios",
  CSF: "CSF - Contrato de vigencia futura de servicios",
  CTF: "CTF - Contrato de vigencia futura",
  CUF: "CUF - Contrato de vigencia futura de suministro",
  CVF: "CVF - Contrato de vigencia futura de compra venta",
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

export async function llenarConstancia053(
  datos: Format053Data
): Promise<Uint8Array | null> {
  const template = await loadTemplate("template_053.json")
  if (!template) return null
  const [numero_orden, anio] = datos.orderNumberYear.split("/")

  return generate({
    template,
    inputs: [
      {
        sede: SEDE,
        dependencia: DEPENDENCIA,
        modalidad_contrato: CONTRACT_LABELS[datos.contractType],
        numero_orden,
        anio: `/${anio}`,
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
): Promise<Uint8Array | null> {
  const template = await loadTemplate("template_069.json")
  if (!template) return null

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
        aporte_pension: datos.isPensioner
          ? ""
          : peso(datos.pensionContribution),
        fondo_solidaridad: datos.isPensioner ? "" : peso(datos.solidarityFund),
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
  bytes053?: Uint8Array | null
  bytes069?: Uint8Array | null
  bytesPlanilla: Uint8Array
  bytesPlanilla2?: Uint8Array
  bytesARL: Uint8Array
}): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  const copiar = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes)
    const paginas = await merged.copyPages(doc, doc.getPageIndices())
    paginas.forEach((p) => merged.addPage(p))
  }

  if (bytes053) await copiar(bytes053)
  if (bytes069) await copiar(bytes069)
  await copiar(bytesPlanilla)
  if (bytesPlanilla2) await copiar(bytesPlanilla2)
  await copiar(bytesARL)

  return merged.save()
}
