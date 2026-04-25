# Plan: App de Verificación de Pagos — Universidad Nacional de Colombia

> **Este archivo vive en el repo** (sincroniza entre PCs vía git).
> Fuente original aprobada también subida al notebook NotebookLM **Centro Prototipado**.

## Contexto

**Problema**: Los contratistas de la Universidad Nacional de Colombia deben verificar manualmente que sus aportes a seguridad social cumplan la normativa colombiana antes de solicitar pagos, y luego diligenciar dos formatos oficiales (U.FT.12.010.053 y U.FT.12.010.069) para la firma del supervisor. Este proceso es tedioso, propenso a errores y consume horas de trabajo.

**Solución**: Una aplicación web **mediadora** (sin base de datos por privacidad) que:
1. Recibe 3 PDFs (planilla seguridad social, certificado ARL, contrato) + datos manuales mínimos.
2. Extrae datos estructurados con IA (Google Gemini vía **OpenRouter** + `generateObject`).
3. Valida matemáticamente los aportes con **TypeScript puro** (no IA).
4. Rellena los dos formatos oficiales y genera un PDF unificado con nombre normalizado.

**Resultado esperado**: Un PDF listo para firma (`{QUIPU}Anexos{TipoContrato}{Numero}.pdf`) en menos de 2 minutos, con alertas bloqueantes si los aportes son insuficientes.

---

## Stack Técnico

**Existente**:
- Next.js 16.1.7 (App Router) + React 19.2.4 + TypeScript 5.9.3 (strict)
- Tailwind CSS 4.2.1 + shadcn/ui (`radix-nova` style, `mist` color)
- pnpm como package manager

**Instalado**:
- `ai` + `@openrouter/ai-sdk-provider` — Vercel AI SDK con OpenRouter
- `zod` — esquemas para `generateObject`
- `pdf-lib` — rellenar formatos y unificar PDFs
- `pdfjs-dist` — extracción de texto crudo (Fase 2)
- `date-fns` — cálculo de meses entre fechas
- `react-hook-form` + `@hookform/resolvers` — manejo de formularios
- `zustand` — estado global del wizard
- Componentes shadcn: `input`, `label`, `card`, `field`, `alert`, `tabs`, `select`, `switch`, `separator`, `progress`, `sonner`, `scroll-area`
  > Nota: en el estilo `radix-nova` v4, shadcn **retiró el componente `form`**. Los formularios se construyen con `useForm` + `<Controller>` de `react-hook-form` directamente + los building blocks del componente `field` (`<Field>`, `<FieldLabel>`, `<FieldDescription>`, `<FieldError>`, `<FieldGroup>`, `<FieldSet>`, `<FieldLegend>`).

**Env vars**:
- `OPENROUTER_API_KEY` — API key de OpenRouter (en `.env.local`, ignorado por git)
- Modelo por defecto: `google/gemini-2.5-flash` (editable en `lib/ai/client.ts`)

---

## Schema Zod para `generateObject`

Ubicación: `lib/schemas/`

```ts
// lib/schemas/payment-sheet.ts
export const PlanillaSchema = z.object({
  numeroPlanilla: z.string().describe("Número identificador de la planilla"),
  fechaPago: z.string().describe("Fecha en que se realizó el pago (YYYY-MM-DD)"),
  fechaLimitePago: z.string().describe("Fecha límite para pagar sin mora (YYYY-MM-DD)"),
  periodo: z.string().describe("Periodo de la planilla en formato MM/YYYY"),
  valorTotalPagado: z.number().describe("Valor total pagado en COP, sin puntos ni comas"),
});

// lib/schemas/arl.ts
export const ARLSchema = z.object({
  fechaInicio: z.string().describe("Fecha inicio cobertura (YYYY-MM-DD)"),
  fechaFin: z.string().describe("Fecha fin cobertura (YYYY-MM-DD)"),
  estadoCobertura: z.enum(["ACTIVA", "INACTIVA", "SUSPENDIDA"]),
  claseRiesgo: z.enum(["I", "II", "III", "IV", "V"]).describe("Clase riesgo romano"),
});

// lib/schemas/contract.ts
export const ContratoSchema = z.object({
  tipoContrato: z.enum(["OSE", "OPS", "OCE", "OFS", "OCO", "ODS", "ODO", "OCU"]),
  numeroOrden: z.string().describe("Número de orden contractual (después del tipo)"),
  nombreContratista: z.string(),
  tipoDocumento: z.enum(["CC", "NIT", "CE"]),
  numeroDocumento: z.string(),
  valorTotalSinImpuestos: z.number().describe("Valor total sin impuestos de contratación especial"),
  informeActividades: z.object({
    requiere: z.boolean(),
    frecuenciaMeses: z.number().nullable().describe("Cada cuántos meses entregar informe"),
  }),
});
```

