# Especificaciones de la App — Verificación de Pagos UNAL

> Basado en las fuentes del notebook de stakeholders (Centro Prototipado) y en el estado actual de implementación.
> Última actualización: 2026-04-29.

---

## 1. Qué hace la aplicación

Herramienta web **mediadora sin base de datos** para contratistas de la Universidad Nacional de Colombia. El usuario sube PDFs, ingresa datos mínimos, y la app verifica aportes a seguridad social y genera el paquete de cobro listo para firma del supervisor.

**No guarda nada en servidor.** Procesa en memoria: entra la información, sale el PDF, no queda registro. Los perfiles de extracción por emisor se guardan en `localStorage` del navegador para mejorar futuras extracciones.

---

## 2. Flujo de 4 pasos

```
Paso 1: Documentos   →   Paso 2: Extracción   →   Paso 3: Validación   →   Paso 4: Resultado
```

---

## 3. Paso 1 — Documentos y datos manuales

**Acceso:** Servidor institucional UNAL, sin autenticación. Los campos frecuentes se pueden pre-llenar con el estado guardado en el store.

### 3.1 Configuración inicial

| Pregunta | Opciones |
|---|---|
| ¿Cuántos contratos? | `1` ó `2` (máximo institucional) |

### 3.2 Documentos obligatorios

| # | Documento |
|---|---|
| 1 | Planilla de pago de seguridad social (PILA) |
| 2 | Certificado de afiliación ARL |
| 3 | Contrato del contratista (PDF) |

Si hay 2 contratos, se sube también el **PDF del segundo contrato**. La planilla PILA y el ARL son los mismos para ambos contratos.

### 3.3 Datos manuales (no están en los PDFs)

| # | Campo | Obligatorio | Detalle |
|---|---|---|---|
| 1 | Correo institucional | Sí | Cualquier correo del contratista |
| 2 | ¿Es pensionado? | Sí | Sí / No — afecta cálculo de pensión y FSP |
| 3 | Empresa en QUIPU | Sí | Código numérico (ej. `4013`) |
| 4 | Número de otro sí | No | Solo informativo, no cambia cálculos |
| 5 | Periodo de solicitud de pago | Sí | Mes que se está cobrando, formato `MM/YYYY` |
| 6 | Tipo de pago | Sí | `Parcial` / `Final` / `Único` — auto-detectado |
| 7 | Número del pago | Sí | Consecutivo: 1, 2, 3… |
| 8 | Valor a cobrar | Sí | Monto exacto en este período |
| 9 | Nombre del supervisor | Sí | Quien firma la constancia 053 |
| 10 | No. identificación del supervisor | Sí | Cédula o documento |
| 11 | Correo del supervisor | Sí | Correo de contacto |
| 12 | Teléfono del supervisor | Sí | Teléfono de contacto |

---

## 4. Paso 2 — Extracción IA y revisión de datos

### 4.1 Proceso de extracción

1. **Extracción de texto**: Los PDFs se envían a `/api/extract-text`, que usa `pdfjs-dist` para extraer el texto de cada documento.
2. **Extracción estructurada con IA**: El texto se envía a `/api/extract`, que usa modelos de IA con fallback para extraer campos estructurados. Los proveedores se intentan en orden:
   - **Mistral**: `devstral-latest` → `mistral-large-latest`
   - **OpenRouter**: `nvidia/nemotron-3-super-120b-a12b:free` → `minimax/minimax-m2.5:free` → `z-ai/glm-4.5-air:free` → `openai/gpt-oss-120b:free` → `openrouter/free`
3. La extracción de los 3–4 documentos corre en paralelo con `Promise.allSettled`.
4. Los resultados se transmiten como eventos NDJSON al cliente (streaming).

### 4.2 Pre-procesamiento antes del prompt

