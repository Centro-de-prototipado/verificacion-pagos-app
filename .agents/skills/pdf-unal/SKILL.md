---
name: pdf-unal
description: "Skill específico para el proyecto de verificación de pagos UNAL. Úsalo cuando: (1) el usuario provee los templates PDF oficiales (U.FT.12.010.053 o U.FT.12.010.069) y hay que mapear sus campos, (2) hay que actualizar lib/pdf/llenar-formatos.ts con coordenadas o nombres de campo AcroForm, (3) hay que depurar el llenado o la unificación de PDFs, (4) hay que implementar lib/pdf/unificar.ts o app/api/generar-pdf/route.ts. Este skill asume que el skill 'pdf' ya está disponible para inspección de templates con sus scripts Python."
---

# PDF UNAL — Formatos Oficiales de la Universidad Nacional

Este skill describe cómo inspeccionar los templates PDF de la UNAL y traducir los resultados al código TypeScript de este proyecto (`lib/pdf/llenar-formatos.ts`).

## Contexto del Proyecto

Dos formatos oficiales que hay que rellenar con `pdf-lib`:

| Formato | Código | Propósito |
|---|---|---|
| U.FT.12.010.053 | `053` | Constancia de cumplimiento contractual |
| U.FT.12.010.069 | `069` | Certificación determinación cedular / Rentas de trabajo |

Templates en: `lib/templates/` (acceso solo server-side, nunca en `public/`)
Código de llenado: `lib/pdf/llenar-formatos.ts`
Tipos TypeScript: `lib/types.ts` → `Format053Data` y `Format069Data`

Orden de unificación final: **053 → 069 → planilla → ARL**

Nombre del archivo: `{quipuCompany}Anexos{contractType}{orderNumber}.pdf`
Ejemplo: `4013AnexosOSE14.pdf`

---

## Paso 1 — Inspeccionar los Templates (cuando el usuario los provea)

Cuando los templates lleguen a `lib/templates/`, usar los scripts del skill `pdf` para detectar si tienen AcroForm fields:

```bash
# Requiere Python + pypdf: pip install pypdf
python .agents/skills/pdf/scripts/check_fillable_fields.py lib/templates/U.FT.12.010.053_Constancia_cumplimiento.pdf
python .agents/skills/pdf/scripts/check_fillable_fields.py lib/templates/U.FT.12.010.069_Certificacion_cedular.pdf
```

---

## Camino A — Template con AcroForm Fields (fillable)

Si el script detecta campos fillable:

```bash
# Extraer nombres y posiciones de todos los campos
python .agents/skills/pdf/scripts/extract_form_field_info.py \
  lib/templates/U.FT.12.010.053_Constancia_cumplimiento.pdf \
  /tmp/fields_053.json

python .agents/skills/pdf/scripts/extract_form_field_info.py \
  lib/templates/U.FT.12.010.069_Certificacion_cedular.pdf \
  /tmp/fields_069.json
```

Leer el JSON resultante para obtener los `field_id` de cada campo, luego mapear en TypeScript:

```ts
// lib/pdf/llenar-formatos.ts — sección AcroForm del 053
const form = doc.getForm();

// Reemplazar los TODO con los field_id reales del JSON:
form.getTextField("NombreDelCampoEnPDF").setText(datos.contractorName);
form.getTextField("TipoContrato").setText(datos.contractType);
form.getTextField("NumeroOrden").setText(datos.orderNumber);
form.getTextField("CodigoQUIPU").setText(datos.quipuCompany);
form.getTextField("PeriodoSolicitud").setText(datos.paymentRequestPeriod);
form.getTextField("NumeroPlanilla").setText(datos.sheetNumber);
form.getTextField("FechaPago").setText(datos.paymentDate);
form.getTextField("ValorIBC").setText(formatearPesos(datos.ibc));
form.getTextField("AporteSalud").setText(formatearPesos(datos.healthContribution));
form.getTextField("AportePension").setText(formatearPesos(datos.pensionContribution));
form.getTextField("AporteARL").setText(formatearPesos(datos.arlContribution));
form.getTextField("TotalAportes").setText(formatearPesos(datos.totalContributions));
form.getTextField("CorreoInstitucional").setText(datos.institutionalEmail);
form.flatten(); // convierte a texto estático — obligatorio antes de descargar
```

Para el formato 069, campo crítico (declaración cedular):
```ts
// "SI" o "NO" según regla: pago=1→SI; pago≥2 y periodos distintos→NO; resto→SI
form.getTextField("DeclaracionFormalDisminucion").setText(datos.formalDeclaration);
```

---

## Camino B — Template Sin AcroForm (solo imagen o texto plano)

Si el script dice que NO tiene campos fillable, usar extracción de estructura:

```bash
python .agents/skills/pdf/scripts/extract_form_structure.py \
  lib/templates/U.FT.12.010.053_Constancia_cumplimiento.pdf \
  /tmp/structure_053.json

# Convertir a imágenes para inspección visual
python .agents/skills/pdf/scripts/convert_pdf_to_images.py \
  lib/templates/U.FT.12.010.053_Constancia_cumplimiento.pdf \
  /tmp/pages_053/
```

Con las coordenadas PDF del JSON, completar los `TODO` en `llenar-formatos.ts`:

