# Especificaciones de la App — Verificación de Pagos UNAL

> Basado exclusivamente en las fuentes del notebook de stakeholders (Centro Prototipado).  
> Validado con tres rondas de consultas. Última actualización: 2026-04-23.

---

## 1. Qué hace la aplicación

Herramienta web **mediadora sin base de datos** para contratistas de la Universidad Nacional de Colombia. El usuario sube PDFs, ingresa datos mínimos, y la app verifica aportes a seguridad social y genera el paquete de cobro listo para firma del supervisor.

**No guarda nada.** Procesa en memoria: entra la información, sale el PDF, no queda registro.

---

## 2. Despliegue y acceso

- Servidor institucional proporcionado por la UNAL.
- Sin autenticación — cualquier persona con el enlace puede usarla.
- Uso esperado: mensual, una vez por periodo de cobro.
- Se pueden usar **cookies del navegador** para pre-llenar campos frecuentes (correo, QUIPU) en visitas posteriores.

---

## 3. Paso 1 — Configuración inicial

El usuario responde dos preguntas antes de subir nada:

**¿Cuántos contratos va a tramitar?** → `1` ó `2` (máximo institucional)

**¿Cuántos pagos va a solicitar?** → puede haber pagos acumulados de meses anteriores. Sin límite máximo definido.

---

## 4. Paso 2 — Documentos que se suben

### Siempre obligatorios

| # | Documento |
|---|---|
| 1 | Planilla de pago de seguridad social (PILA) |
| 2 | Certificado de afiliación ARL |
| 3 | Contrato del contratista (PDF) |

### Si hay 2 contratos

Se sube además el **PDF del segundo contrato**. La planilla PILA y el certificado ARL son los mismos para los dos contratos.

### Si la planilla está vencida

La app pide adicionalmente la **planilla del mes siguiente** (ver validaciones).

---

## 5. Paso 3 — Extracción IA: qué se saca de cada documento y a dónde va

Esta es la sección crítica. Para cada documento se detalla exactamente qué datos extrae la IA y en qué casilla de qué formato aparece ese dato.

---

### 5.1 Planilla PILA — datos extraídos

| # | Dato extraído | Tipo | Uso en la app |
|---|---|---|---|
| 1 | Número de planilla | texto | → Formato 053, casilla "número de planilla de seguridad social" |
| 2 | Fecha de pago | fecha | → Formato 053, casilla "fecha de pago de seguridad social" |
| 3 | Fecha límite de pago | fecha | → Solo validación: si `fecha_límite < fecha_pago` → planilla vencida. **No va en formatos.** |
| 4 | Periodo de la planilla | `MM/YYYY` | → Formato 053, casilla "periodo de pago". También alimenta la lógica cedular del 069. |
| 5 | Valor total pagado | número | → Solo validación bloqueante: si `totalAportes > valorPagado` → STOP. **No va en formatos.** |

**Total: 5 campos.** No se extraen campos adicionales de este documento.

---

### 5.2 Certificado ARL — datos extraídos

| # | Dato extraído | Tipo | Uso en la app |
|---|---|---|---|
| 1 | Fecha de inicio de cobertura | fecha | → Formato 069, casilla "fecha inicio" de vigencia del contrato. También para calcular meses. |
| 2 | Fecha fin de cobertura | fecha | → Formato 069, casilla "fecha fin" de vigencia del contrato. También para calcular meses. |
| 3 | Estado de cobertura | `ACTIVA / INACTIVA / SUSPENDIDA` | → Solo validación: si no es ACTIVA → STOP. **No va en formatos.** |
| 4 | Clase de riesgo laboral | `I / II / III / IV / V` | → Formato 069, casilla "clase de riesgo laboral". También para calcular el aporte ARL. |

**Total: 4 campos.** El estado de cobertura se usa solo para validar, no se escribe en ningún formato.

> **Nota importante:** Los certificados ARL varían por entidad (Sura, Positiva, Porvenir, etc.) pero todos contienen estos mismos cuatro datos. Se permite una **gavela de exactamente 2 días** entre las fechas de la ARL y las del contrato.

---

### 5.3 Contrato — datos extraídos