- `joinSplitDates`: repara fechas que el PDF-to-text corta entre líneas.
- `extractPILACandidates` / `extractARLCandidates` / `extractContractCandidates`: extracción por regex (keyword extractor) que genera candidatos para validar con la IA.
- `smartSlice`: toma hasta 12.000 caracteres del documento (70% inicio + 30% final) para respetar el contexto del modelo.
- `fillFromCandidates`: si la IA devuelve nulo en un campo pero el keyword extractor encontró algo, usa el valor del extractor.
- `computeConfidence`: calcula la confianza de cada campo comparando el candidato del extractor vs. el resultado final de la IA.

### 4.3 Datos extraídos por documento

**Planilla PILA** (5 campos):

| Campo | Tipo | Uso |
|---|---|---|
| `sheetNumber` | texto | → Formato 053 |
| `paymentDate` | DD/MM/YYYY | → Formato 053 |
| `paymentDeadline` | DD/MM/YYYY (opcional) | → Validación. Si no está, se calcula por Decreto 780/2016 |
| `period` | MM/YYYY | → Formato 053 + lógica cedular |
| `totalAmountPaid` | número COP | → Validación bloqueante |

**Certificado ARL** (5 campos):

| Campo | Tipo | Uso |
|---|---|---|
| `startDate` | YYYY-MM-DD | → Formato 069 (vigencia) + cálculo meses |
| `endDate` | YYYY-MM-DD | → Formato 069 (vigencia) + cálculo meses |
| `coverageStatus` | `ACTIVA / INACTIVA / SUSPENDIDA` | → Validación bloqueante |
| `riskClass` | `I / II / III / IV / V` | → Formato 069 |
| `cotizationRate` | número (%) | → Cálculo ARL (ej: `1.044` = 1.044%) |

> Los certificados ARL varían por entidad (Sura, Positiva, Colmena, etc.) pero todos contienen estos campos. Se permite una **gavela de exactamente 2 días** entre las fechas ARL y las del contrato.

**Contrato UNAL** (9 campos, misma estructura para contratos 1 y 2):

| Campo | Tipo | Uso |
|---|---|---|
| `contractType` | sigla (OSE, OPS, CCO, etc.) | → Formatos 053 y 069 |
| `orderNumber` | texto | → Formatos 053 y 069 |
| `contractorName` | texto | → Formatos 053 y 069 |
| `documentType` | `CC / NIT / CE` | → Formato 069 |
| `documentNumber` | texto | → Formatos 053 y 069 + cálculo fecha límite |
| `totalValueBeforeTax` | número COP | → Formato 069 + cálculo aportes |
| `startDate` | DD/MM/YYYY | → se sobrescribe con fecha ARL |
| `endDate` | DD/MM/YYYY | → se sobrescribe con fecha ARL |
| `activityReport.required` | boolean | → activa flujo informe |
| `activityReport.frequencyMonths` | número o null | → determina en qué pagos se pide informe |

> **Las fechas del contrato siempre se toman del ARL** — el contrato no las contiene de forma confiable. Las fechas ARL se convierten de ISO a DD/MM/YYYY para los editores.

### 4.4 Revisión y corrección de datos extraídos

Una vez terminada la extracción, el paso 2 muestra **todos los datos extraídos** con campos 100% editables. Cada campo tiene un indicador de confianza:
- 🟢 **Verde**: extractor y IA coinciden — probablemente correcto
- 🟡 **Amarillo**: solo una fuente o difieren — verificar
- 🔴 **Rojo**: ninguna fuente encontró el valor — completar manualmente

Al confirmar, los datos corregidos se guardan en el store y el perfil del emisor se guarda en `localStorage` para mejorar extracciones futuras.

**Comportamiento al volver desde un paso posterior:** si el usuario regresa al paso 2, los editores muestran los datos ya confirmados sin re-ejecutar la IA.

---

## 5. Paso 3 — Validaciones y aportes

### 5.1 Cálculo de aportes

