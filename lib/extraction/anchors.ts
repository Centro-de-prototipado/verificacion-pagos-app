/**
 * Inline anchor extraction with format fingerprinting.
 *
 * Some PDFs (notably Simple S.A.'s planilla, Aportes en Línea's data row,
 * Asopagos "Certificación de Pago", etc.) use tabular layouts that get
 * flattened by `unpdf` into a jumbled stream where labels and values no
 * longer sit next to each other. In those cases the LLM picks the wrong
 * value because "after the label" doesn't apply.
 *
 * The fix: a list of `(fingerprint, anchor, value pattern, field)` tuples.
 * For each anchor whose `fingerprint` matches the text (or has no
 * fingerprint), scan a window around the anchor for values matching the
 * pattern, pick one, and emit a compact header at the top of the text:
 *
 *     === ANCLAS DETECTADAS ===
 *     sheetNumber: 1081516528
 *     === FIN ANCLAS ===
 *
 *     [resto del texto]
 *
 * The LLM uses anchors as priors but can still override against the raw
 * text. The `fingerprint` ensures an anchor only fires on documents from
 * the operator/aseguradora it was designed for — no cross-format noise.
 */

type Pick = "first" | "last" | "longest"

export type DocType = "pila" | "arl" | "contract" | "report"

interface Anchor {
  field: string
  docType: DocType
  /** Si está presente, el ancla SOLO se aplica si este patrón aparece en
   *  el texto. Sin fingerprint, se intenta en cualquier documento. */
  fingerprint?: RegExp
  /** Frase que aparece NEAR del valor que buscamos. */
  anchor: RegExp
  searchBefore?: number
  searchAfter?: number
  /** Regex (con /g) que matchea candidatos en la ventana. */
  valuePattern: RegExp
  pick?: Pick
  /** Descarta candidatos que también matchean este patrón. */
  exclude?: RegExp
  /** Normalización del valor (trim, strip separadores, etc.). */
  transform?: (v: string) => string
}

// ─── Fingerprints por formato ───────────────────────────────────────────────

const FP = {
  simple: /SIMPLE S\.A\./i,
  aportesLinea: /Aportes en L[íi]nea|DATOS GENERALES DE LA LIQUIDACION/i,
  asopagosCert: /Certificaci[óo]n de\s+Pago[\s\S]{0,200}identificada con/i,
  asopagosTipo3: /PER[ÍI]ODO PENSI[ÓO]N[\s\S]{0,200}FECHA PAGO/i,
  enlaceOperativo: /Enlace Operativo|AUTOLIQUIDACION\s*CONSOLIDADA/i,
}

// ─── Anchor definitions ─────────────────────────────────────────────────────
// Cada ancla tiene un fingerprint que la limita a un formato específico.
// Para agregar un formato nuevo: definir el fingerprint arriba y añadir las
// anclas necesarias aquí.

