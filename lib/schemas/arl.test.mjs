import test from "node:test"
import assert from "node:assert/strict"

import { ARLSchema } from "./arl.ts"

test("normalizes ARL document numbers to digits only", () => {
  const parsed = ARLSchema.parse({
    startDate: "01/01/2026",
    endDate: "31/12/2026",
    coverageStatus: "ACTIVA",
    riskClass: "II",
    cotizationRate: 1.044,
    contractorName: "Persona Prueba",
    documentNumber: "C1018415325",
  })

  assert.equal(parsed.documentNumber, "1018415325")
})
