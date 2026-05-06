import type { ExtractedData, ManualFormData } from "@/lib/types"
import type { ValidationSummary } from "@/lib/validations"

interface SourceText {
  paymentSheet: string
  arl: string
  contract: string
  contract2?: string
  paymentSheet2?: string
}

interface IntegrityInput {
  extracted: ExtractedData
  manual: ManualFormData
  sourceText: SourceText
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeText(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasPositiveStatus(text: string, value: string): boolean {
  const norm = normalizeText(value)
  const positiveKeywords = [
    "activo",
    "vigente",
    "cobertura",
    "cubierto",
    "afiliado",
    "si",
  ]

  // Si el valor extraído es positivo, aceptamos cualquier palabra clave positiva en el PDF
  if (positiveKeywords.some((kw) => norm.includes(kw))) {
    const normalizedText = normalizeText(text)
    // Intento 1: Coincidencia normal
    if (positiveKeywords.some((kw) => normalizedText.includes(kw))) return true
    // Intento 2: Sin espacios (para PDFs con interletrado extraño "C O B E R T U R A")
    const textNoSpaces = normalizedText.replace(/\s+/g, "")
    if (positiveKeywords.some((kw) => textNoSpaces.includes(kw))) return true
  }

  return hasWords(text, value)
}

function digitsOnly(value: string | number): string {
  return String(value).replace(/\D/g, "")
}

function hasWords(text: string, value: string): boolean {
  const normalizedText = normalizeText(text)
  const words = normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)

  return (
    words.length > 0 && words.every((word) => normalizedText.includes(word))
  )
}

function hasDigits(text: string, value: string | number): boolean {
  const expected = digitsOnly(value)
  if (!expected) return true
  return digitsOnly(text).includes(expected)
}

function hasLiteral(text: string, value: string): boolean {
  return normalizeText(text).includes(normalizeText(value))
}

function hasPeriod(text: string, value: string): boolean {
  const normalizedText = normalizeText(text)
  // Intentar coincidencia literal primero
  if (normalizedText.includes(normalizeText(value))) return true

  // Si es formato MM/YYYY, intentar variaciones
  const parts = value.split("/")
  if (parts.length === 2) {
    const [mm, yyyy] = parts
    const monthNum = parseInt(mm)
    if (!isNaN(monthNum)) {
      // Intentar YYYY-MM (común en PILA)
      if (normalizedText.includes(`${yyyy}-${mm}`)) return true
      // Intentar nombre del mes en español
      const months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
      ]
      const monthName = months[monthNum - 1]
      if (monthName && normalizedText.includes(monthName) && normalizedText.includes(yyyy)) return true
    }
  }

  return false
}

function addIfMissing(errors: string[], ok: boolean, message: string): void {
  if (!ok) errors.push(message)
}

function validatePaymentSheet(
  errors: string[],
  text: string,
  label: string,
  sheet: NonNullable<ExtractedData["paymentSheet"]>
): void {
  addIfMissing(
    errors,
    hasDigits(text, sheet.sheetNumber),
    `${label}: numero de planilla no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasPeriod(text, sheet.period),
    `${label}: periodo no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasDigits(text, sheet.documentNumber),
    `${label}: documento del cotizante no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasWords(text, sheet.contractorName),
    `${label}: nombre del cotizante no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasDigits(text, sheet.totalAmountPaid),
    `${label}: total pagado no coincide con el PDF adjunto.`
  )
}

function validateArl(
  errors: string[],
  text: string,
  arl: NonNullable<ExtractedData["arl"]>
): void {
  // Si el texto extraído es muy corto (< 100 caracteres), probablemente sea un escaneo/imagen.
  // En ese caso, confiamos en la validación visual que ya hizo la IA en el Paso 3.
  const isScan = normalizeText(text).length < 100

  addIfMissing(
    errors,
    isScan || hasDigits(text, arl.documentNumber),
    "ARL: documento del contratista no coincide con el PDF adjunto."
  )
  addIfMissing(
    errors,
    isScan || hasWords(text, arl.contractorName),
    "ARL: nombre del contratista no coincide con el PDF adjunto."
  )
  /*
  addIfMissing(
    errors,
    isScan || hasPositiveStatus(text, arl.coverageStatus),
    "ARL: estado de cobertura no coincide con el PDF adjunto."
  )
  */
  addIfMissing(
    errors,
    isScan || hasLiteral(text, arl.riskClass) || hasDigits(text, arl.riskClass),
    "ARL: clase de riesgo no coincide con el PDF adjunto."
  )
  addIfMissing(
    errors,
    isScan || hasDigits(text, arl.startDate),
    "ARL: fecha de inicio no coincide con el PDF adjunto."
  )
  addIfMissing(
    errors,
    isScan || hasDigits(text, arl.endDate),
    "ARL: fecha de fin no coincide con el PDF adjunto."
  )
}

function validateContract(
  errors: string[],
  text: string | undefined,
  label: string,
  contract: NonNullable<ExtractedData["contract"]>
): void {
  if (!text) {
    errors.push(`${label}: el PDF del contrato es obligatorio.`)
    return
  }

  addIfMissing(
    errors,
    hasWords(text, contract.contractType),
    `${label}: tipo de contrato no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasDigits(text, contract.orderNumber),
    `${label}: numero de orden no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasWords(text, contract.contractorName),
    `${label}: nombre del contratista no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasDigits(text, contract.documentNumber),
    `${label}: documento del contratista no coincide con el PDF adjunto.`
  )
  addIfMissing(
    errors,
    hasDigits(text, contract.totalValueBeforeTax),
    `${label}: valor total del contrato no coincide con el PDF adjunto.`
  )
}

export function validateNoBlockingResults(
  summary: Pick<ValidationSummary, "blocked" | "results">
): string[] {
  if (!summary.blocked) return []
  return summary.results
    .filter((result) => !result.ok && result.blocking)
    .map((result) => result.message)
}

export function validateExtractedDataIntegrity({
  extracted,
  manual,
  sourceText,
}: IntegrityInput): string[] {
  const errors: string[] = []

  if (!extracted.paymentSheet || !extracted.arl || !extracted.contract) {
    return [
      "Faltan datos extraidos para validar contra los documentos adjuntos.",
    ]
  }

  validatePaymentSheet(
    errors,
    sourceText.paymentSheet,
    "Planilla",
    extracted.paymentSheet
  )
  if (extracted.paymentSheet2) {
    validatePaymentSheet(
      errors,
      sourceText.paymentSheet2 ?? "",
      "Planilla 2",
      extracted.paymentSheet2
    )
  }
  validateArl(errors, sourceText.arl, extracted.arl)
  validateContract(errors, sourceText.contract, "Contrato", extracted.contract)

  if (manual.contractCount === "2" || extracted.contract2) {
    if (!extracted.contract2) {
      errors.push("Contrato 2: faltan datos extraidos del segundo contrato.")
    } else {
      validateContract(
        errors,
        sourceText.contract2,
        "Contrato 2",
        extracted.contract2
      )
    }
  }

  return errors
}