**Llamada a `generateObject` con OpenRouter (ejemplo)**:
```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const { object } = await generateObject({
  model: openrouter.chat("google/gemini-2.5-flash"),
  schema: ContratoSchema,
  messages: [{
    role: "user",
    content: [
      { type: "file", data: pdfBuffer, mediaType: "application/pdf" },
      { type: "text", text: "Extrae los datos estructurados de este contrato..." },
    ],
  }],
});
```

---

## Lógica de Validación Matemática (TypeScript puro, sin IA)

Ubicación: `lib/validations/aportes.ts`

**Constantes normativas Colombia** (`lib/validations/constantes.ts`):
```ts
export const IBC_PORCENTAJE = 0.40;               // 40% del mensualizado
export const APORTE_SALUD = 0.125;                // 12.5%
export const APORTE_PENSION = 0.16;               // 16%
export const ARL_POR_CLASE: Record<ClaseRiesgo, number> = {
  I: 10_000, II: 20_000, III: 50_000, IV: 90_000, V: 120_000
}; // tabla de referencia — confirmar valores exactos con normativa vigente 2026
```

**Funciones puras (todas devuelven números deterministas)**:
- `calcularMesesContrato(fechaInicio, fechaFin): number` — usa `date-fns/differenceInMonths`.
- `calcularValorMensualizado(valorTotal, meses): number` — `valorTotal / meses`.
- `calcularIBC(valorMensual): number` — `valorMensual * 0.40`.
- `calcularAporteSalud(ibc): number` — `ibc * 0.125`.
- `calcularAportePension(ibc): number` — `ibc * 0.16`.
- `calcularAporteARL(claseRiesgo): number` — lookup tabla.
- `calcularTotalAportes(datos): number` — suma de salud + pensión + ARL.

**Funciones de validación** (devuelven `{ ok: boolean; mensaje?: string }`):
- `validarPago(totalAportes, valorPagado)` — bloquea si `valorPagado < totalAportes`.
- `validarFechaPago(fechaPago, fechaLimite)` — si vencida, solicitar planilla siguiente.
- `validarInformeActividades(fechaInicio, fechaActual, frecuenciaMeses, informe)` — verifica columnas Periodo(%) ≤ Acumulada y diligenciamiento completo.
- `calcularDeclaracionCedular(periodoSolicitud, periodoPlanilla, numeroPago): "SI" | "NO"` — reglas: `pago=1` → "SI" siempre; `pago≥2 && periodos distintos` → "NO"; resto → "SI".

---

## Reglas de Negocio Críticas

### Regla Bloqueante Principal
```ts
// Si totalAportesObligatorios > valorPagadoEnPlanilla → STOP con alerta roja
if (totalAportes > valorPagadoPlanilla) {
  return {
    ok: false,
    bloqueante: true,
    mensaje: `El valor pagado ($${valorPagado}) es menor al mínimo obligatorio ($${totalAportes}).`
  };
}
```

### Regla Cedular (Formato 069)
```ts
// numeroPago = 1 → siempre "SI"
// numeroPago ≥ 2 && periodoSolicitud ≠ periodoPlanilla → "NO"
// resto → "SI"
function calcularDeclaracionCedular(
  periodoSolicitud: string,
  periodoPlanilla: string,
  numeroPago: number
): "SI" | "NO" {
  if (numeroPago === 1) return "SI";
  if (numeroPago >= 2 && periodoSolicitud !== periodoPlanilla) return "NO";
  return "SI";
}
```

### Orden de Unificación PDF
El PDF final debe unir los documentos en este orden estricto:
1. `U.FT.12.010.053` — Constancia de cumplimiento contractual (diligenciado)
2. `U.FT.12.010.069` — Certificación determinación cedular (diligenciado)
3. Planilla de pago original (subida por el usuario)
4. Certificado ARL original (subido por el usuario)

### Nomenclatura del Archivo Final
`{QUIPU}Anexos{TipoContrato}{Numero}.pdf` — ejemplo: `4013AnexosOSE14.pdf`

---

## Estructura de Templates PDF

Los templates oficiales viven en `lib/templates/` (no en `public/`) porque solo los usa `pdf-lib` en el servidor (Route Handler). Nunca se exponen al cliente.

```
lib/
  templates/
    U.FT.12.010.053_Constancia_cumplimiento.pdf   ← usuario proveerá
    U.FT.12.010.069_Certificacion_cedular.pdf      ← usuario proveerá
```

