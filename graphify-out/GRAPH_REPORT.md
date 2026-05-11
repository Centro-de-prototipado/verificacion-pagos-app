# Graph Report - .  (2026-05-11)

## Corpus Check
- 28 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 449 nodes · 858 edges · 21 communities (15 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.89)
- Token cost: 98,400 input · 4,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Client & Provider Registry|AI Client & Provider Registry]]
- [[_COMMUNITY_Wizard UI & Upload Components|Wizard UI & Upload Components]]
- [[_COMMUNITY_AI Extraction & Document Schemas|AI Extraction & Document Schemas]]
- [[_COMMUNITY_App Shell & Landing Page|App Shell & Landing Page]]
- [[_COMMUNITY_PDF Parsing & Type System|PDF Parsing & Type System]]
- [[_COMMUNITY_PDF Format Data & Contributions|PDF Format Data & Contributions]]
- [[_COMMUNITY_Step 2 & Document Profiles|Step 2 & Document Profiles]]
- [[_COMMUNITY_API Routes & Contract Constants|API Routes & Contract Constants]]
- [[_COMMUNITY_Business Rules & Validation|Business Rules & Validation]]
- [[_COMMUNITY_Step 3 & UI Alerts|Step 3 & UI Alerts]]
- [[_COMMUNITY_Colombian Date & Holiday Logic|Colombian Date & Holiday Logic]]
- [[_COMMUNITY_Security & Integrity Tests|Security & Integrity Tests]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Project Guidelines|Project Guidelines]]
- [[_COMMUNITY_Contract Scratch|Contract Scratch]]
- [[_COMMUNITY_App Page|App Page]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 20 edges
2. `AI Extraction API Route` - 19 edges
3. `POST()` - 18 edges
4. `runValidations()` - 14 edges
5. `calcularContribuciones()` - 12 edges
6. `Core TypeScript Types` - 12 edges
7. `useWizardStore` - 9 edges
8. `Validation Orchestrator` - 9 edges
9. `isRateLimited()` - 8 edges
10. `combineContributions()` - 8 edges

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

## Communities (21 total, 6 thin omitted)

### Community 0 - "AI Client & Provider Registry"
Cohesion: 0.06
Nodes (38): buildRegistry(), GenerateTextParams, generateWithFallback(), getOrderedProviders(), getRegistry(), isRateLimitError(), isTransientError(), MISTRAL_MODELS (+30 more)

### Community 1 - "Wizard UI & Upload Components"
Cohesion: 0.06
Nodes (35): INITIAL_STATE, useWizardStore, WizardState, RawPDFText, UploadedDocuments, WizardStep, ManualFormInput, ManualFormSchema (+27 more)

### Community 2 - "AI Extraction & Document Schemas"
Cohesion: 0.07
Nodes (51): Activity Report Format U.FT.12.011.020, Google Gemini (google/gemini-2.5-flash via OpenRouter), Mistral AI Provider (devstral-latest, mistral-large-latest), OpenRouter AI Provider (fallback chain), AI Extraction API Route, PDF Text Extraction API Route, PDF Generation API Route, Root Layout (+43 more)

### Community 3 - "App Shell & Landing Page"
Cohesion: 0.07
Nodes (17): ancizarFont, PROCESS_STEPS, REQUIRED_DOCUMENTS, cn(), buttonVariants, uniqueErrors, Label(), CentroLogoProps (+9 more)

### Community 4 - "PDF Parsing & Type System"
Cohesion: 0.08
Nodes (38): CONTRACT_TYPE_OPTIONS, ActivityReportData, ActivityReportItem, ARLData, ConfidenceLevel, ConfidenceMap, ContractData, ContractType (+30 more)

### Community 5 - "PDF Format Data & Contributions"
Cohesion: 0.11
Nodes (33): SPANISH_MONTHS, ContributionCalculation, ExtractedData, ManualFormData, buildFormat053Data(), buildFormat069Data(), formatExpeditionDate(), laterPeriod() (+25 more)

### Community 6 - "Step 2 & Document Profiles"
Cohesion: 0.06
Nodes (35): DocType, DocumentProfile, getAllProfiles(), getProfile(), key(), saveProfile(), abortRef, [activityReport, setActivityReport] (+27 more)

### Community 7 - "API Routes & Contract Constants"
Cohesion: 0.11
Nodes (29): CONTRACT_LABELS, POST(), PDF_KEYS, PDFKey, POST(), ExtractedDataSchema, POST(), Format053Data (+21 more)

### Community 8 - "Business Rules & Validation"
Cohesion: 0.08
Nodes (29): API Route: /api/generar-pdf, Web App: Verificación de Pagos UNAL, ARL Date 2-Day Tolerance, Cedular Declaration Rule (SI/NO for Formato 069), Centro de Prototipado UNAL Manizales, Sample Contract: OSE No. 14, Daniel Vick Gutierrez, Bug: Multi-Contract IBC Ignored, Bug: Scanned PDFs Crash Pipeline (+21 more)

### Community 9 - "Step 3 & UI Alerts"
Cohesion: 0.1
Nodes (14): Alert(), alertVariants, errors, {
    extractedData,
    manualData,
    documents,
    setDocuments,
    setStep,
    setExtractedData,
  }, [isExtractingPS2, setIsExtractingPS2], [isExtractingReport, setIsExtractingReport], passed, [ps2Error, setPs2Error] (+6 more)

### Community 10 - "Colombian Date & Holiday Logic"
Cohesion: 0.28
Nodes (12): addDays(), calcularEaster(), calcularFechaLimite(), diasHabilAsignados(), diasLimite(), esDiaHabil(), getHolidaysForYear(), holidayCache (+4 more)

### Community 11 - "Security & Integrity Tests"
Cohesion: 0.4
Nodes (4): errors, extracted, manual, summary

## Knowledge Gaps
- **142 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `ancizarFont`, `REQUIRED_DOCUMENTS` (+137 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pdf-lib (PDF filling and unification library)` connect `Business Rules & Validation` to `API Routes & Contract Constants`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `AI Extraction API Route` connect `AI Extraction & Document Schemas` to `Business Rules & Validation`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AI Extraction API Route` (e.g. with `NDJSON Streaming Pattern` and `Keyword Fingerprinting`) actually correct?**
  _`AI Extraction API Route` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _142 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Client & Provider Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Wizard UI & Upload Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `AI Extraction & Document Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._