| # | Dato extraído | Tipo | Uso en la app |
|---|---|---|---|
| 1 | Tipo de contrato | `OSE/OPS/OCE/OFS/OCO/ODS/ODO/OCU` | → Formato 053, identificación del contrato. → Formato 069, casilla "tipo de orden contractual". → Nombre del archivo final. |
| 2 | Número de la orden contractual | número | → Formato 053, casilla número de orden. → Formato 069, casilla "número de orden contractual". → Nombre del archivo final. |
| 3 | Año del contrato | número (año actual) | → Formato 053, casilla de vigencia (ej. "OSE 14 / **2026**"). |
| 4 | Nombre completo del contratista | texto | → Formato 053, casilla "nombre del contratista". → Formato 069, casilla "nombre". |
| 5 | Tipo de documento | `CC / NIT` | → Formato 069, casilla "tipo de documento". |
| 6 | Número de documento | número | → Formato 053, casilla "cédula". → Formato 069, casilla "número de identificación". |
| 7 | Valor total del contrato **sin impuestos** | número | → Formato 069, casilla "valor total del contrato". → Insumo para calcular valor mensualizado → IBC → aportes. |
| 8 | Informe de actividades: ¿requiere? | boolean | → Activa o no la solicitud del informe U.FT.12.011.020. **No va en formatos.** |
| 9 | Informe de actividades: cada cuántos meses | número o nulo | → Determina en qué pagos se solicita el informe. **No va en formatos.** |

**Total: 9 campos** (7 que van a los formatos + 2 solo para lógica de informe).

> **Nota:** Las fechas de inicio y fin del contrato **no se extraen del contrato** — el documento no las contiene de forma confiable. Se usan las del certificado ARL.

> **Si son 2 contratos:** se extrae exactamente la misma lista del segundo contrato. La ARL y planilla son compartidas.

---

## 5.4 Revisión y corrección de datos extraídos (después de la IA)

Antes de pasar al formulario manual, la app **muestra al usuario todos los datos que la IA extrajo** de los documentos. El usuario los puede revisar y corregir manualmente si detecta errores (por ejemplo, fechas invertidas por el modelo).

- Cada campo extraído se presenta en pantalla con su valor.
- Cualquier campo puede ser editado antes de continuar.
- Solo cuando el usuario confirme los datos, la app avanza al paso siguiente.

---

## 6. Paso 4 — Datos que ingresa manualmente el usuario

Estos datos no están en ningún documento PDF:

| # | Campo | Obligatorio | Detalle |
|---|---|---|---|
| 1 | Correo institucional | Sí | Email universitario del contratista |
| 2 | ¿Es pensionado? | Sí | Sí / No — afecta cálculo de pensión y FSP |
| 3 | Empresa en QUIPU | Sí | Código numérico (ej. `4013`) |
| 4 | Número de otro sí | No | Solo si el contrato fue modificado. Es **solo informativo**, no cambia cálculos. |
| 5 | Periodo de solicitud de pago | Sí | Mes que está cobrando, formato `MM/YYYY` |
| 6 | Periodo de la planilla | Sí | Mes de la planilla cargada, formato `MM/YYYY`. Debe coincidir con lo extraído del PDF. |
| 7 | Número del pago | Sí | Consecutivo: 1, 2, 3… |
| 8 | Valor a cobrar | Sí | Monto exacto que va a recibir en este periodo |

---

## 7. Paso 5 — Validaciones matemáticas (sin IA, 100% TypeScript)

### 7.1 Cálculo de aportes

```
meses            = fecha_fin_ARL − fecha_inicio_ARL
mensualizado     = valor_total_contrato ÷ meses
IBC_base         = mensualizado × 40%
IBC_final        = max(IBC_base, SMLMV_vigente)

aporte_salud     = IBC_final × 12.5%
aporte_pension   = IBC_final × 16%        ← se omite si es pensionado
FSP              = según normativa         ← se omite si es pensionado
aporte_ARL       = lookup(clase_de_riesgo) ← ver tabla

Total_Aportes    = salud + pensión* + FSP* + ARL
```

**Tabla ARL** (aproximada — verificar tabla oficial 2026):

| Clase | Valor mensual |
|---|---|
| I | ~$10.000 COP |
| II | ~$20.000 COP |
| III | ~$50.000 COP |
| IV | ~$90.000 COP |
| V | ~$120.000 COP |

**Con 2 contratos:** el IBC y los aportes se calculan por separado para cada uno. Sus totales se suman y el resultado se compara contra la única planilla.

### 7.2 Reglas de validación y sus consecuencias

| Validación | Condición de fallo | Consecuencia |
|---|---|---|
| **Aportes suficientes** | `Total_Aportes > valor_pagado_planilla` | 🔴 STOP. Subir planilla correcta. |
| **Planilla vigente** | `fecha_límite_pago < fecha_pago` | 🟡 Pedir también planilla del mes siguiente. |
| **ARL activa** | Estado ≠ `ACTIVA` | 🔴 STOP. No puede continuar. |
| **Periodo consistente** | Periodo manual ≠ periodo extraído del PDF | 🔴 STOP. No puede continuar. |
| **Contraste manual vs IA** | Nombre o documento manual ≠ nombre o documento extraído del contrato | 🟡 Alerta. El usuario puede continuar pero debe confirmar. |
| **Informe requerido** | Contrato exige informe y el pago es múltiplo de la frecuencia | 🟡 Pedir PDF del informe antes de continuar. |
| **Informe bien diligenciado** | `Periodo(%) > Acumulada` o hay casillas vacías o fecha errónea | 🔴 STOP. Corregir informe. |

