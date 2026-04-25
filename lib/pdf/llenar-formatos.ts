import path from "path"
import { readFile } from "fs/promises"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { ContractType, Format053Data, Format069Data } from "@/lib/types"
import { SEDE, DEPENDENCIA } from "@/lib/validations/constantes"


// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = path.join(process.cwd(), "lib", "templates")
const PH = 792 // Altura de página US Letter en puntos

// Etiquetas completas de tipo de contrato para el formato 053
// TODO: confirmar texto exacto de cada tipo en el dropdown del template
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

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

/** Número con separadores colombianos: 218900 → "218.900" */
function num(value: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(value))
}

/** Valor para celdas de aportes: positivo → "$ 218.900", cero → "$ -" */
function peso(value: number): string {
  return value > 0 ? `$ ${num(value)}` : "$ -"
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.053 — Constancia de cumplimiento contractual
// ---------------------------------------------------------------------------
//
// Coordenadas derivadas de lib/templates/structure_053.json.
// Sistema de referencia structure JSON: y=0 en la parte superior de la página.
// pdf-lib: y=0 en la parte inferior → y_pdflib = PH − yTop_struct.
//
// Líneas horizontales de la tabla: y_struct = 147.5, 169.5, 215.5, 237.5,
//   259.5, 281.5, 383.5, 503.5, 634.5, 677.5.

export async function llenarConstancia053(
  datos: Format053Data
): Promise<Uint8Array> {
  const templateBytes = await readFile(
    path.join(
      TEMPLATES_DIR,
      "U.FT.12.010.053_Constancia_de_cumplimiento_contractual_V4.0.docx.pdf"
    )
  )

  const doc = await PDFDocument.load(templateBytes)
  const [font, fontBold] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ])
  const page = doc.getPages()[0]

  /**
   * Dibuja texto. yTop es la coordenada "structure" (y=0 arriba).
   * El baseline del texto queda aproximadamente en PH − yTop.
   */
  const draw = (
    text: string,
    x: number,
    yTop: number,
    size = 9,
    bold = false
  ) =>
    page.drawText(text, {
      x,
      y: PH - yTop,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    })

  /** Rectángulo blanco para cubrir contenido existente del template. */
  const blank = (x: number, yTop: number, w: number, h: number) =>
    page.drawRectangle({
      x,
      y: PH - yTop - h,
      width: w,
      height: h + 1,
      color: rgb(1, 1, 1),
    })

  /** Texto centrado horizontalmente en la página (ancho = 612 pt). */
  const drawC = (text: string, yTop: number, size = 9, bold = false) => {
    const f = bold ? fontBold : font
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: (612 - w) / 2,
      y: PH - yTop,
      size,
      font: f,
      color: rgb(0, 0, 0),
    })
  }

  // ── Encabezado: SEDE y DEPENDENCIA ────────────────────────────────────────
  //
  // [SEDE] placeholder: x0=293.5, top=81.7, x1=323.0 — texto centrado
  // [NOMBRE DE LA DEPENDENCIA]: x0=238.0, top=92.1, x1=378.5 — texto centrado

  blank(185, 77, 250, 14)
  drawC(SEDE, 86, 8, true)

  blank(185, 88, 250, 14)
  drawC(DEPENDENCIA, 97, 7.5, true)

  // ── Sección 1: Tabla contractual ──────────────────────────────────────────
  //
  // Fila entre líneas y=169.5 y y=215.5:
  //   Col izquierda: "Elija la modalidad…" (label top=178.5–200.5)
  //   Col modalidad: "Elija un elemento." placeholder top=176.2, x0=154.5, x1=239.5
  //   Col Número/Año: headers "Número" top=183, "/Año" top=195.2 (no blanquear)
  //   Col Adición: top=176.9, x=408.8
  //   Col Otrosí: top=176.9, x=501.0

  // Sólo blanquear el placeholder "Elija un elemento." — no tocar los headers de las otras columnas
  blank(154, 172, 163, 15)
  draw(CONTRACT_LABELS[datos.contractType], 155, 183, 7.5)

  // Número/Año — dibujar bajo los headers, sin blanquear
  draw(datos.orderNumberYear, 318, 207, 8)

  if (datos.amendmentLabel) {
    // Sólo blanquear la celda de datos del Otrosí (bajo el header), no el header
    blank(501, 201, 91, 15)
    draw(datos.amendmentLabel, 502, 211, 8)
  }

  // CÓDIGO EMPRESA SGF – QUIPU (fila y=215.5–237.5; label top=223.2)
  draw(datos.quipuCompany, 180, 231, 9, true)

  // CONTRATISTA (fila y=237.5–259.5; label top=245.2)
  draw(datos.contractorName, 180, 252, 9, true)

  // IDENTIFICACIÓN CONTRATISTA (fila y=259.5–281.5; label top=267.2)
  draw(datos.documentNumber, 185, 274, 9)

  // ── Sección 2: Párrafo planilla / fecha / período ─────────────────────────
  //
  // "…planilla (s) número (s) ________ de"  → blank x0=272.3, top=298.3
  // "fecha (s) _____________ en"            → blank x0=83.0, top=310.5
  // "____________________."                 → blank x0=42.0, top=347.2 (línea siguiente a "de")

  blank(272, 294, 48, 14)
  draw(datos.sheetNumber, 272, 302, 8.5)

  blank(83, 306, 68, 14)
  draw(datos.paymentDate, 83, 315, 8.5)

  // El período va en la siguiente línea (top=347.2), no tras "de" en la línea anterior
  blank(42, 343, 105, 14)
  draw(datos.payrollPeriodName + ".", 42, 351, 9)

  // ── Sección 4: Se autoriza el pago ───────────────────────────────────────
  //
  // Checkboxes (carácter "☐" en template) a x=42–52:
  //   Parcial top=410.8  |  Final top=435.4  |  Único top=460.3
  //
  // Labelling:
  //   "No.____," top=411.9, x=92–128.6
  //   "$__________" top=411.9, x=182.1–276.8  (Parcial)
  //   "$" + blank top=436.5, x=138.2–275      (Final)
  //   "$" + blank top=461.4, x=142.2–276.7    (Único)

  const checkYByType: Record<typeof datos.paymentType, number> = {
    Parcial: 415,
    Final: 440,
    Único: 465,
  }
  draw("X", 45, checkYByType[datos.paymentType], 9, true)

  if (datos.paymentType === "Parcial") {
    blank(92, 408, 40, 14)
    draw(`No.${datos.paymentNumber},`, 92, 416, 8.5)
    blank(182, 407, 96, 15)
    draw(`$ ${num(datos.amountToCharge)}`, 182, 416, 8.5)
  } else if (datos.paymentType === "Final") {
    blank(138, 432, 140, 15)
    draw(`$ ${num(datos.amountToCharge)}`, 138, 441, 8.5)
  } else {
    // Único
    blank(142, 457, 137, 15)
    draw(`$ ${num(datos.amountToCharge)}`, 142, 466, 8.5)
  }

  // ── Sección 5: Nivel de satisfacción — siempre Excelente (5) ─────────────
  // Checkbox "Excelente (5)" top=444.3, x=349.5
  draw("X", 352, 449, 9, true)

  // ── Sección 6: Informe de actividades ────────────────────────────────────
  // SI checkbox:  top=429.1, x=482.3
  // N/A checkbox: top=459.6, x=482.3
  if (datos.activityReportReceived === true) {
    draw("X", 485, 433, 9, true)
  } else if (datos.activityReportReceived === "N/A") {
    draw("X", 485, 463, 9, true)
  }

  // ── Línea de expedición ────────────────────────────────────────────────────
  // "…en la ciudad de _______,  el día [date picker]…"
  // Ciudad blank top=507, x=377.1
  // Date picker "Haga clic aquí…" top=506.6, x=445.3 (continúa en top=520.9)

  blank(377, 502, 44, 15)
  draw("Manizales,", 377, 511, 9)

  blank(445, 501, 140, 32)
  draw(datos.expeditionDate, 445, 511, 9)

  return doc.save()
}

