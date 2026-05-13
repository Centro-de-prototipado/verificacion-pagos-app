import type {
  ARLData,
  PaymentSheetData,
  ContractData,
  ContractType,
  DocumentType,
  RiskClass,
} from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MaybeString = string | null

const DATE_RE = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/

/** Searches for one of the labels in text, then tries to match valuePattern in the chars after it. */
function findNear(
  text: string,
  labels: string[],
  valuePattern: RegExp,
  windowSize = 120
): MaybeString {
  const lower = text.toLowerCase()
  for (const label of labels) {
    const idx = lower.indexOf(label.toLowerCase())
    if (idx === -1) continue
    const window = text.slice(idx, idx + windowSize)
    const match = window.match(valuePattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

/** Normalizes date to DD/MM/YYYY regardless of input format. */
function normalizeDate(raw: MaybeString): MaybeString {
  if (!raw) return null
  const iso = raw.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const dmy = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  return raw
}

/**
 * Fixes dates that PDF-to-text splits across lines.
 * e.g. "2026-01\n-26" → "2026-01-26"
 *      "15/01\n/2026" → "15/01/2026"
 */
export function joinSplitDates(text: string): string {
  return (
    text
      // ISO split: "2026-01\n-26" or "2026-01 \n -26"
      .replace(/(\d{4}-\d{2})\s*\n\s*(-\d{2})\b/g, "$1$2")
      // DMY split: "15/01\n/2026" or "15/01 \n /2026"
      .replace(/(\d{2}\/\d{2})\s*\n\s*(\/\d{4})\b/g, "$1$2")
  )
}

/** Parses a Colombian currency string into a plain number. */
function parseAmount(raw: MaybeString): number | null {
  if (!raw) return null
  const n = parseFloat(
    raw
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, "")
  )
  return isNaN(n) ? null : Math.round(n)
}

/**
 * Tries to extract a pair of dates from a range expression like:
 *   "del 01/01/2026 al 31/12/2026"
 *   "desde 2026-01-01 hasta 2026-12-31"
 *   "01/01/2026 - 31/12/2026"  (or –, —)
 * Returns [startDate, endDate] in DD/MM/YYYY or null if not found.
 */
function extractDateRange(text: string): [MaybeString, MaybeString] {
  const D = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/

  // "del/desde <date> al/hasta <date>"
  const verbMatch = text.match(
    new RegExp(
      `(?:del|desde)\\s+${D.source}\\s+(?:al|hasta)\\s+${D.source}`,
      "i"
    )
  )
  if (verbMatch)
    return [normalizeDate(verbMatch[1]), normalizeDate(verbMatch[2])]

  // "<date> - <date>" or "<date> – <date>" (dash-separated range)
  const dashMatch = text.match(
    new RegExp(`${D.source}\\s*[-–—]\\s*${D.source}`)
  )
  if (dashMatch)
    return [normalizeDate(dashMatch[1]), normalizeDate(dashMatch[2])]

  return [null, null]
}

// ─── ARL entity-specific label tables ─────────────────────────────────────────

const ARL_START_LABELS: Record<string, string[]> = {
  sura: [
    "fecha de vigencia inicial",
    "vigencia inicial",
    "fecha inicio afiliación",
    "fecha de inicio",
  ],
  positiva: [
    "fecha inicio afiliación",
    "inicio de afiliación",
    "fecha inicio de afiliación",
    "vigencia desde",
  ],
  colmena: [
    "fecha inicio cobertura",
    "inicio de cobertura",
    "fecha de inicio de cobertura",
  ],
  colpatria: ["vigencia desde", "fecha de inicio", "inicio vigencia"],
  liberty: ["effective date", "fecha inicio", "fecha de inicio"],
  equidad: ["vigencia inicial", "fecha inicio", "inicio de vigencia"],
  bolivar: ["vigencia desde", "fecha inicio poliza", "inicio de poliza"],
  mapfre: ["fecha inicio", "vigencia desde", "inicio de vigencia"],
}

const ARL_END_LABELS: Record<string, string[]> = {
  sura: [
    "fecha de vigencia final",
    "vigencia final",
    "fecha fin afiliación",
    "fecha de fin",
  ],
  positiva: [
    "fecha fin afiliación",
    "fin de afiliación",
    "fecha fin de afiliación",
    "vigencia hasta",
  ],
  colmena: [
    "fecha fin cobertura",
    "fin de cobertura",
    "fecha de fin de cobertura",
  ],
  colpatria: ["vigencia hasta", "fecha de fin", "fin vigencia"],
  liberty: ["expiration date", "fecha fin", "fecha de fin"],
  equidad: ["vigencia final", "fecha fin", "fin de vigencia"],
  bolivar: ["vigencia hasta", "fecha fin poliza", "fin de poliza"],
  mapfre: ["fecha fin", "vigencia hasta", "fin de vigencia"],
}

const ARL_RATE_LABELS: Record<string, string[]> = {
  sura: ["porcentaje de cotización", "tasa de cotización arl", "tasa arl"],
  positiva: ["tasa cotización", "porcentaje arl", "tasa de aporte"],
  colmena: ["tasa de cotización", "porcentaje cotización", "tasa:"],
  default: [
    "tasa de cotización",
    "tasa cotización",
    "cotización arl",
    "porcentaje arl",
    "tasa:",
  ],
}

const DEFAULT_START_LABELS = [
  "fecha inicio",
  "inicio cobertura",
  "vigencia desde",
  "inicio de vigencia",
  "fecha de inicio",
  "desde el",
  "inicio:",
]
const DEFAULT_END_LABELS = [
  "fecha fin",
  "fin cobertura",
  "vigencia hasta",
  "fecha de fin",
  "hasta el",
  "fecha de vencimiento",
  "vence",
  "fin:",
]

// ─── ARL ─────────────────────────────────────────────────────────────────────

export function extractARLCandidates(text: string): Partial<ARLData> {
  // Caller must pass already-normalized text (joinSplitDates applied).
  const flatText = text.replace(/\s+/g, " ")
  const issuer = detectIssuer(flatText, "arl")
  const rateLabels = ARL_RATE_LABELS[issuer] ?? ARL_RATE_LABELS.default

  // ── Dates ──────────────────────────────────────────────────────────────────
  // Strategy 0: Explicit contract date labels (prioritized over everything else)
  const explicitStartLabels = [
    "fecha inicio contrato",
    "fecha de inicio del contrato",
    "fecha de inicio contrato",
  ]
  const explicitEndLabels = [
    "fecha fin contrato",
    "fecha de fin contrato",
    "fecha de terminación del contrato",
    "fecha terminación contrato",
  ]

  let startDate = normalizeDate(
    findNear(flatText, explicitStartLabels, DATE_RE)
  )
  let rawEnd = normalizeDate(findNear(flatText, explicitEndLabels, DATE_RE))
  let endDate = rawEnd !== startDate ? rawEnd : null

  // Specific fix for Positiva's table layout where the date is visually *under* the
  // "Fecha inicio contrato" header, meaning the PDF parser puts the date *before* the label.
  if (
    !startDate &&
    issuer === "positiva" &&
    flatText.toLowerCase().includes("fecha inicio contrato")
  ) {
    const preTipoMatch = flatText.match(
      new RegExp(`(${DATE_RE.source})\\s+tipo de vinculación`, "i")
    )
    if (preTipoMatch) {
      startDate = normalizeDate(preTipoMatch[1])
    }
  }

  // Strategy 1: scan for full ISO dates (YYYY-MM-DD) — most reliable after
  // joinSplitDates fixes the line-broken format used by Sura and others.
  if (!startDate || !endDate) {
    const isoDates = [...flatText.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(
      (m) => m[0]
    )
    startDate ??= isoDates[0] ? normalizeDate(isoDates[0]) : null
    endDate ??=
      isoDates[1] && isoDates[1] !== isoDates[0]
        ? normalizeDate(isoDates[1])
        : null
  }

  // Strategy 2: range patterns ("del … al", "desde … hasta", "date – date")
  if (!startDate || !endDate) {
    const [rs, re] = extractDateRange(flatText)
    startDate ??= rs
    endDate ??= re
  }

  // Strategy 3: individual label search (DD/MM/YYYY providers)
  if (!startDate || !endDate) {
    const startLabels = [
      ...(ARL_START_LABELS[issuer] ?? []),
      ...DEFAULT_START_LABELS,
    ]
    const endLabels = [...(ARL_END_LABELS[issuer] ?? []), ...DEFAULT_END_LABELS]
    startDate ??= normalizeDate(findNear(flatText, startLabels, DATE_RE))
    rawEnd = normalizeDate(findNear(flatText, endLabels, DATE_RE))
    endDate ??= rawEnd !== startDate ? rawEnd : null
  }

  // Strategy 4: scan all DMY dates as last resort (handles Sura Tipo 2 where
  // dates appear concatenated: "01/02/2026 31/12/2026Fecha fin cobertura:")
  if (!startDate || !endDate) {
    const dmyMatches = [...flatText.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map(
      (m) => m[1]
    )
    startDate ??= dmyMatches[0] ?? null
    endDate ??=
      dmyMatches[1] && dmyMatches[1] !== dmyMatches[0]
        ? dmyMatches[1]
        : null
  }

  // ── Rest of fields ─────────────────────────────────────────────────────────
  // Sura uses "EN COBERTURA" (active) and "MORA" (late payment, treated as inactive).
  const statusRaw = /\ben\s+cobertura\b/i.test(flatText)
    ? "ACTIVA"
    : /\bactiva\b/i.test(flatText)
      ? "ACTIVA"
      : /\bsuspendida\b/i.test(flatText)
        ? "SUSPENDIDA"
        : /\binactiva\b/i.test(flatText)
          ? "INACTIVA"
          : /\ben\s+mora\b/i.test(flatText) || /\bmora\b/i.test(flatText)
            ? "INACTIVA"
            : null

  const rateRaw = findNear(flatText, rateLabels, /([\d]+[.,][\d]+)(?:\s*%)?/)

  const riskRaw = findNear(
    flatText,
    [
      "clase de riesgo",
      "nivel de riesgo",
      "riesgo laboral",
      "clasificación de riesgo",
      "clase riesgo",
      "riesgo",
    ],
    /\b([IVX]{1,3}|[1-5])\b/
  )

  // Normalize arabic numerals → roman (some ARL formats print "2" instead of "II")
  const ARABIC_TO_ROMAN: Record<string, RiskClass> = {
    "1": "I",
    "2": "II",
    "3": "III",
    "4": "IV",
    "5": "V",
  }
  const riskNormalized = riskRaw
    ? (ARABIC_TO_ROMAN[riskRaw] ?? (riskRaw as RiskClass))
    : undefined

  return {
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
    coverageStatus: (statusRaw as ARLData["coverageStatus"]) ?? undefined,
    riskClass: riskNormalized,
    cotizationRate: rateRaw ? parseFloat(rateRaw.replace(",", ".")) : undefined,
  }
}

/**
 * Extracts the ARL document generation/expedition date from raw text.
 * Used separately to validate that the certificate is < 30 days old.
 * Returns DD/MM/YYYY or null.
 */
export function extractARLExpeditionDate(text: string): string | null {
  const flat = text.replace(/\s+/g, " ")

  // "Este certificado fue generado...el: DD/MM/YYYY" (Sura, Colmena)
  const generatedMatch = flat.match(
    /(?:generado[^.]{0,80}el|emitido\s+el|expedido\s+el|fecha\s+de\s+expedici[oó]n[^.]{0,40}el)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i
  )
  if (generatedMatch) return generatedMatch[1]

  // Explicit "Fecha de expedición" label
  const expeditionLabel = flat.match(
    /fecha\s+de\s+expedi(?:ci[oó]n|do)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i
  )
  if (expeditionLabel) return expeditionLabel[1]

  // "Fecha creación reporte:" (Enlace, some Asopagos)
  const creacionMatch = flat.match(
    /fecha\s+creaci[oó]n\s+reporte\s*:\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (creacionMatch) return normalizeDate(creacionMatch[1])

  // Standalone date at the bottom of the certificate (heuristic: last DMY date)
  const allDates = [...flat.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map(
    (m) => m[1]
  )
  if (allDates.length > 0) return allDates[allDates.length - 1]

  return null
}

// ─── PILA ─────────────────────────────────────────────────────────────────────

// Narrow window for PILA date fields — labels are often printed close together.
const PILA_DATE_WINDOW = 60

const MONTH_ES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
}

/** Extracts a period as MM/YYYY from month-name formats like "marzo de 2026" or "abril 2026". */
function extractMonthNamePeriod(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [name, num] of Object.entries(MONTH_ES)) {
    const re = new RegExp(`\\b${name}\\s+(?:de\\s+)?(\\d{4})\\b`)
    const m = lower.match(re)
    if (m) return `${num}/${m[1]}`
  }
  return null
}

/** Extracts a period from ISO-month format "YYYY-MM" → "MM/YYYY".
 *  Does NOT match YYYY-MM-DD full dates. */
function extractISOMonthPeriod(text: string): string | null {
  // Negative lookahead so "2026-03-04" doesn't match as "2026-03"
  const m = text.match(/\b(\d{4})-(0[1-9]|1[0-2])\b(?!-\d{2})/)
  if (!m) return null
  return `${m[2]}/${m[1]}`
}

export function extractPILACandidates(text: string): Partial<PaymentSheetData> {
  // Caller must pass already-normalized text (joinSplitDates applied).

  // ── SOI / Aportes en Línea table format ──────────────────────────────────
  // Row pattern: YYYY-MM YYYY-MM clave(7-9d) planilla(9-12d) tipo(A-Z)
  //              fechaPago(YYYY/MM/DD) limitePago(YYYY/MM/DD) banco diasMora valor
  const SOI_ROW_RE =
    /(\d{4}-\d{2})\s+\d{4}-\d{2}\s+\d{7,9}\s+(\d{9,12})\s+[A-Z]\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{4}\/\d{2}\/\d{2})/g
  const soiMatches = [...text.matchAll(SOI_ROW_RE)]

  let soiSheet: string | undefined
  let soiPaymentDate: string | undefined
  let soiDeadline: string | undefined
  let soiPeriod: string | undefined

  if (soiMatches.length > 0) {
    // Collect all planilla numbers; if multiple, pass all so AI can pick the right one
    const allPlanillas = soiMatches.map((m) => m[2])
    soiSheet =
      allPlanillas.length > 1
        ? allPlanillas.join(" / ") // AI will choose correct one
        : allPlanillas[0]
    // En el formato SOI/Aportes en Línea las columnas son:
    // ... Fecha Pago (col 3) = fecha límite del sistema
    // ... Limite Pago (col 4) = fecha en que el usuario realizó el pago
    // Los nombres de las columnas son contraintuitivos — se asignan correctamente:
    soiPaymentDate = normalizeDate(soiMatches[0][4]) ?? undefined // "Limite Pago" = fecha real de pago
    soiDeadline = normalizeDate(soiMatches[0][3]) ?? undefined // "Fecha Pago" = fecha límite sistema
    // Period: YYYY-MM → MM/YYYY
    const [yr, mo] = soiMatches[0][1].split("-")
    soiPeriod = `${mo}/${yr}`
  }

  // ── Simple S.A. specific: planilla number appears BEFORE the section header ──
  // In Simple's PDF, the table layout puts the planilla number above the labels.
  // Text extraction yields:
  //   <planilla_number>\n<contractor_name>\nInformación de la Planilla Pagada\n
  //   ...labels including "Referencia de Pago/Número Planilla"...\n<transaction_id>
  // Generic forward-search picks up the transaction id by mistake. Search backwards
  // from the section header to get the right number.
  let simpleSheet: string | undefined
  const simpleHeaderIdx = text.search(/Información de la Planilla Pagada/i)
  if (simpleHeaderIdx > 0) {
    const before = text.slice(Math.max(0, simpleHeaderIdx - 500), simpleHeaderIdx)
    // Find all standalone 8-12 digit numbers (planilla numbers are typically 10 digits)
    const numbers = [...before.matchAll(/\b(\d{8,12})\b/g)].map((m) => m[1])
    if (numbers.length > 0) {
      // Closest to the header (last one before it)
      simpleSheet = numbers[numbers.length - 1]
    }
  }

  // ── Label-based search (other platforms) ─────────────────────────────────
  const SHEET_LABELS_EXACT = [
    "número de planilla:",
    "no. de planilla:",
    "n° de planilla:",
    "nro. de planilla:",
    "número único de planilla:",
    "nupla:",
    "planilla no.:",
    "planilla n°:",
    "planilla nro.:",   // Asopagos Tipo 2
    "no. planilla:",
    "número de radicado:",
    "radicado:",
    "número de referencia de pago:",
    "referencia de pago:",
    "no. de referencia:",
  ]
  const SHEET_LABELS_BROAD = [
    "número de planilla",
    "número único de planilla",
    "nupla",
    "no. de planilla",
    "n° de planilla",
    "nro. de planilla",
    "planilla no",
    "planilla n°",
    "planilla nro",
    "número planilla",
    "numéro planilla",      // Enlace typo (é not ú)
    "número de planilla",
    "numéro de planilla",   // Enlace typo variant
    "número de radicado",
    "radicado",
    "referencia de pago",
  ]
  const SHEET_RE_NUM = /(\d{6,})/
  const SHEET_RE_ALNUM = /([A-Z]{1,3}\d{5,}|\d{5,}[A-Z]{1,3})/i

  const labelSheet =
    findNear(text, SHEET_LABELS_EXACT, SHEET_RE_NUM, 60) ??
    findNear(text, SHEET_LABELS_EXACT, SHEET_RE_ALNUM, 80) ??
    findNear(text, SHEET_LABELS_BROAD, SHEET_RE_NUM, 120) ??
    findNear(text, SHEET_LABELS_BROAD, SHEET_RE_ALNUM, 150)

  const sheetRaw =
    simpleSheet ??
    labelSheet ??
    soiSheet ??
    (() => {
      const lower = text.toLowerCase()
      const idx = lower.indexOf("planilla")
      if (idx === -1) return null
      const window = text.slice(idx, idx + 200)
      return window.match(/(\d{8,})/)?.[1] ?? null
    })()

  const totalRaw = findNear(
    text,
    [
      "total pagado",
      "valor total",
      "total aportado",
      "monto total",
      "valor pagado",
      "total a pagar",
    ],
    /\$?\s*([\d.,]{4,})/
  )

  // Payment date: label search first, then fallback to first ISO date in text
  const labelPaymentDate =
    normalizeDate(
      findNear(
        text,
        [
          "fecha de pago:",
          "fecha pago:",
          "pagado el",
          "fecha de transacción:",
          "fecha transacción:",
          "fecha transaccion:",
        ],
        DATE_RE,
        PILA_DATE_WINDOW
      ) ??
        findNear(
          text,
          [
            "fecha de pago",
            "fecha pago",
            "fecha transacción",
            "pagado",   // Enlace: "PAGADO 16/04/2026"
          ],
          DATE_RE,
          PILA_DATE_WINDOW
        )
    ) ?? soiPaymentDate

  // Fallback: first ISO date (YYYY-MM-DD) in document when labels are absent
  const isoDateFallback = (() => {
    if (labelPaymentDate) return undefined
    const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
    return isoMatch ? normalizeDate(isoMatch[1]) ?? undefined : undefined
  })()

  // Period: try MM/YYYY label search, then ISO-month format, then month name
  const labelPeriod =
    findNear(
      text,
      [
        "período",
        "periodo de cotización",
        "mes de cotización",
        "período cotizado",
        "mes cotizado",
        "período pensión",
        "periodo pensión",
        "período salud",
        "periodo salud",
      ],
      /(\d{2}\/\d{4})/
    ) ?? soiPeriod

  // For ISO-month: look for "YYYY-MM" (not YYYY-MM-DD) near period labels
  const isoMonthCandidate = !labelPeriod
    ? findNear(
        text,
        [
          "período pensión",
          "periodo pensión",
          "período salud",
          "periodo salud",
          "período",
          "periodo de cotización",
        ],
        /(\d{4}-(?:0[1-9]|1[0-2]))\b(?!-\d{2})/,
        80
      )
    : null
  const isoMonthPeriod =
    isoMonthCandidate ? extractISOMonthPeriod(isoMonthCandidate) : null

  const monthNamePeriod =
    !labelPeriod && !isoMonthPeriod
      ? extractMonthNamePeriod(text)
      : null

  return {
    sheetNumber: sheetRaw ?? undefined,
    paymentDate: labelPaymentDate ?? isoDateFallback,
    paymentDeadline:
      normalizeDate(
        findNear(
          text,
          [
            "fecha límite de pago:",
            "fecha límite:",
            "fecha máxima de pago:",
            "pagar antes del",
            "vence el",
          ],
          DATE_RE,
          PILA_DATE_WINDOW
        ) ??
          findNear(
            text,
            [
              "fecha límite",
              "fecha limite",
              "limite de pago",
              "fecha vencimiento",
              "fecha máxima",
              "fecha limite pago",
              "fecha límite pago",
            ],
            DATE_RE,
            PILA_DATE_WINDOW
          )
      ) ??
      soiDeadline ??
      null,
    period: labelPeriod ?? isoMonthPeriod ?? monthNamePeriod ?? undefined,
    totalAmountPaid: parseAmount(totalRaw) ?? undefined,
  }
}

/**
 * Extracts the contractor's document type from the PILA payment sheet.
 * More reliable than the contract because the PILA shows the cotizante's own
 * type explicitly, while the contract also contains UNAL's NIT and other NITs.
 */
export function extractDocumentTypeFromPILA(text: string): DocumentType {
  // Explicit "tipo de documento" label — most reliable
  const labelMatch = findNear(
    text,
    ["tipo de documento:", "tipo doc:", "tipo de identificación:", "tipo id:"],
    /\b(CC|NIT|CE)\b/i,
    50
  )
  if (labelMatch) return labelMatch.toUpperCase() as DocumentType

  // "C.C." or "CC" followed directly by a long digit sequence
  if (/\bC\.?\s*C\.?\s+\d{6,}/.test(text)) return "CC"

  // NIT with verification digit (NIT XXXXXXX-X format)
  if (/\bNIT\s*[:\s]\s*\d{6,}-\d\b/.test(text)) return "NIT"

  // "cédula de ciudadanía" anywhere
  if (/cédula\s+de\s+ciudadan[ií]a/i.test(text)) return "CC"

  return "CC" // safe default — most UNAL contractors are natural persons
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

// UNAL contract date labels
const CONTRACT_START_LABELS = [
  "fecha de inicio:",
  "fecha inicio:",
  "inicio de ejecución:",
  "inicio de vigencia:",
  "fecha de inicio de ejecución:",
  "a partir del",
  "fecha de inicio",
  "inicio del contrato",
]

const CONTRACT_END_LABELS = [
  "fecha de terminación:",
  "fecha terminación:",
  "fecha de vencimiento:",
  "fecha de fin:",
  "fecha fin:",
  "termina el",
  "vence el",
  "vigente hasta",
  "hasta el",
  "fecha de terminación",
  "fecha de vencimiento",
]

export function extractContractCandidates(text: string): Partial<ContractData> {
  // Caller must pass already-normalized text (joinSplitDates applied).
  const typeMatch = text.match(
    /\b(OCA|OCO|ODC|ODO|OPS|OSE|OSU|CCO|CDA|CDC|CDO|CIS|CON|COV|CPS|CSE|CSU|OEF|OFA|OFC|OFO|OFS|OOF|OSF|OUF|CAF|CCF|CIF|COF|CPF|CSF|CTF|CUF|CVF)\b/
  )
  const orderMatch = text.match(
    /(?:orden|contrato|n[uú]mero\s+de\s+orden)[^\d]*(\d+)/i
  )

  // Detect contractor's document type. CC markers take priority because
  // UNAL's own NIT always appears in every contract — a bare "NIT" match would
  // produce a false positive for contractors who hold a CC.
  const hasCCMarker = /\bC\.?\s*C\.?\b|\bcédula\s+de\s+ciudadan[ií]a\b/i.test(
    text
  )
  const hasNITMarker = /\bNIT\s*[:\-]?\s*\d|\bN\.I\.T\.\b/i.test(text)
  const hasCEMarker = /\bcédula\s+de\s+extranjer[ií]a\b|\bC\.?\s*E\.?\b/i.test(
    text
  )

  const docTypeRaw = hasCCMarker
    ? "CC"
    : hasNITMarker
      ? "NIT"
      : hasCEMarker
        ? "CE"
        : "CC"

  const docNumberRaw = findNear(
    text,
    [
      "cédula de ciudadanía",
      "c.c.",
      "cédula:",
      "nit:",
      "identificación",
      "documento de identidad",
    ],
    /\b(\d{6,12})\b/
  )

  const valueRaw = findNear(
    text,
    [
      "valor del contrato",
      "valor total",
      "por valor de",
      "monto del contrato",
      "cuantía",
    ],
    /\$?\s*([\d.,]{4,})/
  )

  // Date extraction: prefer individual labels; fall back to range patterns
  const [rangeStart, rangeEnd] = extractDateRange(text)

  const startDate =
    normalizeDate(findNear(text, CONTRACT_START_LABELS, DATE_RE, 80)) ??
    rangeStart ??
    undefined

  const rawEndDate =
    normalizeDate(findNear(text, CONTRACT_END_LABELS, DATE_RE, 80)) ?? rangeEnd
  // Guard against duplicating the start date
  const endDate =
    rawEndDate && rawEndDate !== startDate ? rawEndDate : undefined

  return {
    contractType: (typeMatch?.[1] as ContractType) ?? undefined,
    orderNumber: orderMatch?.[1] ?? undefined,
    documentType: docTypeRaw as DocumentType,
    documentNumber: docNumberRaw ?? undefined,
    totalValueBeforeTax: parseAmount(valueRaw) ?? undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
  }
}

// ─── Emisor ───────────────────────────────────────────────────────────────────

/** Returns a stable key identifying the document issuer (used for profile storage). */
export function detectIssuer(
  text: string,
  docType: "arl" | "pila" | "contract"
): string {
  const lower = text.toLowerCase()

  if (docType === "arl") {
    if (lower.includes("sura")) return "sura"
    if (lower.includes("positiva")) return "positiva"
    if (lower.includes("colmena")) return "colmena"
    if (lower.includes("colpatria")) return "colpatria"
    if (lower.includes("liberty")) return "liberty"
    if (lower.includes("equidad")) return "equidad"
    if (lower.includes("bolívar") || lower.includes("bolivar")) return "bolivar"
    if (lower.includes("mapfre")) return "mapfre"
  }

  if (docType === "pila") {
    if (lower.includes("aportes en línea") || lower.includes("aportesenlinea"))
      return "aportesenlinea"
    if (lower.includes("mi planilla")) return "miplanilla"
    if (lower.includes("soi ") || lower.includes("\nsoi\n")) return "soi"
    if (lower.includes("simple s.a") || lower.includes("simple s.a."))
      return "simple"
    if (lower.includes("asopagos")) return "asopagos"
    if (lower.includes("enlace operativo")) return "enlace"
  }

  return "unknown"
}

// ─── Informe de Actividades ───────────────────────────────────────────────────

export function extractActivityReportCandidates(
  text: string
): Record<string, unknown> {
  const signatureDate = normalizeDate(
    findNear(text, ["firma el presente informe el"], DATE_RE, 50)
  )
  const periodFrom = normalizeDate(
    findNear(text, ["PERIODO DEL INFORME:", "Desde:"], DATE_RE, 50)
  )
  const periodTo = normalizeDate(findNear(text, ["Hasta:"], DATE_RE, 50))
  const opsStartDate = normalizeDate(
    findNear(text, ["PLAZO OPS:", "Fecha inicio"], DATE_RE, 50)
  )
  const opsEndDate = normalizeDate(
    findNear(text, ["Fecha Terminación"], DATE_RE, 50)
  )

  return {
    signatureDate,
    periodFrom,
    periodTo,
    opsStartDate,
    opsEndDate,
  }
}