const ANCHORS: Anchor[] = [
  // ── SIMPLE S.A. planilla ────────────────────────────────────────────────
  // En el layout de Simple el número de planilla aparece 200-600 chars
  // ANTES de "Información de la Planilla Pagada". El "Número Transacción
  // Bancaria/ CUS" aparece DESPUÉS. Backward + pick:last = el más cercano.
  {
    field: "sheetNumber",
    docType: "pila",
    fingerprint: FP.simple,
    anchor: /Información de la Planilla Pagada/i,
    searchBefore: 600,
    valuePattern: /\b(\d{8,12})\b/g,
    pick: "last",
  },

  // ── ASOPAGOS / POSITIVA "Certificación de Pago" ─────────────────────────
  // Doc está en una frase narrativa: "identificada con CC-1060653760 …".
  {
    field: "documentNumber",
    docType: "pila",
    fingerprint: FP.asopagosCert,
    anchor: /identificada\s+con\s+(?:CC|NIT|CE)-?\s*\d/i,
    searchAfter: 50,
    valuePattern: /(?:CC|NIT|CE)-?\s*(\d{5,12})/g,
    pick: "first",
  },

  // ── APORTES EN LÍNEA: data row ──────────────────────────────────────────
  // La tabla "DATOS GENERALES DE LA LIQUIDACION" se aplana a una sola fila
  // con shape: `YYYY-MM YYYY-MM <clave> <sheet> <tipo> YYYY/MM/DD YYYY/MM/DD …`
  // El LLM toma la primera secuencia de 8-12 dígitos (Clave Pago), pero la
  // PLANILLA es el SEGUNDO número de la fila. Las dos fechas: primero
  // Limite Pago, luego Pago efectivo.
  {
    field: "sheetNumber",
    docType: "pila",
    fingerprint: FP.aportesLinea,
    anchor:
      /\d{4}-\d{2}\s+\d{4}-\d{2}\s+(\d{6,12})\s+(\d{6,12})\s+[IVX]+\s+\d{4}\/\d{2}\/\d{2}/i,
    searchAfter: 0,
    valuePattern:
      /\d{4}-\d{2}\s+\d{4}-\d{2}\s+\d{6,12}\s+(\d{6,12})\s+[IVX]+/g,
    pick: "first",
  },
  {
    field: "paymentDeadline",
    docType: "pila",
    fingerprint: FP.aportesLinea,
    anchor: /\d{4}-\d{2}\s+\d{4}-\d{2}\s+\d{6,12}\s+\d{6,12}\s+[IVX]+/i,
    searchAfter: 40,
    valuePattern: /\b(\d{4}\/\d{2}\/\d{2})\b/g,
    pick: "first",
  },
  {
    field: "paymentDate",
    docType: "pila",
    fingerprint: FP.aportesLinea,
    anchor: /\d{4}-\d{2}\s+\d{4}-\d{2}\s+\d{6,12}\s+\d{6,12}\s+[IVX]+/i,
    searchAfter: 40,
    valuePattern: /\b(\d{4}\/\d{2}\/\d{2})\b/g,
    pick: "last",
  },

  // ── ASOPAGOS Tipo3 — FECHA PAGO ─────────────────────────────────────────
  // "FECHA PAGO" tiene su valor (YYYY-MM-DD) en la LÍNEA SUPERIOR debido al
  // table flip. El LLM agarra el período (YYYY-MM) que aparece cerca.
  {
    field: "paymentDate",
    docType: "pila",
    fingerprint: FP.asopagosTipo3,
    anchor: /FECHA\s+PAGO/i,
    searchBefore: 100,
    searchAfter: 0,
    valuePattern: /\b(\d{4}-\d{2}-\d{2})\b/g,
    pick: "last",
  },

  // ── ENLACE OPERATIVO / Colmena — totalAmountPaid ────────────────────────
  // El subtotal correcto ($623,200) aparece justo después de "III.TOTALES",
  // como el primer monto NO-CERO. Layout: `... III.TOTALES $ 0 $ 623.200 ...`
  // Ventana corta + excluir ceros para no caer en IBC/totales finales.
  {
    field: "totalAmountPaid",
    docType: "pila",
    fingerprint: FP.enlaceOperativo,
    anchor: /III\.\s*TOTALES/i,
    searchAfter: 60,
    valuePattern: /\$\s*([\d.,]+)/g,
    pick: "first",
    exclude: /^[\s0.,]+$/,
    transform: (v) => v.replace(/[.,\s]/g, ""),
  },
]

// ─── Engine ─────────────────────────────────────────────────────────────────

function pickMatch(matches: string[], pick: Pick): string | null {
  if (matches.length === 0) return null
  if (pick === "first") return matches[0]
  if (pick === "last") return matches[matches.length - 1]
  return matches.reduce((a, b) => (b.length > a.length ? b : a))
}

function findValue(text: string, a: Anchor): string | null {
  const m = a.anchor.exec(text)
  if (!m) return null
  const start = Math.max(0, m.index - (a.searchBefore ?? 0))
  const end = Math.min(text.length, m.index + m[0].length + (a.searchAfter ?? 0))
  const window = text.slice(start, end)
  const matches: string[] = []
  for (const match of window.matchAll(a.valuePattern)) {
    const v = match[1] ?? match[0]
    if (a.exclude && a.exclude.test(v)) continue
    matches.push(a.transform ? a.transform(v) : v)
  }
  return pickMatch(matches, a.pick ?? "first")
}

/**
 * Returns the same text with an `=== ANCLAS DETECTADAS ===` header at the top
 * containing any fields the anchor list could resolve. If no anchors match,
 * returns the text unchanged.
 */
export function injectAnchors(text: string, docType: DocType): string {
  const detected: Record<string, string> = {}
  for (const a of ANCHORS) {
    if (a.docType !== docType) continue
    if (a.fingerprint && !a.fingerprint.test(text)) continue
    if (detected[a.field]) continue
    const v = findValue(text, a)
    if (v) detected[a.field] = v
  }
  const keys = Object.keys(detected)
  if (keys.length === 0) return text
  const lines = keys.map((k) => `${k}: ${detected[k]}`).join("\n")
  return (
    `=== ANCLAS DETECTADAS (úsalas como guía, verifica contra el texto) ===\n` +
    `${lines}\n` +
    `=== FIN ANCLAS ===\n\n` +
    text
  )
}
