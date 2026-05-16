# Formato 069 — Lógica de cálculo (referencia)

Fuente: `test-app/U-FT-12.010.069_Certificacion_determinacion_cedular_Rentas_de_Trabajo_V.6.0.VF_D.xlsx`
Volcado crudo de celdas: `docs/formato_069_extracted.json`

Este documento describe **qué calcula** el formato y **cómo**, para reimplementarlo en la app sin depender del Excel. No incluye implementación todavía — es la especificación.

---

## 1. Constantes (hoja `Datos`, nombres definidos)

| Nombre Excel    | Celda | Valor 2026  | Significado                             |
|-----------------|-------|-------------|-----------------------------------------|
| `Vigencia`      | B2    | 2026        | Año fiscal aplicable                    |
| `Salario_Minimo`| B3    | 1.750.905   | SMMLV vigente (COP)                     |
| `UVT`           | B4    | 52.374      | Valor UVT vigente (COP)                 |
| `Porcentaje_IBC`| B5    | 0,40        | % del valor mensualizado que es IBC     |
| `Salud`         | B6    | 0,125       | Cotización salud                        |
| `Pension`       | B7    | 0,16        | Cotización pensión                      |

Estos valores **cambian cada año**. En la app deberían vivir en un módulo de parámetros versionado por vigencia (ej. `params/2026.ts`).

### Tabla ARL — tarifas por clase de riesgo (`Datos!D3:E7`)

| Clase     | Tarifa  |
|-----------|---------|
| Riesgo 1  | 0,522 % |
| Riesgo 2  | 1,044 % |
| Riesgo 3  | 2,436 % |
| Riesgo 4  | 4,350 % |
| Riesgo 5  | 6,960 % |

> Nota legal aplicada en las fórmulas: **el contratista solo paga ARL si la clase es 1, 2 o 3.** Si algún contrato es Riesgo 4 o 5 el aporte ARL de ese contrato es 0. Para el total se toma el **máximo** entre los riesgos 1–3 reportados.

### Tabla Fondo de Solidaridad Pensional (`Datos!G3:I8`)

Rangos en **salarios mínimos** (basados en IBC consolidado / SMMLV):

| Rango (SMMLV) | Tarifa |
|---------------|--------|
| [4, 16)       | 1,0 %  |
| [16, 17)      | 1,2 %  |
| [17, 18)      | 1,4 %  |
| [18, 19)      | 1,6 %  |
| [19, 20)      | 1,8 %  |
| [20, 25]      | 2,0 %  |
| < 4           | 0      |

El monto total se redondea a múltiplos de 100 con `MROUND`.

---

## 2. Entradas del usuario (hoja `Certificación Mensual`)

### 2.1 Datos generales (filas 17–19)

| Campo                                | Celda |
|--------------------------------------|-------|
| Nombre del contratista               | D17   |
| Fecha de diligenciamiento            | H17   |
| Tipo y número de documento           | D18   |
| ¿Es pensionado? (SI/NO)              | I18   |
| Correo institucional                 | D19   |

### 2.2 Contratos (filas 23–27, **máx. 5**)

Por cada contrato:

| Campo                                       | Columna |
|---------------------------------------------|---------|
| Nombre o razón social del contratante       | B       |
| Empresa en Quipu                            | C       |
| Tipo orden contractual                      | D       |
| Número orden contractual                    | E       |
| Valor total del contrato antes de IVA       | F       |
| Fecha de inicio (DD/MM/AAAA)                | G       |
| Fecha de terminación (DD/MM/AAAA)           | H       |
| Clase de riesgos laborales                  | I       |

### 2.3 Otros controles

- `E45` — "SI"/"NO": ¿declara disminución de base de retención? (afecta cálculo de I52:I56).
- `C41`, `C42` — período de solicitud / período planilla (cruce con `ListaCondicional`).

---

## 3. Cálculo paso a paso

Notación: `i = 1..5` indica fila de contrato. Mapeo de filas:

| i | `Certificación Mensual` | `Datos` |
|---|---|---|
| 1 | fila 23 / fila 52 | fila 11 |
| 2 | fila 24 / fila 53 | fila 12 |
| 3 | fila 25 / fila 54 | fila 13 |
| 4 | fila 26 / fila 55 | fila 14 |
| 5 | fila 27 / fila 56 | fila 15 |

### 3.1 Mensualización contractual (`Certificación!B52:D56`)

```
meses_i      = (año(fin_i) - año(inicio_i)) * 12 + mes(fin_i) - mes(inicio_i) + 1
                ; 0 si falta inicio o fin
valor_mes_i  = valor_total_i / meses_i          ; 0 si meses_i = 0
IBC_i        = valor_mes_i * Porcentaje_IBC     ; (40%)
```

> **Importante**: el cálculo de meses es **naïve por mes calendario** (no por días). Replicar igual para empatar al Excel.