> **Nota sobre el contraste manual vs IA:** La app cruza los datos que el usuario ingresó manualmente (nombre, número de documento) contra los que la IA extrajo del contrato. Si hay discrepancias, muestra una alerta visible. No es bloqueante — el usuario confirma que es correcto o corrige el dato antes de continuar.

---

## 8. Paso 6 — Informe de actividades (solo si aplica)

Se activa cuando el contrato dice **"ENTREGAR UN INFORME DE EJECUCIÓN DE ACTIVIDADES CADA # MESES"** y el pago actual es múltiplo de esa frecuencia desde el inicio del contrato (normalmente cada 3 meses).

El usuario sube el PDF del formato `U.FT.12.011.020`. La app verifica:

1. En cada fila: `Periodo (%) ≤ Acumulada a la fecha`
2. Sin casillas vacías en la tabla
3. Fecha de diligenciamiento = fecha actual del sistema

**El informe NO se incluye en el PDF final.** Solo sirve para validar.

---

## 9. Paso 7 — Diligenciamiento de los dos formatos

Los formatos generados deben ser **idénticos** a los originales de la universidad: mismo diseño, casillas, imágenes y distribución.

---

### 9.1 Formato 053 — Constancia de Cumplimiento Contractual

Mapa completo de casillas:

| Casilla del formato | Valor que se pone | Origen |
|---|---|---|
| Tipo de contrato | `OSE`, `OPS`, etc. | Extraído del contrato (IA) |
| Número de la orden contractual | ej. `14` | Extraído del contrato (IA) |
| Año | año actual del sistema | Sistema |
| Número de otro sí | el número ingresado, o vacío | Manual (opcional) |
| Empresa QUIPU | ej. `4013` | Manual |
| Nombre completo del contratista | nombre extraído | Contrato (IA) |
| Número de documento (cédula/NIT) | número extraído | Contrato (IA) |
| Número de planilla de seguridad social | número de planilla | Planilla PILA (IA) |
| Fecha de pago de la planilla | fecha de pago | Planilla PILA (IA) |
| Periodo de pago | mes correspondiente (ej. `febrero`) | Planilla PILA (IA) |
| Consecutivo del pago | `1`, `2`, `3`… | Manual |
| Valor a cobrar en este periodo | monto exacto | Manual |
| Fecha de diligenciamiento | fecha actual | Sistema |
| **Firma del supervisor** | **VACÍO** — lo firma el supervisor | — |

---

### 9.2 Formato 069 — Certificación Determinación Cedular

Mapa completo de casillas:

| Casilla del formato | Valor que se pone | Origen |
|---|---|---|
| Fecha de diligenciamiento | fecha actual del sistema | Sistema |
| Nombre completo del contratista | nombre extraído | Contrato (IA) |
| Tipo de documento | `CC` o `NIT` | Contrato (IA) |
| Número de identificación | cédula o NIT | Contrato (IA) |
| Correo institucional | correo ingresado | Manual |
| Empresa QUIPU | ej. `4013` | Manual |
| Tipo de orden contractual | `OSE`, `OPS`, etc. | Contrato (IA) |
| Número de orden contractual | ej. `14` | Contrato (IA) |
| Valor total del contrato (sin impuestos) | valor extraído | Contrato (IA) |
| Fecha inicio de vigencia del contrato | fecha inicio ARL | ARL (IA) |
| Fecha fin de vigencia del contrato | fecha fin ARL | ARL (IA) |
| Clase de riesgo laboral | `I`–`V` | ARL (IA) |
| ¿Es pensionado? | `Sí` / `No` | Manual |
| Número de meses del contrato | calculado: fin − inicio | Calculado |
| Valor mensualizado | calculado: total ÷ meses | Calculado |
| IBC (Ingreso Base de Cotización) | calculado: mensualizado × 40% (mín. SMLMV) | Calculado |
| Aporte obligatorio salud | calculado: IBC × 12.5% | Calculado |
| Aporte obligatorio pensión | calculado: IBC × 16% — **vacío si pensionado** | Calculado |
| Fondo de Solidaridad Pensional | calculado según normativa — **vacío si pensionado** | Calculado |
| Aportes ARL | valor fijo por clase de riesgo | Calculado |
| **Declaración Formal (SI / NO)** | regla cedular (ver abajo) | Calculado |

#### Regla cedular exacta

```
numeroPago = 1                               →  "SI"
numeroPago ≥ 2  AND  periodoSolicitud ≠ periodoPlanilla  →  "NO"
numeroPago ≥ 2  AND  periodoSolicitud = periodoPlanilla  →  "SI"
```

---

## 10. Paso 8 — PDF final unificado

