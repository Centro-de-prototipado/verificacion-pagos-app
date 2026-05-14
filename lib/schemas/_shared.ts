import { z } from "zod"

// ── Date helpers ────────────────────────────────────────────────────────────
// Canonical date format: DD/MM/YYYY. Accepts ISO / DMY with - or / separators
// and normalizes. If the input can't be normalized, returns the trimmed input
// as-is — the route layer flags malformed values and the UI lets the user fix.

export const toDMY = (v: string): string => {
  const t = v.trim()
  const iso = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (iso)
    return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy)
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`
  return t
}

export const toPeriod = (v: string): string => {
  const t = v.trim()
  const my = t.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (my) return `${my[1].padStart(2, "0")}/${my[2]}`
  const ym = t.match(/^(\d{4})[\/\-](\d{1,2})$/)
  if (ym) return `${ym[2].padStart(2, "0")}/${ym[1]}`
  return t
}

/** Permissive date: normalizes to DD/MM/YYYY when possible. */
export const dateField = () => z.string().transform(toDMY)

/** Permissive period: normalizes to MM/YYYY when possible. */
export const periodField = () => z.string().transform(toPeriod)

/** Permissive name: trim + uppercase + strip trailing/leading non-letter junk
 *  (digits and codes that get glued by text-layout extraction, e.g. "MARIN0"). */
export const nameField = () =>
  z.string().transform((s) =>
    s
      .trim()
      .toUpperCase()
      .replace(/[\d_\-\.,;:]+$/g, "")
      .replace(/^[\d_\-\.,;:]+/g, "")
      .trim()
  )

/** Permissive document: strip non-digits. */
export const docField = () => z.string().transform((s) => s.replace(/\D/g, ""))