> ⚠️ Los archivos PDF se añaden a `.gitignore` si contienen membrete institucional. Si son plantillas públicas, se pueden versionar.

**Carga en Route Handler**:
```ts
import path from "path";
import { readFile } from "fs/promises";

const templatePath = path.join(process.cwd(), "lib", "templates", "U.FT.12.010.053_Constancia_cumplimiento.pdf");
const templateBytes = await readFile(templatePath);
```

---

## Roadmap de Desarrollo (5 Fases)

### Fase 1 — UI / Carga de Documentos ✅ (parcialmente implementada)

**Objetivo**: Interfaz completa, funcional y validada, sin backend.

**Archivos**:
- `app/page.tsx` — landing con CTA a `/verificar`
- `app/verificar/page.tsx` — wizard multi-paso
- `components/upload/document-dropzone.tsx` — drop zone para PDF
- `components/upload/datos-manuales-form.tsx` — formulario react-hook-form + `<Field>` + `<Controller>`
- `components/upload/segundo-contrato.tsx` — sección condicional
- `lib/types.ts` — tipos `EstadoVerificacion`, `DatosManuales`, etc.
- `lib/store.ts` — `zustand` store para estado global del wizard
- `lib/schemas/manual-form.ts` — schema Zod para validación del formulario

**Campos del formulario manual**:
- `numContratos`: 1 | 2
- `numPagosSolicitar`: number
- `correoInstitucional`: email — regex `/@unal\.edu\.co$/`
- `esPensionado`: boolean
- `empresaQUIPU`: string (numérico)
- `numeroOtroSi`: string (opcional)
- `periodoSolicitudPago`: MM/YYYY
- `periodoPlanilla`: MM/YYYY
- `numeroPago`: number
- `valorACobrar`: number

---

### Fase 2 — Extracción de Texto Crudo ✅ (parcialmente implementada)

**Objetivo**: Preview del contenido de cada PDF antes de enviarlo a la IA.

**Archivos**:
- `lib/pdf/extract-text.ts` — wrapper sobre `pdfjs-dist`
- `app/api/extract-text/route.ts` — Route Handler que devuelve texto crudo por documento
- `components/upload/preview-texto.tsx` — muestra texto en `<ScrollArea>` colapsable

**Flujo**:
1. Client envía FormData con los 3 PDFs.
2. Server extrae texto por página con `pdfjs-dist`.
3. Devuelve `{ planilla: string, arl: string, contrato: string }`.
4. Si algún PDF devuelve < 50 caracteres, avisar "PDF posiblemente escaneado".

---

### Fase 3 — Extracción Estructurada con IA ✅

**Objetivo**: Convertir los 3 PDFs en objetos tipados con `generateObject` + OpenRouter.

**Archivos**:
- `lib/ai/client.ts` — cliente AI SDK con provider OpenRouter ✅
- `app/api/extract/route.ts` — orquesta las 3 extracciones en paralelo con `Promise.all` ✅
- `lib/schemas/payment-sheet.ts`, `lib/schemas/arl.ts`, `lib/schemas/contract.ts` — schemas Zod ✅

**Detalles implementados**:
- PDF enviado como `{ type: "file", data: Buffer, mediaType: "application/pdf" }` (Gemini acepta PDF nativo).
- `ContratoSchema` incluye `startDate` y `endDate` (DD/MM/YYYY) para la tabla de contratos del 069 y validación gavela ARL.
- `app/api/extract/route.ts` usa `Promise.all` para extraer planilla, ARL y contrato en paralelo.

---

### Fase 4 — Validaciones Matemáticas ✅

**Objetivo**: Aplicar todas las reglas de la normativa colombiana al dataset extraído.

**Archivos**:
- `lib/validations/constantes.ts` — constantes normativas (`IBC_PORCENTAJE`, `APORTE_SALUD`, `APORTE_PENSION`, `ARL_POR_CLASE`, `SEDE`, `DEPENDENCIA`) ✅
- `lib/validations/aportes.ts` — `calcularContribuciones`, `validarPago` ✅
- `lib/validations/fechas.ts` — `validarFechaPago`, `calcularMesesContrato`, `validarGavelaARL` ✅
- `lib/validations/informe.ts` — `validarInformeActividades`, `resolverInforme053` ✅
- `lib/validations/cedular.ts` — `calcularDeclaracionCedular` ✅
- `lib/validations/index.ts` — orquestador `runValidations(extracted, manual, informeRecibido)` → `ValidationSummary` ✅
- `components/wizard/step-3.tsx` — UI con resultado por validación + grid de aportes, botón bloqueado si `summary.blocked` ✅

---

### Fase 5 — Generación del PDF Final ✅