```
contractMonths   = meses entre startDate y endDate del ARL
monthlyValue     = totalValueBeforeTax ÷ contractMonths
ibc              = monthlyValue × 40%
calculationBase  = max(ibc, SMMLV_2026)   // SMMLV 2026 = $1.751.200

healthContribution  = calculationBase × 12.5%
pensionContribution = calculationBase × 16%     ← 0 si es pensionado
solidarityFund      = 0                          ← pendiente confirmar FSP
arlContribution     = calculationBase × (cotizationRate / 100)

totalObligatory = salud + pensión + FSP + ARL
```

**Con 2 contratos:** se calculan los aportes por separado para cada contrato y se suman.

### 5.2 Reglas de validación

| Validación | Condición de fallo | Consecuencia |
|---|---|---|
| **ARL activa** | `coverageStatus ≠ ACTIVA` | 🔴 STOP |
| **Aportes suficientes** | `totalObligatory > totalAmountPaid` | 🔴 STOP |
| **Planilla vigente** | `paymentDate > paymentDeadline` | 🟡 Pedir planilla del mes siguiente |
| **Gavela ARL** | diferencia > 2 días entre fechas ARL y contrato | 🔴 STOP |
| **Informe requerido** | contrato exige informe y número de pago es múltiplo de frecuencia | 🔴 STOP si no se recibe |

> **Fecha límite de pago**: Si la planilla no trae `paymentDeadline`, se calcula según Decreto 780/2016 Art. 3.2.2.1 — los dos últimos dígitos del documento determinan el día hábil límite del mes siguiente al período cotizado.

### 5.3 Informe de actividades (solo si aplica)

Se activa cuando el contrato incluye `activityReport.required = true` y el número de pago es múltiplo de `frequencyMonths` (normalmente cada 3 meses).

El usuario sube el PDF del formato `U.FT.12.011.020`. La app verifica:
1. En cada fila: `Periodo (%) ≤ Acumulada a la fecha`
2. Sin casillas vacías en la tabla

El informe **no se incluye en el PDF final**. Solo sirve para validar.

### 5.4 Regla cedular (declaración formal en formato 069)

```
paymentNumber = 1                                          → "SI"
paymentNumber ≥ 2 AND paymentRequestPeriod ≠ planillaPeriod → "NO"
resto                                                      → "SI"
```

---

## 6. Paso 4 — Generación del PDF final

### 6.1 Orden de páginas

```
1. Formato 053 diligenciado (U.FT.12.010.053)
2. Formato 069 diligenciado (U.FT.12.010.069) — template pendiente
3. Planilla de pago original
   (+ planilla del mes siguiente si hubo pago extemporáneo)
4. Certificado ARL original
```

El informe de actividades **no se incluye**.

### 6.2 Nombre del archivo

```
{QUIPU}Anexos{TipoContrato}{NumeroOrden}.pdf
```

Ejemplo: `4013AnexosOSE14.pdf`

### 6.3 Mapa de casillas — Formato 053

| Casilla | Valor | Origen |
|---|---|---|
| Tipo de contrato | `OSE`, `OPS`, etc. | Contrato (IA) |
| Nombre supervisor | nombre completo | Manual |
| No. identificación supervisor | número | Manual |
| Correo supervisor | correo | Manual |
| Teléfono supervisor | número | Manual |
| Número de la orden contractual | ej. `14` | Contrato (IA) |
| Año | año actual del sistema | Sistema |
| Número de otro sí | el número, o vacío | Manual (opcional) |
| Empresa QUIPU | ej. `4013` | Manual |
| Nombre contratista | nombre extraído | Contrato (IA) |
| Número de documento | cédula/NIT | Contrato (IA) |
| Número de planilla SS | número de planilla | Planilla PILA (IA) |
| Fecha de pago planilla | fecha de pago | Planilla PILA (IA) |
| Periodo de pago | nombre del mes en español | Planilla PILA (IA) |
| Consecutivo del pago | `1`, `2`, `3`… | Manual |
| Valor a cobrar | monto exacto | Manual |
| Fecha de diligenciamiento | fecha actual | Sistema |
| **Firma del supervisor** | **VACÍO** — lo firma el supervisor | — |

