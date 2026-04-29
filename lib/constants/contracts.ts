import type { ContractType } from "@/lib/types"

/** Full display labels for all contract/order types */
export const CONTRACT_LABELS: Record<ContractType, string> = {
  // Órdenes contractuales
  OCA: "OCA - Orden contractual de arrendamiento",
  OCO: "OCO - Orden contractual de consultoría",
  ODC: "ODC - Orden contractual de compra",
  ODO: "ODO - Orden contractual de obra",
  OPS: "OPS - Orden contractual de prestación de servicios personales de apoyo a la gestión",
  OSE: "OSE - Orden contractual de servicios",
  OSU: "OSU - Orden contractual de suministros",
  // Contratos
  CCO: "CCO - Contrato de consultoría",
  CDA: "CDA - Contrato de arrendamiento",
  CDC: "CDC - Contrato de compra venta",
  CDO: "CDO - Contrato de obra",
  CIS: "CIS - Contrato de intermediación de seguros",
  CON: "CON - Contrato",
  COV: "COV - Convenio",
  CPS: "CPS - Contrato de prestación de servicios personales de apoyo a la gestión",
  CSE: "CSE - Contrato de servicios",
  CSU: "CSU - Contrato de suministro",
  // Órdenes de vigencia futura
  OEF: "OEF - Orden contractual de servicios Vigencia Futura",
  OFA: "OFA - Orden contractual de arrendamiento Vigencia Futura",
  OFC: "OFC - Orden contractual de compra Vigencia Futura",
  OFO: "OFO - Orden contractual de consultoría Vigencia Futura",
  OFS: "OFS - Orden contractual de prestación de servicios Vigencia Futura",
  OOF: "OOF - Orden contractual de obra Vigencia Futura",
  OSF: "OSF - Orden contractual de prestación de servicios Vigencia Futura",
  OUF: "OUF - Orden contractual de suministro Vigencia Futura",
  // Contratos de vigencia futura
  CAF: "CAF - Contrato de vigencia futura de arrendamiento",
  CCF: "CCF - Contrato de vigencia futura de consultoría",
  CIF: "CIF - Contrato de vigencia futura de intermediación de seguros",
  COF: "COF - Contrato de vigencia futura de obra",
  CPF: "CPF - Contrato de vigencia futura de prestación de servicios",
  CSF: "CSF - Contrato de vigencia futura de servicios",
  CTF: "CTF - Contrato de vigencia futura",
  CUF: "CUF - Contrato de vigencia futura de suministro",
  CVF: "CVF - Contrato de vigencia futura de compra venta",
}

/** Options array for contract type selects — derived from CONTRACT_LABELS to avoid duplication */
export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] =
  (Object.keys(CONTRACT_LABELS) as ContractType[]).map((t) => ({
    value: t,
    label: t,
  }))

/** Comma-separated sigla list used in AI prompts */
export const CONTRACT_TYPES_PROMPT =
  "OCA, OCO, ODC, ODO, OPS, OSE, OSU, CCO, CDA, CDC, CDO, CIS, CON, COV, CPS, CSE, CSU, " +
  "OEF, OFA, OFC, OFO, OFS, OOF, OSF, OUF, CAF, CCF, CIF, COF, CPF, CSF, CTF, CUF, CVF"
