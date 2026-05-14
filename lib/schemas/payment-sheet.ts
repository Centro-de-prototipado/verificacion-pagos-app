import { z } from "zod"

import { dateField, docField, nameField, periodField } from "./_shared"

const NULL =
  " Si NO aparece EXPLÍCITAMENTE escrito en el texto, devuelve null. " +
  "NUNCA inventes ni infieras valores. NUNCA copies valores de otros campos."

export const PaymentSheetSchema = z.object({
  sheetNumber: docField()
    .nullable()
    .describe(
      "Número único de la planilla PILA. " +
        "BUSCA después de etiquetas como: 'Número de Planilla', 'No. Planilla', 'Planilla N°', " +
        "'Planilla No.', 'Referencia de Pago', 'Identificador Planilla', 'Número Único'. " +
        "IGNORA siempre estos campos parecidos: 'Clave de Pago', 'Número Transacción Bancaria', " +
        "'Número Transacción', 'CUS', 'Número Recibo', 'Referencia Recaudo', 'PIN', " +
        "'Código de Pago', 'Token', 'Número Comprobante'." +
        NULL
    ),
  paymentDate: dateField()
    .nullable()
    .describe(
      "Fecha en que efectivamente se pagó la planilla, en formato DD/MM/YYYY. " +
        "DEBE ser una fecha COMPLETA con día (DD/MM/YYYY o YYYY-MM-DD). " +
        "NUNCA devuelvas un período (MM/YYYY o YYYY-MM) — eso es otro campo. " +
        "BUSCA después de: 'Fecha de Pago', 'Fecha Pago', 'Pagado el', 'PAGADO', " +
        "'Fecha Efectiva de Pago', 'Fecha de Cancelación', 'Fecha transacción'. " +
        "IGNORA: 'Fecha de Generación', 'Fecha de Expedición', 'Fecha Límite', " +
        "'Fecha de Vencimiento', 'Fecha Pago Oportuno', 'Fecha de Liquidación', " +
        "'Período' (es el mes cotizado, va en otro campo)." +
        NULL
    ),
  paymentDeadline: dateField()
    .nullable()
    .describe(
      "Fecha LÍMITE máxima para pagar sin recargo, en DD/MM/YYYY. " +
        "BUSCA después de: 'Fecha Límite de Pago', 'Fecha Pago Oportuno', " +
        "'Fecha de Vencimiento', 'Plazo Máximo', 'Vencimiento'. " +
        "IGNORA la fecha de pago efectivo." +
        NULL
    ),
  period: periodField()
    .nullable()
    .describe(
      "Mes/año cotizado en formato MM/YYYY (ej: '03/2026'). " +
        "BUSCA después de: 'Período de Cotización', 'Período Cotizado', " +
        "'Mes de Cotización', 'Período Pagado', 'Período Liquidado', 'Período'. " +
        "Si aparece como nombre de mes ('marzo de 2026'), convierte a 03/2026. " +
        "IGNORA: la fecha de pago, el período del informe, vigencias del contrato." +
        NULL
    ),
  totalAmountPaid: z
    .number()
    .nullable()
    .describe(
      "Valor TOTAL pagado en COP (suma de todos los aportes), número sin separadores. " +
        "BUSCA después de: 'Total Pagado', 'Valor Total', 'Total a Pagar', " +
        "'Total Aportes', 'Total Cancelado', 'Total Planilla', 'Gran Total', " +
        "'SUBTOTAL SIN INTERESES DE MORA', 'TOTAL FINAL', 'VALOR A PAGAR'. " +
        "IGNORA SIEMPRE: 'IBC' (Ingreso Base de Cotización — es la base de cálculo, NO el pago), " +
        "subtotales individuales (Salud, Pensión, ARL por separado), líneas parciales. " +
        "Suele ser el valor MENOR de los totales grandes (los IBC son varias veces más altos)." +
        NULL
    ),
  contractorName: nameField()
    .nullable()
    .describe(
      "Nombre del COTIZANTE (la persona natural que paga sus aportes). " +
        "BUSCA después de: 'Cotizante', 'Nombres y Apellidos del Cotizante', " +
        "'Datos del Cotizante', 'Afiliado', 'Trabajador Independiente'. " +
        "IGNORA y NUNCA uses: nombre del operador (Asopagos, Simple, Aportes en Línea, " +
        "SOI, Enlace Operativo, Mi Planilla), 'Razón Social', 'Operador', " +
        "'Universidad Nacional de Colombia', 'Aportante' cuando es un empleador." +
        NULL
    ),
  documentNumber: docField()
    .nullable()
    .describe(
      "Documento del COTIZANTE (CC, NIT o CE de la persona natural). " +
        "BUSCA después de: 'CC Cotizante', 'Documento Cotizante', " +
        "'Identificación Cotizante', 'Número de Identificación del Cotizante'. " +
        "IGNORA: NIT del operador, NIT de UNAL (899999063), documento del beneficiario." +
        NULL
    ),
})

export type PaymentSheetExtracted = z.infer<typeof PaymentSheetSchema>