### 6.4 Mapa de casillas — Formato 069

| Casilla | Valor | Origen |
|---|---|---|
| Fecha de diligenciamiento | fecha actual | Sistema |
| Nombre contratista | nombre extraído | Contrato (IA) |
| Tipo de documento | `CC` o `NIT` | Contrato (IA) |
| Número de identificación | cédula o NIT | Contrato (IA) |
| Correo | correo | Manual |
| Empresa QUIPU | ej. `4013` | Manual |
| Tipo de orden contractual | `OSE`, `OPS`, etc. | Contrato (IA) |
| Número de orden contractual | ej. `14` | Contrato (IA) |
| Valor total del contrato (sin impuestos) | valor extraído | Contrato (IA) |
| Fecha inicio de vigencia | fecha inicio ARL → DD/MM/YYYY | ARL (IA) |
| Fecha fin de vigencia | fecha fin ARL → DD/MM/YYYY | ARL (IA) |
| Clase de riesgo laboral | `I`–`V` | ARL (IA) |
| ¿Es pensionado? | `Sí` / `No` | Manual |
| Número de meses del contrato | calculado: fin − inicio | Calculado |
| Valor mensualizado | calculado: total ÷ meses | Calculado |
| IBC | calculado: mensualizado × 40% (mín. SMMLV) | Calculado |
| Aporte salud | IBC × 12.5% | Calculado |
| Aporte pensión | IBC × 16% — **vacío si pensionado** | Calculado |
| Fondo de Solidaridad Pensional | pendiente — **vacío si pensionado** | Calculado |
| Aportes ARL | cotizationRate% × base | Calculado |
| Declaración Formal (SI / NO) | regla cedular | Calculado |

#### Tipo de pago — lógica automática

```
paymentsToRequest === 1                                     → "Único"
isLastExecutionMonth OR paymentNumber === paymentsToRequest → "Final"
else                                                        → "Parcial"
```

`isLastExecutionMonth` = `true` cuando el mes/año del periodo de solicitud coincide con el mes/año de la fecha fin del contrato (ARL).

---

## 7. Constantes normativas 2026

Definidas en `lib/validations/constantes.ts`:

| Constante | Valor | Descripción |
|---|---|---|
| `IBC_PORCENTAJE` | 0.4 | 40% del valor mensualizado |
| `APORTE_SALUD_PORCENTAJE` | 0.125 | 12.5% |
| `APORTE_PENSION_PORCENTAJE` | 0.16 | 16% |
| `SMMLV_2026` | $1.751.200 | Verificar con decreto oficial |
| `GAVELA_DIAS_ARL` | 2 días | Tolerancia fechas ARL vs. contrato |

⚠️ Actualizar `SMMLV_2026` cada enero con el decreto oficial.

---

## 8. Dudas pendientes — requieren respuesta del stakeholder

| # | Pregunta | Impacto |
|---|---|---|
| 1 | **Nombre del archivo con 2 contratos**: ¿cómo queda con dos contratos? ¿Se concatenan? (`4013AnexosOSE14OPS7.pdf`?) | Nombre del archivo final |
| 2 | **FSP — porcentaje exacto**: componente del total de aportes, actualmente en 0. En normativa general es 1% si IBC ≥ 4 SMMLV. ¿Aplica igual para contratistas UNAL? | Cálculo de aportes y regla bloqueante |
| 3 | **Template 069**: el formato 069 aún no tiene el template PDF con coordenadas validadas | Generación del PDF final |
| 4 | **2 contratos con distinta frecuencia de informe**: si contrato 1 exige informe cada 3 meses y contrato 2 cada 6, ¿se piden dos informes independientes? | Flujo del informe de actividades |