**Objetivo**: Rellenar los formatos oficiales con `pdf-lib` y unificar los 4 documentos en un solo PDF descargable.

**Archivos**:
- `lib/templates/U.FT.12.010.053_Constancia_de_cumplimiento_contractual_V4.0.docx.pdf` ✅
- `lib/templates/U-FT-12.010.069_Certificacion_determinacion_cedular_Rentas_de_Trabajo_V.6.0.VF.pdf` ✅
- `lib/pdf/llenar-formatos.ts` — llenado completo de ambos formatos con coordenadas validadas vía pdfplumber ✅
- `lib/pdf/build-format-data.ts` — builders `buildFormat053Data` / `buildFormat069Data` ✅
- `lib/pdf/utils.ts` — `nombreArchivoFinal()` ✅
- `app/api/generar-pdf/route.ts` — POST multipart → devuelve PDF unificado como `application/pdf` ✅
- `components/wizard/step-4.tsx` — UI idle/loading/error/ready con descarga directa ✅

**Estrategia implementada**:
- Templates sin AcroForm fields (confirmado con pdfplumber) → `page.drawText()` con coordenadas exactas.
- `blank(x, y, w, h)` dibuja rectángulos blancos opacos sobre placeholders existentes.
- `drawC()` centra texto con `font.widthOfTextAtSize()` (SEDE, DEPENDENCIA).
- Coordenadas validadas contra archivos reales en abril 2026 (ver memory `project_templates_coords.md`).
- `unificarPDFs` une 053 + 069 + planilla + ARL en ese orden.

---

## Verificación End-to-End

Al completar las 5 fases, probar con:

1. **Happy path**: contrato OSE, 1 pago, planilla al día, aportes suficientes → PDF descargado sin alertas.
2. **Aportes insuficientes**: valor pagado < obligatorio → alerta roja bloqueante, no avanza.
3. **Planilla vencida**: `fechaPago > fechaLimitePago` → pide segunda planilla.
4. **Dos contratos**: `numContratos=2` → solicita segundo contrato, extrae ambos, suma aportes.
5. **Informe requerido**: contrato con "INFORME CADA 3 MESES" + fecha actual cumple múltiplo → solicita adjuntar informe.
6. **Cedular pago=2 con periodos distintos**: verifica que en el PDF 069 aparezca "NO" en la declaración formal.

```bash
pnpm dev          # Servidor local
pnpm typecheck    # Verificar sin build
```

---

## Archivos Críticos (resumen)

| Fase | Archivo | Estado |
|---|---|---|
| 1 | `app/verificar/page.tsx` | ✅ |
| 1 | `lib/store.ts` | ✅ |
| 1 | `lib/types.ts` | ✅ |
| 2 | `lib/pdf/extract-text.ts` | ✅ |
| 2 | `app/api/extract-text/route.ts` | ✅ |
| 3 | `lib/schemas/*.ts` | ✅ |
| 3 | `lib/ai/client.ts` | ✅ |
| 3 | `app/api/extract/route.ts` | ✅ |
| 4 | `lib/validations/constantes.ts` | ✅ |
| 4 | `lib/validations/aportes.ts` | ✅ |
| 4 | `lib/validations/fechas.ts` | ✅ |
| 4 | `lib/validations/informe.ts` | ✅ |
| 4 | `lib/validations/cedular.ts` | ✅ |
| 4 | `lib/validations/index.ts` | ✅ |
| 4 | `components/wizard/step-3.tsx` | ✅ |
| 5 | `lib/templates/*.pdf` | ✅ |
| 5 | `lib/pdf/llenar-formatos.ts` | ✅ |
| 5 | `lib/pdf/build-format-data.ts` | ✅ |
| 5 | `app/api/generar-pdf/route.ts` | ✅ |
| 5 | `components/wizard/step-4.tsx` | ✅ |

---

## Pendientes / Bloqueantes Conocidos

1. **Tabla ARL por riesgo**: los valores ($10K riesgo I, $20K riesgo II) son aproximados. Confirmar tabla oficial vigente 2026 antes de producción.
2. **IBC 40%**: centralizado en `lib/validations/constantes.ts` para actualización anual.
3. **Formato U.FT.12.011.020** (Informe de ejecución): requerido cuando el contrato exige informe cada N meses — diseño pendiente.
4. **Dos contratos (`contractCount=2`)**: `runValidations` actualmente solo procesa `extracted.contract`. Cuando hay dos contratos, los aportes del segundo no se suman. Ver test case #4 en Verificación End-to-End.
5. **Planilla vencida (segundo upload)**: cuando `fechaPago > fechaLimite`, la validación bloquea y avisa, pero no hay flujo UI para subir una segunda planilla del mes siguiente.
