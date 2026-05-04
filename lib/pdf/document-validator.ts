type DocType = "pila" | "arl" | "contract" | "report"

interface DocFingerprint {
  label: string
  /** All groups must match; within each group any term suffices. */
  require: string[][]
}

const FINGERPRINTS: Record<DocType, DocFingerprint> = {
  pila: {
    label: "planilla PILA de seguridad social",
    require: [
      [
        "planilla",
        "pila",
        "seguridad social",
        "aportes en línea",
        "aportesenlinea",
        "soi",
        "mi planilla",
        "simple",
        "asopagos",
      ],
      [
        "cotización",
        "cotizacion",
        "período",
        "periodo",
        "aporte",
        "eps",
        "afp",
        "pensión",
        "pension",
      ],
    ],
  },
  arl: {
    label: "certificado ARL",
    require: [
      [
        "arl",
        "riesgo laboral",
        "riesgos laborales",
        "accidente de trabajo",
        "administradora de riesgos",
      ],
      [
        "afiliación",
        "afiliacion",
        "cobertura",
        "vigencia",
        "asegurado",
        "cotizante",
      ],
    ],
  },
  contract: {
    label: "contrato u orden contractual",
    require: [
      ["contrato", "orden de", "orden contractual", "orden de servicio", "orden de compra", "otro si", "otro sí", "adición", "adicion"],
      ["contratista", "universidad nacional", "unal"],
    ],
  },
  report: {
    label: "informe de actividades",
    require: [
      ["informe de actividades", "informe mensual", "informe de ejecución"],
      ["actividades ejecutadas", "periodo del informe", "plazo ops"],
    ],
  },
}

export interface DocCheckResult {
  valid: boolean
  /** Human-readable name of the expected document type */
  label: string
}

/**
 * Returns whether the extracted text looks like the expected document type
 * using keyword fingerprints. A mismatch means the user likely uploaded
 * the wrong PDF — skip AI extraction and warn instead.
 */
export function isDocumentMatch(text: string, docType: DocType): DocCheckResult {
  const fp = FINGERPRINTS[docType]
  const lower = text.toLowerCase()
  const valid = fp.require.every((group) =>
    group.some((term) => lower.includes(term))
  )
  return { valid, label: fp.label }
}
