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

**Instalado en esta sesión**:
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
// lib/schemas/planilla.ts
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

// lib/schemas/contrato.ts
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
}; // tabla de referencia — confirmar valores exactos con normativa vigente
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

## Roadmap de Desarrollo (5 Fases)

### Fase 1 — UI / Carga de Documentos

**Objetivo**: Interfaz completa, funcional y validada, sin backend.

**Archivos a crear**:
- `app/page.tsx` — landing con CTA a `/verificar`
- `app/verificar/page.tsx` — wizard multi-paso
- `components/upload/document-dropzone.tsx` — drop zone para PDF (usando `<Input type="file">` + estilos)
- `components/upload/datos-manuales-form.tsx` — formulario react-hook-form + `<Field>` + `<Controller>`
- `components/upload/segundo-contrato.tsx` — sección condicional
- `lib/types.ts` — tipos `EstadoVerificacion`, `DatosManuales`, etc.
- `lib/store.ts` — `zustand` store para estado global del wizard
- `lib/schemas/form-datos-manuales.ts` — schema Zod para validación del formulario

**Patrón de formulario (radix-nova v4)**:
```tsx
const form = useForm<DatosManuales>({
  resolver: zodResolver(DatosManualesSchema),
  mode: "onBlur",
});

<form onSubmit={form.handleSubmit(onSubmit)}>
  <Controller
    name="correoInstitucional"
    control={form.control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>Correo institucional</FieldLabel>
        <Input {...field} id={field.name} type="email" aria-invalid={fieldState.invalid} />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
</form>
```

**Campos del formulario manual**:
- `numContratos`: 1 | 2 (`<Select>` + `<Controller>`)
- `numPagosSolicitar`: number (`<Input type="number">`)
- `correoInstitucional`: email — validación regex `/@unal\.edu\.co$/` en Zod
- `esPensionado`: boolean (`<Switch>` + `<Controller>` con `field.value` / `field.onChange`)
- `empresaQUIPU`: string (numérico)
- `numeroOtroSi`: string (optional)
- `periodoSolicitudPago`: MM/YYYY (regex Zod)
- `periodoPlanilla`: MM/YYYY (regex Zod)
- `numeroPago`: number
- `valorACobrar`: number

**Criterio de éxito**: Se puede subir 3 PDFs, llenar el form, ver validación cliente (errores in-line con `<FieldError>`) y avanzar al paso 2.

---

### Fase 2 — Extracción de Texto Crudo

**Objetivo**: Preview del contenido de cada PDF antes de enviarlo a la IA (UX de confianza + detectar PDFs escaneados sin texto).

**Archivos a crear**:
- `lib/pdf/extract-text.ts` — wrapper sobre `pdfjs-dist`
- `app/api/extract-text/route.ts` — Route Handler que recibe FormData y devuelve texto crudo por documento
- `components/upload/preview-texto.tsx` — muestra el texto extraído en un `<ScrollArea>` colapsable

**Flujo**:
1. Client envía FormData con los 3 PDFs.
2. Server extrae texto por página con `pdfjs-dist`.
3. Devuelve `{ planilla: string, arl: string, contrato: string }`.
4. Si algún PDF devuelve < 50 caracteres, avisar "PDF posiblemente escaneado — la IA multimodal lo procesará de todas formas".

**Criterio de éxito**: Usuario ve preview del texto de cada PDF y puede confirmar antes de enviar a IA.

---

### Fase 3 — Extracción Estructurada con IA

**Objetivo**: Convertir los 3 PDFs en objetos tipados usando `generateObject` + OpenRouter (modelo Gemini 2.5 Flash multimodal).

**Archivos a crear**:
- `lib/ai/client.ts` — cliente AI SDK con provider OpenRouter
- `lib/ai/extract-planilla.ts` — usa `PlanillaSchema`
- `lib/ai/extract-arl.ts` — usa `ARLSchema`
- `lib/ai/extract-contrato.ts` — usa `ContratoSchema`
- `app/api/extract/route.ts` — orquesta las 3 extracciones **en paralelo** con `Promise.all`

**Detalles clave**:
- Pasar el PDF como `{ type: "file", data: Buffer, mediaType: "application/pdf" }` (Gemini vía OpenRouter acepta PDF nativo).
- Sistema de reintentos: si `generateObject` falla validación Zod, reintentar 1 vez con prompt más explícito.
- Si extracción exitosa → guardar resultado en el store client-side para Fase 4.

**Criterio de éxito**: Los 3 PDFs producen objetos validados por Zod en < 15 segundos.

---

### Fase 4 — Validaciones Matemáticas

**Objetivo**: Aplicar todas las reglas de la normativa colombiana al dataset extraído.

**Archivos a crear**:
- `lib/validations/constantes.ts` — constantes normativas
- `lib/validations/aportes.ts` — funciones puras descritas arriba
- `lib/validations/fechas.ts` — `validarFechaPago`, `calcularMesesContrato`
- `lib/validations/informe.ts` — `validarInformeActividades`
- `lib/validations/cedular.ts` — `calcularDeclaracionCedular`
- `lib/validations/index.ts` — orquestador `ejecutarTodasLasValidaciones(datos): ResultadoValidacion`
- `components/verificacion/resultado-validaciones.tsx` — UI con `<Alert>` por cada validación (verde OK / rojo bloqueante)

