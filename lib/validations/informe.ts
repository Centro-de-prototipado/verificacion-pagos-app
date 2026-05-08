import type {
  ActivityReportData,
  ContractData,
  ValidationResult,
} from "@/lib/types"
import { esDiaHabil } from "./fecha-limite"

/**
 * Helper to check if a date is within N business days of another.
 * Uses the full Colombian holiday calendar from esDiaHabil.
 */
function isRecent(
  dateStr: string,
  referenceDate: Date,
  maxDays: number
): boolean {
  const [d, m, y] = dateStr.split("/").map(Number)
  const target = new Date(y, m - 1, d)

  if (target > referenceDate) return true

  let businessDays = 0
  const current = new Date(target)

  while (current < referenceDate) {
    current.setDate(current.getDate() + 1)
    if (esDiaHabil(current)) businessDays++
    if (businessDays > 30) break
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
      message:
        "En la tabla de actividades, el % Periodo debe ser menor o igual al % Acumulado en todos los items.",
    })
  }

  // 2. Actividades ejecutadas diligenciadas
  const itemsDiligenciados =
    data.items.length > 0 &&
    data.items.every((item) => item.activityDescription.trim().length > 0)
  if (!itemsDiligenciados) {
    results.push({
      ok: false,
      blocking: false,
      type: "report",
      message:
        "Todas las filas de la columna ACTIVIDADES EJECUTADAS deben estar diligenciadas en el informe de actividades.",
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
  if (
    normalizeName(data.contractorName) !==
    normalizeName(contract.contractorName)
  ) {
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

  // 8. Validación de Obligaciones Específicas
  if (contract.specificObligations && contract.specificObligations.length > 0) {
    if (data.items.length === 0) {
      results.push({
        ok: false,
        blocking: true,
        type: "report",
        message:
          "No se extrajeron actividades del informe. Por favor, usa el botón 'Analizar con IA' o ingresa las obligaciones manualmente en el editor de abajo.",
      })
      return results
    }

    const reportActivities = data.items.map((item) => item.activityDescription)

    // Función de similitud mejorada: más flexible con puntuación y longitud de palabras
    const getSimilarity = (s1: string, s2: string) => {
      const clean = (text: string) =>
        normalizeName(text)
          .replace(/^([a-z0-9][\.\-\)]\s*)+/i, "") // Quitar numeración inicial
          .replace(/[.,;:\(\)\[\]\-_]/g, " ") // Quitar toda la puntuación
          .split(/\s+/)
          .filter((w) => w.length > 2) // Palabras significativas

      const w1 = clean(s1)
      const w2 = clean(s2)

      if (w1.length === 0 || w2.length === 0) return 0

      const set2 = new Set(w2)
      let matches = 0
      w1.forEach((w) => {
        if (set2.has(w)) matches++
      })

      // Similitud: proporción de palabras coincidentes sobre el conjunto más PEQUEÑO
      // Esto permite que si el reporte tiene un "resumen" de la obligación, el match sea alto.
      return matches / Math.min(w1.length, w2.length)
    }

    const missingObligations: { text: string; bestScore: number }[] = []

    for (const contractObligation of contract.specificObligations) {
      let maxScore = 0
      for (const reportActivity of reportActivities) {
        const score = getSimilarity(contractObligation, reportActivity)
        if (score > maxScore) maxScore = score
      }

      // Bajamos el umbral a 0.3 (30%) para ser absurdamente permisivos y ver qué pasa
      if (maxScore < 0.3) {
        missingObligations.push({
          text: contractObligation,
          bestScore: maxScore,
        })
      }
    }

    if (missingObligations.length > 0) {
      results.push({
        ok: false,
        blocking: true,
        type: "report",
        message: `El informe no incluye todas las obligaciones específicas:\n${missingObligations
          .map((o) => `• ${o.text}`)
          .join("\n")}`,
      })
    }
  }

  // Si todo está bien, añadir un OK general
  if (results.length === 0) {
    results.push({
      ok: true,
      blocking: false,
      type: "report",
      message:
        "El informe está perfecto y cumple con todas las verificaciones.",
    })
  }

  return results
}
