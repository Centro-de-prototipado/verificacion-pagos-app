/**
 * Cálculo de fecha límite de pago de seguridad social (Decreto 780/2016 Art. 3.2.2.1).
 * La fecha límite se determina por los dos últimos dígitos del NIT/cédula del aportante.
 * Se paga en el mes siguiente al período de cotización.
 */

// Días hábiles límite según los dos últimos dígitos del documento
const TABLA_DIGITOS: Array<[number, number, number]> = [
  [0, 7, 2],
  [8, 14, 3],
  [15, 21, 4],
  [22, 28, 5],
  [29, 35, 6],
  [36, 42, 7],
  [43, 49, 8],
  [50, 56, 9],
  [57, 63, 10],
  [64, 69, 11],
  [70, 75, 12],
  [76, 81, 13],
  [82, 87, 14],
  [88, 93, 15],
  [94, 99, 16],
]

/** Easter Sunday for a given year (Anonymous Gregorian algorithm). */
function calcularEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Returns the next Monday on or after the given date (Ley Emiliani — puente). */
function nextMonday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun … 6=Sat
  if (dow === 1) return d
  d.setDate(d.getDate() + ((8 - dow) % 7))
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns all Colombian public holidays for a given year as a Set of YYYY-MM-DD strings.
 * Rules: fixed dates, "puente" dates (Ley Emiliani → next Monday), and Easter-relative dates.
 */
export function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>()

  // Fixed holidays (never moved)
  const fixed = [
    [1, 1], // Año Nuevo
    [5, 1], // Día del Trabajo
    [7, 20], // Independencia
    [8, 7], // Batalla de Boyacá
    [12, 8], // Inmaculada Concepción
    [12, 25], // Navidad
  ] as [number, number][]
  for (const [m, d] of fixed) {
    holidays.add(toKey(new Date(year, m - 1, d)))
  }

  // Puente holidays (Ley Emiliani — moved to next Monday)
  const puente = [
    [1, 6], // Reyes Magos
    [3, 19], // San José
    [6, 29], // San Pedro y San Pablo
    [8, 15], // Asunción de la Virgen
    [10, 12], // Día de la Raza
    [11, 1], // Todos los Santos
    [11, 11], // Independencia de Cartagena
  ] as [number, number][]
  for (const [m, d] of puente) {
    holidays.add(toKey(nextMonday(new Date(year, m - 1, d))))
  }

  // Easter-relative holidays
  const easter = calcularEaster(year)
  holidays.add(toKey(addDays(easter, -3))) // Jueves Santo
  holidays.add(toKey(addDays(easter, -2))) // Viernes Santo
  // These three are also moved to next Monday
  holidays.add(toKey(nextMonday(addDays(easter, 39)))) // Ascensión
  holidays.add(toKey(nextMonday(addDays(easter, 60)))) // Corpus Christi
  holidays.add(toKey(nextMonday(addDays(easter, 68)))) // Sagrado Corazón de Jesús

  return holidays
}

// Cache so we don't recompute on every call
const holidayCache = new Map<number, Set<string>>()

function esDiaHabil(date: Date): boolean {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false
  const year = date.getFullYear()
  if (!holidayCache.has(year)) holidayCache.set(year, getHolidaysForYear(year))
  return !holidayCache.get(year)!.has(toKey(date))
}

function nthDiaHabil(year: number, month: number, n: number): Date {
  const date = new Date(year, month - 1, 1)
  let count = 0
  while (count < n) {
    if (esDiaHabil(date)) count++
    if (count < n) date.setDate(date.getDate() + 1)
  }
  return date
}

function diasLimite(documentNumber: string): number {
  const digits = documentNumber.replace(/\D/g, "")
  const last2 = parseInt(digits.slice(-2), 10)
  for (const [min, max, dia] of TABLA_DIGITOS) {
    if (last2 >= min && last2 <= max) return dia
  }
  return 16 // fallback: último grupo
}

/** Returns the Nth business day assigned for a document number (for UI display). */
export function diasHabilAsignados(documentNumber: string): number {
  return diasLimite(documentNumber)
}

/**
 * Calcula la fecha límite de pago de seguridad social en formato DD/MM/YYYY.
 * @param period  Período cotizado en formato MM/YYYY (ej: "02/2026")
 * @param documentNumber  Cédula o NIT del contratista (sin dígito de verificación)
 */
export function calcularFechaLimite(
  period: string,
  documentNumber: string
): string {
  const [mm, yyyy] = period.split("/")
  const periodMonth = parseInt(mm, 10)
  const periodYear = parseInt(yyyy, 10)

  // El pago se hace en el mes siguiente al período
  const payMonth = periodMonth === 12 ? 1 : periodMonth + 1
  const payYear = periodMonth === 12 ? periodYear + 1 : periodYear

  const n = diasLimite(documentNumber)
  const deadline = nthDiaHabil(payYear, payMonth, n)

  const dd = String(deadline.getDate()).padStart(2, "0")
  const mStr = String(deadline.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mStr}/${deadline.getFullYear()}`
}
