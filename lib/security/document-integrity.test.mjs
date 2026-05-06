import test from "node:test"
import assert from "node:assert/strict"

import {
  validateExtractedDataIntegrity,
  validateNoBlockingResults,
} from "./document-integrity.ts"

const extracted = {
  paymentSheet: {
    sheetNumber: "123456789",
    paymentDate: "01/04/2026",
    paymentDeadline: "30/04/2026",
    period: "04/2026",
    totalAmountPaid: 1250000,
    contractorName: "ANA MARIA PEREZ",
    documentNumber: "123456789",
  },
  arl: {
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    coverageStatus: "ACTIVA",
    riskClass: "II",
    cotizationRate: 1.044,
    contractorName: "ANA MARIA PEREZ",
    documentNumber: "123456789",
  },
  contract: {
    contractType: "OSE",
    orderNumber: "44",
    contractorName: "ANA MARIA PEREZ",
    documentType: "CC",
    documentNumber: "123456789",
    totalValueBeforeTax: 12000000,
    startDate: "01/01/2026",
    endDate: "31/12/2026",
    activityReport: { required: false, frequencyMonths: null },
  },
}

const manual = {
  contractCount: "1",
  quipuCompany: "4013",
  paymentsToRequest: 12,
  paymentNumber: 4,
  amountToCharge: 1000000,
  paymentRequestPeriod: "04/2026",
  paymentType: "Parcial",
  dependencia: "Centro de Prototipado",
  institutionalEmail: "ana@example.com",
  isPensioner: false,
  deductionDependents: false,
  deductionHealthPolicy: false,
  deductionMortgageInterest: false,
  deductionPrepaidMedicine: false,
  deductionAFC: false,
  deductionVoluntaryPension: false,
  supervisorName: "Supervisor",
  supervisorDocumentNumber: "999",
  supervisorEmail: "supervisor@example.com",
  supervisorPhone: "3000000000",
}

test("rejects generated PDF data that is not backed by uploaded document text", () => {
  const errors = validateExtractedDataIntegrity({
    extracted: {
      ...extracted,
      contract: {
        ...extracted.contract,
        contractorName: "PERSONA FALSA",
        orderNumber: "999",
      },
    },
    manual,
    sourceText: {
      paymentSheet:
        "Planilla 123456789 periodo 04/2026 ANA MARIA PEREZ CC 123456789 total pagado $1.250.000",
      arl: "Certificado ARL ANA MARIA PEREZ CC 123456789 ACTIVA riesgo II fecha inicio contrato 2026-01-01 fecha fin contrato 2026-12-31 tasa 1.044%",
      contract:
        "UNAL contrato OSE numero de orden 44 contratista ANA MARIA PEREZ cedula de ciudadania 123456789 valor del contrato $12.000.000",
    },
  })

  assert.match(errors.join("\n"), /Contrato: nombre del contratista/)
  assert.match(errors.join("\n"), /Contrato: numero de orden/)
})

test("accepts generated PDF data when core fields are present in uploaded document text", () => {
  const errors = validateExtractedDataIntegrity({
    extracted,
    manual,
    sourceText: {
      paymentSheet:
        "Planilla 123456789 periodo 04/2026 ANA MARIA PEREZ CC 123456789 total pagado $1.250.000",
      arl: "Certificado ARL ANA MARIA PEREZ CC 123456789 ACTIVA riesgo II fecha inicio contrato 2026-01-01 fecha fin contrato 2026-12-31 tasa 1.044%",
      contract:
        "UNAL contrato OSE numero de orden 44 contratista ANA MARIA PEREZ cedula de ciudadania 123456789 valor del contrato $12.000.000",
    },
  })

  assert.deepEqual(errors, [])
})

test("rejects blocking validation results before PDF generation", () => {
  const summary = {
    blocked: true,
    results: [
      {
        ok: false,
        blocking: true,
        type: "cedular",
        message: "El numero de documento no coincide.",
      },
    ],
  }

  assert.deepEqual(validateNoBlockingResults(summary), [
    "El numero de documento no coincide.",
  ])
})
