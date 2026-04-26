// Client-side only — reads/writes localStorage

export type DocType = "arl" | "pila" | "contract"

export interface DocumentProfile {
  issuer: string
  docType: DocType
  confirmedCount: number
  lastConfirmed: string
  /** Last confirmed extraction — used as few-shot example in AI prompts */
  example: Record<string, unknown>
}

const PREFIX = "docprofile_"

function key(docType: DocType, issuer: string) {
  return `${PREFIX}${docType}_${issuer}`
}

export function getProfile(
  docType: DocType,
  issuer: string
): DocumentProfile | null {
  if (typeof window === "undefined" || issuer === "unknown") return null
  try {
    return JSON.parse(localStorage.getItem(key(docType, issuer)) ?? "null")
  } catch {
    return null
  }
}

export function saveProfile(
  docType: DocType,
  issuer: string,
  data: Record<string, unknown>
): void {
  if (typeof window === "undefined" || issuer === "unknown") return
  const existing = getProfile(docType, issuer)
  const profile: DocumentProfile = {
    issuer,
    docType,
    confirmedCount: (existing?.confirmedCount ?? 0) + 1,
    lastConfirmed: new Date().toISOString(),
    example: data,
  }
  try {
    localStorage.setItem(key(docType, issuer), JSON.stringify(profile))
  } catch {
    // localStorage full — not critical
  }
}

export function getAllProfiles(): DocumentProfile[] {
  if (typeof window === "undefined") return []
  const result: DocumentProfile[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(PREFIX)) continue
    try {
      const p = JSON.parse(localStorage.getItem(k) ?? "null")
      if (p) result.push(p as DocumentProfile)
    } catch {
      // skip corrupted entries
    }
  }
  return result
}
