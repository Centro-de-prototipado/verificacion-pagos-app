# Graph Report - verificacion-pagos-app  (2026-05-13)

## Corpus Check
- 82 files · ~247,602 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 584 nodes · 1078 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `75c15934`
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 21 edges
2. `AI Extraction API Route` - 19 edges
3. `POST()` - 18 edges
4. `runValidations()` - 16 edges
5. `calcularContribuciones()` - 13 edges
6. `runCase()` - 12 edges
7. `Core TypeScript Types` - 12 edges
8. `checkPaymentSheet()` - 11 edges
9. `checkARL()` - 11 edges
10. `extractPILACandidates()` - 11 edges

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

## Communities (34 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (51): SPANISH_MONTHS, ExtractedDataSchema, ActivityReportData, ActivityReportItem, ARLData, ContractData, ContributionCalculation, ExtractedData (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (42): buildRegistry(), GenerateTextParams, generateWithFallback(), getOrderedProviders(), getRegistry(), isRateLimitError(), isTransientError(), MISTRAL_MODELS (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (49): Activity Report Format U.FT.12.011.020, Google Gemini (google/gemini-2.5-flash via OpenRouter), Mistral AI Provider (devstral-latest, mistral-large-latest), OpenRouter AI Provider (fallback chain), AI Extraction API Route, PDF Generation API Route, Root Layout, Blocking Validation: Insufficient Contributions (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (36): DocType, DocumentProfile, getAllProfiles(), getProfile(), key(), saveProfile(), abortRef, [activityReport, setActivityReport] (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (34): ARL_END_LABELS, ARL_RATE_LABELS, ARL_START_LABELS, CONTRACT_END_LABELS, CONTRACT_START_LABELS, DEFAULT_END_LABELS, DEFAULT_START_LABELS, detectIssuer() (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (24): INITIAL_STATE, useWizardStore, WizardState, RawPDFText, UploadedDocuments, ManualFormInput, ManualFormSchema, bytes (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (23): POST(), PDF_KEYS, PDFKey, POST(), POST(), extractTextFromPDF(), combinePDFs(), fill053() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (31): 1. Qué hace la aplicación, 2. Flujo de 4 pasos, 3.1 Configuración inicial, 3.2 Documentos obligatorios, 3.3 Datos manuales (no están en los PDFs), 3. Paso 1 — Documentos y datos manuales, 4.1 Proceso de extracción, 4.2 Pre-procesamiento antes del prompt (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (29): PDF Text Extraction API Route, API Route: /api/generar-pdf, Web App: Verificación de Pagos UNAL, ARL Date 2-Day Tolerance, Cedular Declaration Rule (SI/NO for Formato 069), Centro de Prototipado UNAL Manizales, Sample Contract: OSE No. 14, Daniel Vick Gutierrez, Bug: Multi-Contract IBC Ignored (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (28): Archivos Críticos (resumen), code:ts (// lib/schemas/payment-sheet.ts), code:ts (import { createOpenRouter } from "@openrouter/ai-sdk-provide), code:ts (export const IBC_PORCENTAJE = 0.40;               // 40% del), code:ts (// Si totalAportesObligatorios > valorPagadoEnPlanilla → STO), code:ts (// numeroPago = 1 → siempre "SI"), code:block6 (lib/), code:ts (import path from "path";) (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (5): ancizarFont, cn(), CentroLogoProps, { theme = "system" }, SectionHeaderProps

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (22): checkARL(), checkContract(), checkPaymentSheet(), COMPANY_TOKENS, downgradeConfidence(), isDMY(), isISO(), isMY() (+14 more)

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
Cohesion: 0.14
Nodes (11): CONTRACT_LABELS, CONTRACT_TYPE_OPTIONS, ContractType, DocumentType, RiskClass, CONFIDENCE_CONFIG, empty, [focused, setFocused] (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (8): nombreArchivoFinal(), Alert(), alertVariants, DownloadStatus, [errorMessage, setErrorMessage], { extractedData, manualData, documents }, [pdfBlob, setPdfBlob], [status, setStatus]

### Community 15 - "Community 15"
Cohesion: 0.28
Nodes (12): addDays(), calcularEaster(), calcularFechaLimite(), diasHabilAsignados(), diasLimite(), esDiaHabil(), getHolidaysForYear(), holidayCache (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (7): buttonVariants, DocumentDropzoneProps, handleDrop(), handleInputChange(), inputRef, [isDragging, setIsDragging], processFile()

### Community 17 - "Community 17"
Cohesion: 0.27
Nodes (5): PROCESS_STEPS, REQUIRED_DOCUMENTS, uniqueErrors, Label(), Separator()

### Community 18 - "Community 18"
Cohesion: 0.36
Nodes (6): WizardStep, handleBack, { step, setStep, reset }, StepIndicatorProps, StepConfig, STEPS_CONFIG

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (6): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, code:block1 (1. [Step] → verify: [check]), graphify

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): Adding components, code:bash (npx shadcn@latest add button), code:tsx (import { Button } from "@/components/ui/button";), Next.js template, Using components

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (4): errors, extracted, manual, summary

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (4): Sheet: Casos de prueba, Sheet: Clasificaciones, Sheet: Metricas, Sheet: Resumen General

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (3): CRITICAL ERRORS DETECTED, Memory Log - 2026-05-05, System State

## Knowledge Gaps
- **207 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `ancizarFont`, `PROCESS_STEPS` (+202 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pdf-lib (PDF filling and unification library)` connect `Community 8` to `Community 6`?**
  _High betweenness centrality (0.327) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AI Extraction API Route` (e.g. with `NDJSON Streaming Pattern` and `Keyword Fingerprinting`) actually correct?**
  _`AI Extraction API Route` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _207 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._