### 3.2 Aportes por contrato (`Datos!C11:J15`)

Para cada contrato `i`:

```
C_i = valor_mes_i                                 ; (viene de Cert!B5x)
D_i = C_i * Porcentaje_IBC                        ; IBC contrato
E_i = D_i / Salario_Minimo                        ; IBC en SMMLV
F_i = D_i * Salud                                 ; aporte salud
G_i = pensionado ? 0 : D_i * Pension              ; aporte pensión
H_i = D_i * tarifa_fondo_solidaridad(E_i)         ; ver tabla §1
I_i = clase_arl_contrato_i                        ; "Riesgo 1".."Riesgo 5"
J_i = (I_i ∈ {"Riesgo 4","Riesgo 5"}) ? 0
      : D_i * tarifa_arl(I_i)                     ; ver tabla §1
```

> Bug detectado en el Excel: las fórmulas matriciales `I11:I15` referencian `'Certificación Mensual'!H22ESPACIOS` (referencia rota — probablemente un nombre definido residual). En la práctica se ignora y `I_i` se toma directo de `Cert!I23..I27`. Al portarlo, **omitir el `ISBLANK(...)` y tomar la clase directo del contrato**.

### 3.3 Totales (`Datos!C16:J16`)

```
Cmensualizado = MAX( Σ C_i, Salario_Minimo )                              ; piso 1 SMMLV
IBCtotal      = (Σ D_i == 0) ? 0
                : clamp( Σ D_i, Salario_Minimo, 25 * Salario_Minimo )      ; techo 25 SMMLV
SMMLVtotal    = Σ E_i
SaludTotal    = (Σ F_i == 0) ? 0
                : MROUND( clamp(Σ F_i, SMMLV*Salud, 25*SMMLV*Salud), 100 )
PensionTotal  = pensionado ? 0
                : (Σ G_i == 0) ? 0
                : MROUND( clamp(Σ G_i, SMMLV*Pension, 25*SMMLV*Pension), 100 )
FondoSolidTot = MROUND( tarifa_fondo_solidaridad(SMMLVtotal) * IBCtotal, 100 )
ARLTotal      = MROUND(
                  IBCtotal * tarifa_arl( "Riesgo " & max_riesgo_1_a_3(I_1..I_5) ),
                  100
                )                                                          ; 0 si no hay riesgos 1..3

IBCmensualizado = ROUND( Cmensualizado, 0 )                                ; Datos!B18 — salida principal
ValorEnUVT      = Cmensualizado / UVT                                      ; Datos!B19
```

Donde:
- `MROUND(x, 100)` = redondeo al múltiplo de 100 más cercano.
- `max_riesgo_1_a_3` = mayor número entre los `I_i` cuyo valor está en {1,2,3}, o 0 si todos son 4/5 o vacíos.

### 3.4 Reparto del aporte total a cada contrato (`Certificación!F52:I56`)

Una vez calculados los totales (`I36 = SaludTotal`, `I37 = PensionTotal`, `I38 = FondoSolidTot`, `I39 = ARLTotal`), se distribuyen proporcionalmente al IBC de cada contrato:

```
F_cert_i = (Σ D_i = 0) ? 0 : (D_i / Σ D_i) * SaludTotal
G_cert_i = (Σ D_i = 0) ? 0 : (D_i / Σ D_i) * PensionTotal
H_cert_i = (Σ D_i = 0) ? 0 : (D_i / Σ D_i) * FondoSolidTot
```

### 3.5 Base de retención mensual por contrato (`Certificación!I52:I56`)

```
base_retencion_i = declara_disminucion
                   ? valor_mes_i - F_cert_i - G_cert_i - H_cert_i
                   : valor_mes_i
```

`declara_disminucion` = checkbox `E45 == "  SI  "` (con espacios — en la app es solo un booleano).

### 3.6 Aviso de soportes (`Certificación!B33`)

```
si IBCtotal_mensual == 0          -> ""
si IBCtotal_mensual < 95 * UVT    -> "no debe presentar documentos de la sección 3"
si IBCtotal_mensual >= 95 * UVT   -> "debe presentar documentos de la sección 3"
```

---

## 4. Salidas del formato

| Concepto                                | Origen Excel        |
|-----------------------------------------|---------------------|
| Ingreso mensualizado (COP)              | `Datos!B18`         |
| Valor ingreso en UVT                    | `Datos!B19`         |
| Aporte obligatorio a salud (12,5%)      | `Cert!I36`          |
| Aporte obligatorio a pensión (16%)      | `Cert!I37`          |
| Fondo de solidaridad pensional          | `Cert!I38`          |
| Aportes ARL                             | `Cert!I39`          |
| **Total aportes obligatorios**          | `Cert!I40` (suma)   |
| Valor mensualizado por contrato         | `Cert!B52:B56`      |
| Meses por contrato                      | `Cert!C52:C56`      |
| IBC por contrato                        | `Cert!D52:D56`      |
| Aportes salud/pensión/fondo por contrato| `Cert!F52:H56`      |
| Base de retención mensual por contrato  | `Cert!I52:I56`      |
| Base de retención total                 | `Cert!I57` (suma)   |