**Regla bloqueante principal**:
```ts
if (totalAportes > valorPagadoPlanilla) {
  return {
    ok: false,
    bloqueante: true,
    mensaje: `El valor pagado ($${valorPagado}) es menor al mínimo obligatorio ($${totalAportes}). No se puede continuar.`
  };
}
```

**Criterio de éxito**: Los 4 tipos de validación se ejecutan, los bloqueantes impiden avanzar y muestran alerta clara.

---

### Fase 5 — Generación del PDF Final

> ⚠️ **Templates PDF oficiales diferidos**: el usuario proveerá los archivos `U.FT.12.010.053` y `U.FT.12.010.069` en blanco más adelante. Esta fase se implementa cuando estén disponibles. Hasta entonces, podemos construir el resto del pipeline end-to-end.

**Archivos a crear/requerir (cuando lleguen templates)**:
- `public/templates/U.FT.12.010.053_Constancia_cumplimiento.pdf` — **pendiente**
- `public/templates/U.FT.12.010.069_Certificacion_cedular.pdf` — **pendiente**
- `lib/pdf/llenar-053.ts` — usa `pdf-lib` para llenar campos del Constancia
- `lib/pdf/llenar-069.ts` — usa `pdf-lib` para llenar campos del Certificación cedular
- `lib/pdf/unificar.ts` — merge: 053 → 069 → planilla original → ARL original
- `app/api/generar-pdf/route.ts` — endpoint que devuelve el PDF final
- `components/verificacion/boton-descarga.tsx` — descarga con `{QUIPU}Anexos{TipoContrato}{Numero}.pdf`

**Estrategia de llenado**:
1. Intentar con `form.getTextField()` si los templates tienen AcroForm fields.
2. Si no, usar `page.drawText()` con coordenadas X/Y mapeadas (se mapean una sola vez por template).

**Regla especial cedular**:
En formato 069, apartado **DECLARACIÓN FORMAL PARA DISMINUCIÓN DE BASE DE RETENCIÓN**:
- `numeroPago=1` → siempre "SI"
- `numeroPago≥2 && periodoSolicitud ≠ periodoPlanilla` → "NO"
- Resto → "SI"

**Criterio de éxito**: El usuario descarga un PDF unificado con los 4 documentos en el orden correcto y el nombre normalizado.

---

## Verificación End-to-End

Al completar las 5 fases, probar con:

1. **Happy path**: contrato OSE, 1 pago, planilla al día, aportes suficientes → PDF descargado sin alertas.
2. **Aportes insuficientes**: valor pagado < obligatorio → alerta roja bloqueante, no avanza.
3. **Planilla vencida**: `fechaPago > fechaLimitePago` → pide segunda planilla.
4. **Dos contratos**: `numContratos=2` → solicita segundo contrato, extrae ambos, suma aportes.
5. **Informe requerido**: contrato con "INFORME CADA 3 MESES" + fecha actual cumple múltiplo → solicita adjuntar informe.
6. **Cedular pago=2 con periodos distintos**: verifica que en el PDF 069 aparezca "NO" en la declaración formal.

**Comandos de verificación**:
```bash
pnpm dev                    # Servidor local
pnpm build && pnpm start    # Verificar build de producción
```

---

## Archivos Críticos (resumen)

| Fase | Archivo | Propósito |
|---|---|---|
| 1 | `app/verificar/page.tsx` | Wizard principal |
| 1 | `components/upload/*` | UI de carga |
| 2 | `lib/pdf/extract-text.ts` | Texto crudo con pdfjs-dist |
| 3 | `lib/schemas/*.ts` | Zod schemas |
| 3 | `lib/ai/client.ts` | OpenRouter provider |
| 3 | `lib/ai/extract-*.ts` | generateObject calls |
| 4 | `lib/validations/*.ts` | Matemáticas puras |
| 5 | `lib/pdf/llenar-*.ts` | Relleno pdf-lib (diferido) |
| 5 | `public/templates/*.pdf` | ⚠️ Usuario proveerá después |

---

## Pendientes / Bloqueantes Conocidos

1. **Templates PDF oficiales** (Fase 5): usuario entregará `U.FT.12.010.053` y `U.FT.12.010.069` en blanco más adelante. Se puede avanzar Fases 1-4 sin bloqueo.
2. **API Key OpenRouter**: usuario ya la tiene. Agregar a `.env.local` → `OPENROUTER_API_KEY=sk-or-v1-...`.
3. **Tabla ARL por riesgo**: los valores ($10K riesgo I, $20K riesgo II) son aproximados según el audio del notebook. Confirmar tabla oficial vigente 2026 antes de producción.
4. **IBC 40%**: valor actual según normativa. Centralizado en `lib/validations/constantes.ts` para actualización anual.
