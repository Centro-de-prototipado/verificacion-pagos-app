import type { ActivityReportData, ContractData, ValidationResult } from "@/lib/types"

/**
 * Helper to check if a date is within N business days of another.
 */
function isRecent(dateStr: string, referenceDate: Date, maxDays: number): boolean {
  const [d, m, y] = dateStr.split("/").map(Number)
  const target = new Date(y, m - 1, d)

  if (target > referenceDate) return true // Signed in the future? Treat as ok for this check

  let businessDays = 0
  const current = new Date(target)

  while (current < referenceDate) {
    current.setDate(current.getDate() + 1)
    const day = current.getDay()
    if (day !== 0 && day !== 6) { // Not Sat/Sun
      businessDays++
    }
    if (businessDays > 30) break // Safety
  }

  return businessDays <= maxDays
}

/**
 * Normalizes a name string by removing accents and converting to lowercase.
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Validates the activity report against business rules and contract data.
 */
export function validarInformeActividades(
  data: ActivityReportData,
  contract: ContractData
): ValidationResult[] {
  const results: ValidationResult[] = []

  // 1. Columnas de porcentajes: Periodo (%) <= Acumulada a la fecha (%)
  const tableOk = data.items.every(
    (item) => item.periodPercentage <= item.accumulatedPercentage
  )
  if (!tableOk) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: "En la tabla de actividades, el % Periodo debe ser menor o igual al % Acumulado en todos los items.",
    })
  }

  // 2. Actividades ejecutadas diligenciadas
  const itemsDiligenciados = data.items.length > 0 && data.items.every(
    (item) => item.activityDescription.trim().length > 0
  )
  if (!itemsDiligenciados) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: "Todas las filas de la columna ACTIVIDADES EJECUTADAS deben estar diligenciadas en el informe de actividades.",
    })
  }

  // 3. Fecha de firma reciente (máx 3 días hábiles)
  const processingDate = new Date()
  if (!isRecent(data.signatureDate, processingDate, 3)) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: `La fecha de firma del informe de actividades (${data.signatureDate}) es demasiado antigua. No debe superar los 3 días hábiles de antigüedad respecto a hoy.`,
    })
  }

  // 4. Firma (isSigned)
  if (!data.isSigned) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: "El informe de actividades no parece estar firmado.",
    })
  }

  // 4. Periodo del informe Desde vs Contrato Inicio
  if (data.periodFrom !== contract.startDate) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: `El periodo del contrato 'Desde' (${data.periodFrom}) en el informe de actividades debe coincidir con la fecha de inicio del contrato (${contract.startDate}).`,
    })
  }

  // 5. Periodo del informe Hasta vs Fecha Firma
  if (data.periodTo !== data.signatureDate) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: `El periodo del contrato 'Hasta' (${data.periodTo}) en el informe de actividades debe coincidir con la fecha de firma del informe (${data.signatureDate}).`,
    })
  }

  // 6. Plazo OPS
  if (data.opsStartDate !== contract.startDate) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: `La fecha de inicio en PLAZO OPS (${data.opsStartDate}) en el informe de actividades debe coincidir con el contrato (${contract.startDate}).`,
    })
  }
  if (data.opsEndDate !== contract.endDate) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message: `La fecha de terminación en PLAZO OPS (${data.opsEndDate}) en el informe de actividades debe coincidir con el contrato (${contract.endDate}).`,
    })
  }

  // 7. Nombre del contratista y C.C.
  if (normalizeName(data.contractorName) !== normalizeName(contract.contractorName)) {
    results.push({
      ok: false,
      blocking: true,
      type: "report",
      message: `El nombre del contratista en el informe (${data.contractorName}) no coincide con el del contrato (${contract.contractorName}).`,
    })
  }
  const cleanDocReport = data.documentNumber.replace(/\D/g, "")
  const cleanDocContract = contract.documentNumber.replace(/\D/g, "")
  if (cleanDocReport !== cleanDocContract) {
    results.push({
      ok: false,
      blocking: true,
      type: "report",
      message: `El número de documento en el informe (${data.documentNumber}) no coincide con el del contrato (${contract.documentNumber}).`,
    })
  }

  // Si todo está bien, añadir un OK general
  if (results.length === 0) {
    results.push({
      ok: true,
      blocking: false,
      type: "report",
      message: "Informe de actividades validado correctamente.",
    })
  }

  return results
}