---

## 5. API objetivo para la app (sin implementar)

Sugerencia de módulo en `src/lib/formato069/`:

```ts
// params/2026.ts
export const PARAMS_2026 = {
  vigencia: 2026,
  salarioMinimo: 1_750_905,
  uvt: 52_374,
  porcentajeIBC: 0.40,
  salud: 0.125,
  pension: 0.16,
  tarifasARL: { 1: 0.00522, 2: 0.01044, 3: 0.02436, 4: 0.0435, 5: 0.0696 },
  fondoSolidaridad: [
    { desdeSMMLV: 4,  hastaSMMLV: 16, tarifa: 0.010 },
    { desdeSMMLV: 16, hastaSMMLV: 17, tarifa: 0.012 },
    { desdeSMMLV: 17, hastaSMMLV: 18, tarifa: 0.014 },
    { desdeSMMLV: 18, hastaSMMLV: 19, tarifa: 0.016 },
    { desdeSMMLV: 19, hastaSMMLV: 20, tarifa: 0.018 },
    { desdeSMMLV: 20, hastaSMMLV: 25, tarifa: 0.020 },
  ],
} as const;

// types.ts
export type ClaseRiesgo = 1 | 2 | 3 | 4 | 5;

export interface Contrato {
  contratante: string;
  empresaQuipu?: string;
  tipoOrden?: string;
  numeroOrden: string;
  valorTotalAntesIVA: number;
  fechaInicio: Date;     // DD/MM/AAAA
  fechaFin: Date;
  claseRiesgo: ClaseRiesgo;
}

export interface EntradaFormato069 {
  vigencia: number;
  esPensionado: boolean;
  declaraDisminucionBase: boolean;
  contratos: Contrato[];   // máx 5
}

export interface SalidaContrato {
  valorMensualizado: number;
  meses: number;
  ibc: number;
  aporteSalud: number;
  aportePension: number;
  aporteFondoSolidaridad: number;
  baseRetencionMensual: number;
}

export interface SalidaFormato069 {
  ingresoMensualizado: number;     // Datos!B18
  valorEnUVT: number;              // Datos!B19
  ibcTotal: number;
  totales: {
    salud: number;
    pension: number;
    fondoSolidaridad: number;
    arl: number;
    aportesObligatorios: number;
  };
  porContrato: SalidaContrato[];
  baseRetencionTotal: number;
  requiereSoportesSeccion3: boolean;   // ibc >= 95 * UVT
}

// calc.ts (firmas, no impl)
export function calcularMeses(inicio: Date, fin: Date): number;
export function tarifaFondoSolidaridad(ibcEnSMMLV: number, params): number;
export function tarifaARL(clase: ClaseRiesgo, params): number;
export function calcularFormato069(input: EntradaFormato069, params): SalidaFormato069;
```

---

## 6. Casos de prueba a derivar

Cuando se implemente, generar tests comparando contra el Excel para:

1. Un solo contrato, 12 meses, valor típico → comparar `B18`, `I36`, `I37`, `I38`, `I39`.
2. Varios contratos (3) con diferentes riesgos (mezcla 1, 2, 4) → verificar que ARL solo cuente riesgos 1–3 y use el máximo.
3. Pensionado=SI → `aportePension == 0` y `I37 == 0`.
4. IBC por debajo de 1 SMMLV → debe escalarse a 1 SMMLV.
5. IBC > 25 SMMLV → debe topar a 25 SMMLV.
6. `declaraDisminucionBase=true` → `baseRetencion = valorMes − aportes`; false → `= valorMes`.
7. IBC < 95 UVT vs ≥ 95 UVT → flag de soportes.

Para generar los valores esperados, llenar el Excel con esas entradas y leer las celdas resultado con `openpyxl` (modo `data_only=True` tras recalcular en Excel).

---

## 7. Pendientes / decisiones abiertas

- **Soporte > 5 contratos**: el Excel no lo permite. Decidir si la app sí.
- **Parámetros por vigencia**: cargarlos de un archivo versionado (`params/2025.ts`, `params/2026.ts`, …) y exponer un selector.
- **Validaciones de entrada**: fecha fin ≥ fecha inicio, valores positivos, clase de riesgo en {1..5}, etc.
- **Persistencia**: el proyecto va sin BD — decidir si los cálculos quedan en memoria o se cachean en el navegador.
- **Bug Excel `H22ESPACIOS`**: ignorar al portar; tomar `claseRiesgo` directo del contrato.
