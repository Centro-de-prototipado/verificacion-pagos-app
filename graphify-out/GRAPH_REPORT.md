# Graph Report - verificacion-pagos-app  (2026-05-11)

## Corpus Check
- 77 files · ~72,615 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 528 nodes · 944 edges · 29 communities (22 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96cc0b98`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 21 edges
2. `AI Extraction API Route` - 19 edges
3. `POST()` - 18 edges
4. `runValidations()` - 15 edges
5. `calcularContribuciones()` - 13 edges
6. `Core TypeScript Types` - 12 edges
7. `Plan: App de Verificación de Pagos — Universidad Nacional de Colombia` - 11 edges
8. `useWizardStore` - 9 edges
9. `combineContributions()` - 9 edges
10. `Especificaciones de la App — Verificación de Pagos UNAL` - 9 edges

## Surprising Connections (you probably didn't know these)
- `PDF Text Extraction API Route` --semantically_similar_to--> `Keyword Extractor Pre-processing`  [INFERRED] [semantically similar]
  app/api/extract-text/route.ts → ESPECIFICACIONES.md
- `Date Validations: fechas.ts` --calls--> `Validation Orchestrator`  [EXTRACTED]
  PLAN.md → lib/validations/index.ts
- `Cedular Declaration Rule: cedular.ts` --calls--> `Validation Orchestrator`  [EXTRACTED]
  PLAN.md → lib/validations/index.ts
- `Validation Orchestrator` --references--> `Bug: Multi-Contract IBC Ignored`  [EXTRACTED]
  lib/validations/index.ts → memory/2026-05-05.md
- `AI Extraction API Route` --calls--> `Mistral AI Provider (devstral-latest, mistral-large-latest)`  [EXTRACTED]
  app/api/extract/route.ts → ESPECIFICACIONES.md

## Hyperedges (group relationships)
- **Wizard State Flow** —  [INFERRED 0.95]
- **AI Extraction Pipeline** —  [INFERRED 0.93]
- **PDF Generation Pipeline** —  [INFERRED 0.92]
- **Colombian Social Security Validation** —  [INFERRED 0.91]
- **Dual Contract Support** —  [INFERRED 0.88]
- **Upload Security Chain** —  [INFERRED 0.87]

## Communities (29 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (40): INITIAL_STATE, useWizardStore, WizardState, ActivityReportItem, ExtractedData, ManualFormData, RawPDFText, UploadedDocuments (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (40): buildRegistry(), GenerateTextParams, generateWithFallback(), getOrderedProviders(), getRegistry(), isRateLimitError(), isTransientError(), MISTRAL_MODELS (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (51): Activity Report Format U.FT.12.011.020, Google Gemini (google/gemini-2.5-flash via OpenRouter), Mistral AI Provider (devstral-latest, mistral-large-latest), OpenRouter AI Provider (fallback chain), AI Extraction API Route, PDF Text Extraction API Route, PDF Generation API Route, Root Layout (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (35): SPANISH_MONTHS, ARLData, ContributionCalculation, PaymentSheetData, ValidationResult, buildFormat053Data(), buildFormat069Data(), formatExpeditionDate() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (35): DocType, DocumentProfile, getAllProfiles(), getProfile(), key(), saveProfile(), abortRef, [activityReport, setActivityReport] (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (28): POST(), PDF_KEYS, PDFKey, POST(), ExtractedDataSchema, POST(), Format053Data, Format069Data (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (27): CONTRACT_LABELS, CONTRACT_TYPE_OPTIONS, ContractType, DocumentType, RiskClass, ARL_END_LABELS, ARL_RATE_LABELS, ARL_START_LABELS (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (31): 1. Qué hace la aplicación, 2. Flujo de 4 pasos, 3.1 Configuración inicial, 3.2 Documentos obligatorios, 3.3 Datos manuales (no están en los PDFs), 3. Paso 1 — Documentos y datos manuales, 4.1 Proceso de extracción, 4.2 Pre-procesamiento antes del prompt (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (27): API Route: /api/generar-pdf, Web App: Verificación de Pagos UNAL, ARL Date 2-Day Tolerance, Cedular Declaration Rule (SI/NO for Formato 069), Centro de Prototipado UNAL Manizales, Sample Contract: OSE No. 14, Daniel Vick Gutierrez, Bug: Multi-Contract IBC Ignored, Bug: Scanned PDFs Crash Pipeline (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (28): Archivos Críticos (resumen), code:ts (// lib/schemas/payment-sheet.ts), code:ts (import { createOpenRouter } from "@openrouter/ai-sdk-provide), code:ts (export const IBC_PORCENTAJE = 0.40;               // 40% del), code:ts (// Si totalAportesObligatorios > valorPagadoEnPlanilla → STO), code:ts (// numeroPago = 1 → siempre "SI"), code:block6 (lib/), code:ts (import path from "path";) (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (17): ActivityReportData, ContractData, addDays(), calcularEaster(), calcularFechaLimite(), diasHabilAsignados(), diasLimite(), esDiaHabil() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (13): errors, { errors, warnings, passed }, {
    extractedData,
    manualData,
    documents,
    setDocuments,
    setStep,
    setExtractedData,
  }, [isExtractingPS2, setIsExtractingPS2], [isExtractingReport, setIsExtractingReport], passed, [ps2Error, setPs2Error], [reportError, setReportError] (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (7): Alert(), alertVariants, DownloadStatus, [errorMessage, setErrorMessage], { extractedData, manualData, documents }, [pdfBlob, setPdfBlob], [status, setStatus]

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (6): PROCESS_STEPS, REQUIRED_DOCUMENTS, buttonVariants, uniqueErrors, Label(), Separator()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (6): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, code:block1 (1. [Step] → verify: [check]), graphify

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (3): ancizarFont, CentroLogoProps, { theme = "system" }

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (5): Adding components, code:bash (npx shadcn@latest add button), code:tsx (import { Button } from "@/components/ui/button";), Next.js template, Using components

### Community 18 - "Community 18"
Cohesion: 0.4
Nodes (4): errors, extracted, manual, summary

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (3): CRITICAL ERRORS DETECTED, Memory Log - 2026-05-05, System State

## Knowledge Gaps
- **188 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `ancizarFont`, `PROCESS_STEPS` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pdf-lib (PDF filling and unification library)` connect `Community 8` to `Community 5`?**
  _High betweenness centrality (0.350) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AI Extraction API Route` (e.g. with `NDJSON Streaming Pattern` and `Keyword Fingerprinting`) actually correct?**
  _`AI Extraction API Route` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._