```ts
// pdf-lib usa origen en esquina inferior-izquierda; Y crece hacia arriba
// Para convertir: y_pdf_lib = pageHeight - y_desde_arriba
const page = doc.getPages()[0];
const { height } = page.getSize();

// Ejemplo con coordenadas reales (x, yDesdeArriba obtenidos del JSON de estructura):
page.drawText(datos.contractorName, {
  x: 142, y: height - 198,
  size: 10, font, color: rgb(0, 0, 0),
});
```

---

## Estructura de Datos — Campos por Formato

### Format053Data (lib/types.ts)

| Campo TS | Descripción | Fuente |
|---|---|---|
| `contractorName` | Nombre completo del contratista | Extraído del contrato |
| `documentType` | CC / NIT / CE | Extraído del contrato |
| `documentNumber` | Número de identificación | Extraído del contrato |
| `contractType` | OSE / OPS / OCE / etc. | Extraído del contrato |
| `orderNumber` | Número de orden contractual | Extraído del contrato |
| `amendmentNumber` | Número de otro sí (opcional) | Manual |
| `quipuCompany` | Código empresa QUIPU | Manual |
| `institutionalEmail` | Correo @unal.edu.co | Manual |
| `paymentRequestPeriod` | MM/YYYY — periodo solicitado | Manual |
| `sheetNumber` | Número de planilla SS | Extraído de planilla |
| `paymentDate` | Fecha de pago de planilla | Extraído de planilla |
| `ibc` | IBC = valorMensualizado × 40% | Calculado |
| `healthContribution` | Salud = IBC × 12.5% | Calculado |
| `pensionContribution` | Pensión = IBC × 16% | Calculado |
| `arlContribution` | ARL según clase de riesgo | Calculado |
| `totalContributions` | Suma de salud + pensión + ARL | Calculado |
| `amountToCharge` | Valor a cobrar | Manual |

### Format069Data (lib/types.ts)

| Campo TS | Descripción | Fuente |
|---|---|---|
| `contractorName` | Nombre completo | Extraído del contrato |
| `documentType` | CC / NIT / CE | Extraído del contrato |
| `documentNumber` | Número identificación | Extraído del contrato |
| `contractType` | Tipo de contrato | Extraído del contrato |
| `orderNumber` | Número de orden | Extraído del contrato |
| `quipuCompany` | Código QUIPU | Manual |
| `paymentRequestPeriod` | Periodo solicitado MM/YYYY | Manual |
| `payrollPeriod` | Periodo de la planilla MM/YYYY | Manual / Extraído |
| `formalDeclaration` | `"SI"` o `"NO"` | `calcularDeclaracionCedular()` |
| `amountToCharge` | Valor a cobrar | Manual |

---

## Regla Cedular — DECLARACIÓN FORMAL PARA DISMINUCIÓN DE BASE DE RETENCIÓN

Esta lógica está en `lib/validations/cedular.ts` y el resultado va al campo `formalDeclaration`:

```ts
// numeroPago = 1 → siempre "SI"
// numeroPago ≥ 2 && periodoSolicitud ≠ periodoPlanilla → "NO"
// resto → "SI"
```

---

## Unificación — Orden Obligatorio

El archivo final debe tener exactamente este orden de páginas:
1. Formato 053 (constancia diligenciada)
2. Formato 069 (certificación diligenciada)
3. Planilla de pago (PDF original del usuario)
4. Certificado ARL (PDF original del usuario)

El código está en `unificarPDFs()` de `lib/pdf/llenar-formatos.ts`.

---

## Route Handler — app/api/generar-pdf/route.ts

Cuando se implemente el endpoint:

```ts
import { llenarConstancia053, llenarCertificacion069, unificarPDFs, nombreArchivoFinal } from "@/lib/pdf/llenar-formatos";

export async function POST(request: Request) {
  const body = await request.json();

  const [bytes053, bytes069] = await Promise.all([
    llenarConstancia053(body.datos053),
    llenarCertificacion069(body.datos069),
  ]);

  const merged = await unificarPDFs({
    bytes053,
    bytes069,
    bytesPlanilla: Buffer.from(body.planillaBase64, "base64"),
    bytesARL: Buffer.from(body.arlBase64, "base64"),
  });

  const filename = nombreArchivoFinal(body.quipu, body.contractType, body.orderNumber);

  return new Response(merged, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

---

## Checklist Cuando Lleguen los Templates

- [ ] Copiar templates en `lib/templates/` con los nombres exactos del código
- [ ] Ejecutar `check_fillable_fields.py` en cada template
- [ ] Si fillable → ejecutar `extract_form_field_info.py` → mapear `field_id` en `llenar-formatos.ts`
- [ ] Si no fillable → ejecutar `extract_form_structure.py` + `convert_pdf_to_images.py` → mapear coordenadas
- [ ] Verificar que el llenado se ve correcto ejecutando la función y abriendo el PDF resultante
- [ ] Implementar `app/api/generar-pdf/route.ts`
- [ ] Implementar `components/verificacion/boton-descarga.tsx`
- [ ] Verificar nombre de archivo: `{QUIPU}Anexos{TipoContrato}{Numero}.pdf`
