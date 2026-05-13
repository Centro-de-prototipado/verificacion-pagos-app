/**
 * Per-issuer extraction instructions injected into AI prompts.
 * Each entry tells the model WHERE to find fields in that issuer's specific format,
 * preventing common confusions like insurer name → contractor name.
 */

export const PILA_ISSUER_INSTRUCTIONS: Record<string, string> = {
  "aportesenlinea": (
    "Formato Aportes en Línea:\n" +
    "- contractorName: está en la sección 'Datos del Cotizante' / 'Nombre del Cotizante'. " +
    "NO es 'Aportes en Línea' ni ningún otro nombre de operador.\n" +
    "- sheetNumber: número de 10 dígitos que aparece como 'No. Planilla' o 'Número Planilla'. " +
    "NO es la 'Clave de Pago' (8-9 dígitos).\n" +
    "- period: mes cotizado (MM/YYYY), busca 'Período' o 'Período de Liquidación'."
  ),
  "simple": (
    "Formato Simple S.A.:\n" +
    "- contractorName: aparece bajo 'Nombre del Cotizante' o 'Razón Social'. " +
    "NO es 'Simple S.A.' ni ningún operador.\n" +
    "- sheetNumber: es la 'Referencia de Pago' en la sección 'Información de la Planilla Pagada'. " +
    "NO confundas con el número de radicado.\n" +
    "- paymentDate: busca 'Fecha de Pago' o 'Fecha de Aprobación'."
  ),
  "enlace": (
    "Formato Enlace Operativo:\n" +
    "- contractorName: aparece en la parte superior del documento junto a la cédula. " +
    "NO es 'Enlace Operativo' ni el nombre del fondo.\n" +
    "- paymentDate: aparece como 'PAGADO DD/MM/YYYY' en el recibo de pago.\n" +
    "- period: puede aparecer como 'marzo de 2026' (→ 03/2026) o similar en formato de nombre de mes."
  ),
  "soi": (
    "Formato SOI:\n" +
    "- contractorName: está bajo 'Nombre' en la sección del cotizante individual. " +
    "NO es 'SOI' ni 'Ministerio de Salud' ni ninguna entidad.\n" +
    "- sheetNumber: número de 10 dígitos que aparece DESPUÉS de la 'Clave Pago'. " +
    "La Clave Pago tiene 8-9 dígitos — no la confundas con el número de planilla.\n" +
    "- documentNumber: cédula del cotizante, aparece bajo 'Documento' o 'No. Identificación'."
  ),
  "asopagos": (
    "Formato Asopagos:\n" +
    "- contractorName: nombre del cotizante individual en la sección de datos personales. " +
    "NO es 'Asopagos' ni el nombre de ninguna entidad.\n" +
    "- sheetNumber: aparece como 'Planilla Nro.:' seguido del número.\n" +
    "- period: puede aparecer en formato YYYY-MM (→ convierte a MM/YYYY)."
  ),
}

export const ARL_ISSUER_INSTRUCTIONS: Record<string, string> = {
  "sura": (
    "Formato ARL Sura:\n" +
    "- contractorName: es el nombre que aparece bajo 'NOMBRE Y APELLIDOS' o 'NOMBRE DEL TRABAJADOR' " +
    "en la tabla de cobertura. NUNCA uses 'ARL SURA', 'Suramericana', ni el nombre de la empresa tomadora.\n" +
    "- documentNumber: la cédula del trabajador afiliado, bajo 'No. IDENTIFICACIÓN' o 'CC'.\n" +
    "- startDate/endDate: busca 'Fecha inicio contrato' y 'Fecha fin contrato' PRIMERO. " +
    "Si no existen, usa 'Fecha inicio de cobertura' y 'Fecha fin de cobertura'.\n" +
    "- status: 'EN COBERTURA' → ACTIVA; 'MORA' → INACTIVA; 'SUSPENDIDA' → SUSPENDIDA."
  ),
  "positiva": (
    "Formato ARL Positiva:\n" +
    "- contractorName: nombre del AFILIADO en la sección 'Datos del Afiliado' o 'Nombre del Trabajador'. " +
    "NO es 'Positiva Compañía de Seguros' ni 'Universidad Nacional de Colombia'.\n" +
    "- documentNumber: cédula del afiliado, no el NIT de la empresa.\n" +
    "- startDate/endDate: busca 'Fecha inicio contrato'/'Fecha fin contrato' primero; " +
    "si no, usa 'Fecha de Inicio'/'Fecha de Fin' de la cobertura."
  ),
  "colmena": (
    "Formato ARL Colmena (Liberty):\n" +
    "- contractorName: nombre del trabajador afiliado en la sección de datos del afiliado. " +
    "NO es 'Colmena', 'Liberty Seguros', ni el tomador del seguro.\n" +
    "- documentNumber: cédula del afiliado (no NIT de la empresa contratante)."
  ),
  "colpatria": (
    "Formato ARL Axa Colpatria:\n" +
    "- contractorName: nombre del afiliado/trabajador. NO es 'Axa Colpatria' ni el nombre del empleador.\n" +
    "- documentNumber: cédula del afiliado."
  ),
  "bolivar": (
    "Formato ARL Bolívar:\n" +
    "- contractorName: nombre del trabajador en la sección de datos del afiliado. " +
    "NO es 'Seguros Bolívar' ni el nombre de la empresa.\n" +
    "- documentNumber: cédula del afiliado."
  ),
}
