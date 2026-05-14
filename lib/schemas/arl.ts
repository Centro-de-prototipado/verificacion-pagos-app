import { z } from "zod"

import { dateField, docField, nameField } from "./_shared"

const NULL =
  " Si NO aparece EXPLÍCITAMENTE escrito en el texto, devuelve null. " +
  "NUNCA inventes ni infieras (por ejemplo, NO deduzcas la tasa a partir del riesgo). " +
  "Solo extrae lo que esté literalmente en el documento."

export const ARLSchema = z.object({
  startDate: dateField()
    .nullable()
    .describe(
      "Fecha de inicio de cobertura ARL en DD/MM/YYYY. " +
        "PRIORIDAD 1: Si aparece 'Fecha Inicio Contrato' o 'Fecha de Inicio Contrato', usa esa. " +
        "PRIORIDAD 2: 'Vigencia Desde', 'Cobertura Desde', 'Fecha de Inicio de Cobertura', " +
        "'Fecha de Inicio de Afiliación', 'Vigente Desde'. " +
        "IGNORA: 'Fecha de Expedición', 'Fecha de Generación', 'Fecha del Certificado'." +
        NULL
    ),
  endDate: dateField()
    .nullable()
    .describe(
      "Fecha de fin de cobertura ARL en DD/MM/YYYY. " +
        "PRIORIDAD 1: 'Fecha Fin Contrato', 'Fecha de Terminación Contrato'. " +
        "PRIORIDAD 2: 'Vigencia Hasta', 'Cobertura Hasta', 'Fecha de Fin de Cobertura', " +
        "'Vigente Hasta', 'Fecha de Terminación'. " +
        "IGNORA: 'Fecha de Expedición', fechas de retiro o suspensión." +
        NULL
    ),
  coverageStatus: z
    .enum(["ACTIVA", "INACTIVA", "SUSPENDIDA", "MORA"])
    .nullable()
    .describe(
      "Estado actual de la afiliación. " +
        "BUSCA después de: 'Estado', 'Estado de Afiliación', 'Estado de Cobertura', " +
        "'Situación', 'Condición'. " +
        "Mapea sinónimos: 'Vigente'/'Al día'→ACTIVA, 'Retirado'/'Cancelado'→INACTIVA, " +
        "'En mora'/'Con mora'/'Atraso'/'No pagado'→MORA, 'Suspendido'→SUSPENDIDA." +
        NULL
    ),
  riskClass: z
    .enum(["I", "II", "III", "IV", "V"])
    .nullable()
    .describe(
      "Clase de riesgo laboral en NÚMERO ROMANO MAYÚSCULA (I, II, III, IV, V). " +
        "BUSCA después de: 'Clase de Riesgo', 'Nivel de Riesgo', 'Riesgo Laboral', 'Clase'. " +
        "Convierte arábigos: 1→I, 2→II, 3→III, 4→IV, 5→V. " +
        "IGNORA otros números romanos del documento (anexos, secciones)." +
        NULL
    ),
  cotizationRate: z
    .number()
    .nullable()
    .describe(
      "Tasa ARL como porcentaje (1.044 = 1.044%). " +
        "BUSCA después de: 'Tasa de Cotización', 'Tasa Cotización', '% Cotización', " +
        "'Porcentaje de Cotización', 'Tasa ARL'. " +
        "Valores oficiales: 0.522 (Riesgo I), 1.044 (II), 2.436 (III), 4.350 (IV), 6.960 (V). " +
        "IGNORA porcentajes de salud (12.5%) o pensión (16%)." +
        NULL
    ),
  contractorName: nameField()
    .nullable()
    .describe(
      "Nombre del trabajador AFILIADO (persona natural). " +
        "BUSCA después de: 'Afiliado', 'Nombre del Afiliado', 'Trabajador', " +
        "'Beneficiario', 'Datos del Afiliado', 'Nombre Completo'. " +
        "IGNORA y NUNCA uses: nombre de la ARL (Sura, Positiva, Colmena, Colpatria, " +
        "Bolívar, Liberty, Equidad, Mapfre, AXA), 'Tomador', 'Empleador', " +
        "'Universidad Nacional de Colombia', 'Aportante'." +
        NULL
    ),
  documentNumber: docField()
    .nullable()
    .describe(
      "Documento del AFILIADO (CC, NIT o CE de la persona natural). " +
        "BUSCA después de: 'CC Afiliado', 'Documento Afiliado', 'Identificación del Afiliado', " +
        "'Cédula del Trabajador'. " +
        "IGNORA: NIT de la ARL, NIT de UNAL (899999063), NIT del tomador." +
        NULL
    ),
})

export type ARLExtracted = z.infer<typeof ARLSchema>