// ---------------------------------------------------------------------------
// Formato U.FT.12.010.069 — Certificación determinación cedular
// ---------------------------------------------------------------------------
//
// Coordenadas derivadas de lib/templates/structure_069.json.
// Sin líneas horizontales detectadas → se usan posiciones de etiquetas como
// referencia vertical para cada fila.

export async function llenarCertificacion069(
  datos: Format069Data
): Promise<Uint8Array> {
  const templateBytes = await readFile(
    path.join(
      TEMPLATES_DIR,
      "U-FT-12.010.069_Certificacion_determinacion_cedular_Rentas_de_Trabajo_V.6.0.VF.pdf"
    )
  )

  const doc = await PDFDocument.load(templateBytes)
  const [font, fontBold] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ])
  const page = doc.getPages()[0]

  const draw = (
    text: string,
    x: number,
    yTop: number,
    size = 9,
    bold = false
  ) =>
    page.drawText(text, {
      x,
      y: PH - yTop,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    })

  const blank = (x: number, yTop: number, w: number, h: number) =>
    page.drawRectangle({
      x,
      y: PH - yTop - h,
      width: w,
      height: h + 1,
      color: rgb(1, 1, 1),
    })

  /** Texto alineado a la derecha: el borde derecho del texto toca xRight. */
  const drawR = (text: string, xRight: number, yTop: number, size = 8) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: xRight - w,
      y: PH - yTop,
      size,
      font,
      color: rgb(0, 0, 0),
    })
  }

  // ── Sección 1: Datos generales ────────────────────────────────────────────
  //
  // Fila 1 top≈187.6:
  //   "Nombre del Contratista" label (x=35–98.7) → valor en celda x≈163
  //   "Fecha de diligenciamiento" label (x=393.2) → valor x≈471
  draw(datos.contractorName, 163, 194, 8.5, true)
  draw(datos.processingDate, 471, 194, 8.5)

  // Fila 2 top≈203.1:
  //   "Tipo y número de documento…" label → valor x≈163
  //   "¿Es usted pensionado?" → template tiene "NO" en top=203.5, x=540.1
  draw(`${datos.documentType} ${datos.documentNumber}`, 163, 209, 8.5)
  blank(536, 199, 25, 14)
  draw(datos.isPensioner ? "SI" : "NO", 537, 209, 8.5)

  // Fila 3 top≈216.1:
  //   "Correo institucional" label (x=35–89.3) → valor x≈163
  draw(datos.institutionalEmail, 163, 222, 8.5)

  // ── Sección 2: Relación de contratos ─────────────────────────────────────
  //
  // "UNIVERSIDAD NACIONAL DE COLOMBIA" está preimpreso (col 1).
  // Fila de datos top≈301.6–308.8; centro top≈305.
  //
  // Columnas (basadas en headers top=249–263):
  //   Empresa en QUIPU:  x≈154
  //   Tipo Orden:        x≈215
  //   Número Orden:      x≈283
  //   Valor Total:       right-aligned x≈393
  //   Fecha Inicio:      x≈400
  //   Fecha Terminación: x≈462
  //   Clase Riesgos:     x≈518

  const ROW1 = 308
  draw(datos.quipuCompany, 154, ROW1, 8)
  draw(datos.contractType, 215, ROW1, 8)
  draw(datos.orderNumber, 283, ROW1, 8)
  drawR(`$ ${num(datos.contractTotalValue)}`, 393, ROW1, 8)
  draw(datos.startDate, 400, ROW1, 8)
  draw(datos.endDate, 462, ROW1, 8)
  draw(datos.riskClassLabel, 518, ROW1, 8)

  // Segunda fila de contrato (cuando contractCount === "2")
  if (datos.contract2Type && datos.contract2OrderNumber && datos.contract2TotalValue != null) {
    const ROW2 = ROW1 + 10
    draw(datos.quipuCompany, 154, ROW2, 8)
    draw(datos.contract2Type, 215, ROW2, 8)
    draw(datos.contract2OrderNumber, 283, ROW2, 8)
    drawR(`$ ${num(datos.contract2TotalValue)}`, 393, ROW2, 8)
    if (datos.contract2StartDate) draw(datos.contract2StartDate, 400, ROW2, 8)
    if (datos.contract2EndDate) draw(datos.contract2EndDate, 462, ROW2, 8)
    draw(datos.riskClassLabel, 518, ROW2, 8)
  }

  // Fila TOTAL top=344.6: "$" en x=335.4, "-" en x=383.9
  const totalContractValue =
    datos.contractTotalValue + (datos.contract2TotalValue ?? 0)
  blank(335, 340, 60, 14)
  drawR(`$ ${num(totalContractValue)}`, 393, 347, 8)

  // ── Sección 3: Anexos ────────────────────────────────────────────────────
  //
  // "Solicito aplicar mis deducciones al contrato No." termina x1=154.4, top=432.3
  draw(datos.deductionsContractRef, 155, 436, 8.5)

  // "Periodo de solicitud de pago" termina x1≈106.6, top=516.6
  draw(datos.paymentRequestPeriod, 112, 520, 8.5)

  // "Periodo de la planilla" termina x1≈87.3, top=526.7
  draw(datos.payrollPeriod, 93, 530, 8.5)

  // ── Sección 4: Cálculo aportes (columna derecha) ──────────────────────────
  //
  // Template tiene "$" en x=514.7 y "-" en x=565.7 por fila.
  // Cubrir y right-align al borde x=576.
  //
  //   Salud (12,5%):              top≈432–436
  //   Pensión (16%):              top≈447–451
  //   Fondo de solidaridad:       top≈467–471
  //   Aportes Riesgos Laborales:  top≈490–495
  //   Total Aportes Obligatorios: top≈505–510

  const writeAporte = (valor: number, yTop: number) => {
    blank(514, yTop - 4, 63, 14)
    drawR(peso(valor), 576, yTop, 8)
  }

  writeAporte(datos.healthContribution, 436)
  writeAporte(datos.pensionContribution, 451)
  writeAporte(datos.solidarityFund, 471)
  writeAporte(datos.arlContribution, 495)
  writeAporte(datos.totalObligatory, 510)

  // ── Declaración formal ────────────────────────────────────────────────────
  //
  // Template preimprime "NO" en top=580.8, x=302.7.
  // Siempre cubrir y escribir el valor real.
  blank(300, 577, 18, 12)
  draw(datos.formalDeclaration, 300, 584, 9, true)

  // ── Sección 5 / 6: Mensualización + Base de retención ────────────────────
  //
  // Tabla unificada. Posiciones de columnas desde placeholders "$" y "-" top≈668.3:
  //   Col 1 Valor Mensualizado:  "$" x=37.6,  "-" x=125.4 → right edge ≈128
  //   Col 2 Nro Meses:           "0" x=160.9              → right edge ≈170
  //   Col 3 IBC (40%):           "$" x=191.3, "-" x=270.1 → right edge ≈273
  //   Col 4 Salud (12,5):        "$" x=335.8, "-" x=381.3 → right edge ≈384
  //   Col 5 Pensión (16%):       "$" x=395.4, "-" x=441.1 → right edge ≈444
  //   Col 6 Solidaridad:         "$" x=455.1, "-" x=500.9 → right edge ≈503
  //   Col 7 Base Retención:      "$" x=514.1, "-" x=573.2 → right edge ≈576
  //
  // Primera fila de datos top=668.3 → usamos 671 como yTop de referencia.
  // Fila TOTAL top=713.1 → usamos 715.

  const MS1 = 671

  blank(37, MS1 - 4, 93, 13)
  drawR(`$ ${num(datos.monthlyValue)}`, 128, MS1, 8)

  blank(145, MS1 - 4, 28, 13)
  draw(String(datos.contractMonths), 152, MS1, 8)

  blank(191, MS1 - 4, 84, 13)
  drawR(`$ ${num(datos.ibc)}`, 273, MS1, 8)

  blank(335, MS1 - 4, 51, 13)
  drawR(peso(datos.healthContribution), 384, MS1, 8)

  blank(395, MS1 - 4, 51, 13)
  drawR(peso(datos.pensionContribution), 444, MS1, 8)

  blank(455, MS1 - 4, 50, 13)
  drawR(peso(datos.solidarityFund), 503, MS1, 8)

  blank(514, MS1 - 4, 63, 13)
  drawR(`$ ${num(datos.monthlyRetentionBase)}`, 576, MS1, 8)

  // Fila TOTAL: col 1 (valor mensualizado), col 3 (base de cálculo), col 7 (retención)
  // Base de cálculo = max(IBC, SMMLV) = healthContribution / 12.5%
  const calculationBase = Math.round(datos.healthContribution / 0.125)

  const MST = 715
  blank(37, MST - 4, 93, 13)
  drawR(`$ ${num(datos.monthlyValue)}`, 128, MST, 8)

  blank(191, MST - 4, 84, 13)
  drawR(`$ ${num(calculationBase)}`, 273, MST, 8)

  blank(514, MST - 4, 63, 13)
  drawR(`$ ${num(datos.monthlyRetentionBase)}`, 576, MST, 8)

  // ── Sección 7: Firma del contratista ──────────────────────────────────────
  //
  // "Nombre:" top=586.3, x=393.1–412.8 → valor a x≈415
  // "Número de documento de identificación" top=601.1–607.2 → valor a x≈430
  draw(datos.signerName, 415, 590, 8)
  draw(datos.signerDocumentRef, 430, 606, 8)

  return doc.save()
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

// nombreArchivoFinal se movió a ./utils.ts para permitir su uso en el cliente