### Orden de páginas (estricto)

```
1. Formato 053 diligenciado
2. Formato 069 diligenciado
3. Planilla de pago original del usuario
   (si había planilla vencida, van las dos aquí)
4. Certificado de ARL original del usuario
```

El informe de actividades **no se incluye** en este PDF.

### Nombre del archivo

```
{QUIPU}Anexos{TipoContrato}{NumeroOrden}.pdf
```

Ejemplo: `4013AnexosOSE14.pdf`

---

## 11. Mapa completo: dato → origen → destino

Resumen de todos los datos del sistema, de dónde vienen y a dónde van:

| Dato | Origen | Validación | Formato 053 | Formato 069 |
|---|---|---|---|---|
| Número de planilla | Planilla PILA (IA) | — | ✅ | — |
| Fecha de pago planilla | Planilla PILA (IA) | — | ✅ | — |
| Fecha límite de pago | Planilla PILA (IA) | ✅ (planilla vencida) | — | — |
| Periodo de la planilla | Planilla PILA (IA) | ✅ (cruce con manual) | ✅ | ✅ (lógica cedular) |
| Valor total pagado | Planilla PILA (IA) | ✅ (regla bloqueante) | — | — |
| Fecha inicio cobertura | ARL (IA) | ✅ (gavela 2 días) | — | ✅ vigencia |
| Fecha fin cobertura | ARL (IA) | ✅ (gavela 2 días) | — | ✅ vigencia |
| Estado de cobertura | ARL (IA) | ✅ (debe ser ACTIVA) | — | — |
| Clase de riesgo | ARL (IA) | — | — | ✅ |
| Tipo de contrato | Contrato (IA) | — | ✅ | ✅ |
| Número de orden | Contrato (IA) | — | ✅ | ✅ |
| Año del contrato | Sistema (año actual) | — | ✅ | — |
| Nombre del contratista | Contrato (IA) | — | ✅ | ✅ |
| Tipo de documento | Contrato (IA) | — | — | ✅ |
| Número de documento | Contrato (IA) | — | ✅ | ✅ |
| Valor contrato sin impuestos | Contrato (IA) | — | — | ✅ + cálculos |
| ¿Requiere informe? (bool) | Contrato (IA) | ✅ (activa flujo informe) | — | — |
| Frecuencia informe (meses) | Contrato (IA) | ✅ (cuándo pedirlo) | — | — |
| Correo institucional | Manual | — | — | ✅ |
| ¿Es pensionado? | Manual | ✅ (modifica cálculos) | — | ✅ |
| Empresa QUIPU | Manual | — | ✅ | ✅ |
| Número de otro sí | Manual (opcional) | — | ✅ | — |
| Periodo de solicitud | Manual | ✅ (cruce periodo) | — | ✅ (lógica cedular) |
| Número del pago | Manual | — | ✅ | — (solo lógica interna) |
| Valor a cobrar | Manual | — | ✅ | — |
| Fecha diligenciamiento | Sistema (hoy) | ✅ (igual en informe) | ✅ | ✅ |
| Meses del contrato | Calculado | — | — | ✅ |
| Valor mensualizado | Calculado | — | — | ✅ |
| IBC | Calculado | — | — | ✅ |
| Aporte salud | Calculado | — | — | ✅ |
| Aporte pensión | Calculado | — | — | ✅ (vacío si pensionado) |
| FSP | Calculado | — | — | ✅ (vacío si pensionado) |
| Aporte ARL | Calculado | — | — | ✅ |
| Declaración Formal (SI/NO) | Calculado (regla cedular) | — | — | ✅ |

---

## 12. Dudas pendientes — requieren respuesta del stakeholder

El notebook no contiene respuesta para estos puntos. Deben resolverse antes de implementar esas partes:

| # | Pregunta | Impacto |
|---|---|---|
| 1 | **Nombre del archivo con 2 contratos**: el patrón estándar es `{QUIPU}Anexos{Tipo}{Numero}.pdf` — ¿cómo queda con dos contratos distintos? ¿Se concatenan? (`4013AnexosOSE14OPS7.pdf`?) | Nombre del archivo final |
| 2 | **FSP — porcentaje exacto**: se menciona como componente del total de aportes pero sin valor. En normativa general es 1% si IBC ≥ 4 SMLMV. ¿Se aplica igual para contratistas UNAL? | Cálculo de aportes y regla bloqueante |
| 3 | **SMLMV 2026 — valor y mantenimiento**: ¿se hardcodea en el código (actualización manual cada enero) o se consulta en alguna fuente/API? | Cálculo del IBC |
| 4 | **2 contratos con distinta frecuencia de informe**: si contrato 1 exige informe cada 3 meses y contrato 2 cada 6, ¿se piden dos informes independientes en el pago correspondiente? | Flujo del informe de actividades |
