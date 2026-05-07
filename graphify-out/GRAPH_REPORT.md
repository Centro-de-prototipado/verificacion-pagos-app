# Graph Report - .  (2026-05-07)

## Corpus Check
- 84 files · ~71,936 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 403 nodes · 770 edges · 19 communities (14 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Client & Provider Registry|AI Client & Provider Registry]]
- [[_COMMUNITY_PDF Format Data & Months|PDF Format Data & Months]]
- [[_COMMUNITY_AI Extraction Pipeline|AI Extraction Pipeline]]
- [[_COMMUNITY_UI Layout & Components|UI Layout & Components]]
- [[_COMMUNITY_Wizard Navigation & Manual Form|Wizard Navigation & Manual Form]]
- [[_COMMUNITY_Document Profile & Upload|Document Profile & Upload]]
- [[_COMMUNITY_Verification Steps UI|Verification Steps UI]]
- [[_COMMUNITY_PDF API Routes|PDF API Routes]]
- [[_COMMUNITY_Contract Extraction & Editing|Contract Extraction & Editing]]
- [[_COMMUNITY_Business Date Calculations|Business Date Calculations]]
- [[_COMMUNITY_Security & Integrity Tests|Security & Integrity Tests]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Agent Behavioral Guidelines|Agent Behavioral Guidelines]]
- [[_COMMUNITY_Sample Contract Data|Sample Contract Data]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 20 edges
2. `POST()` - 18 edges
3. `runValidations()` - 14 edges
4. `calcularContribuciones()` - 11 edges
5. `useWizardStore` - 9 edges
6. `isRateLimited()` - 8 edges
7. `API Route: /api/extract (AI structured extraction)` - 8 edges
8. `WizardStep` - 7 edges
9. `ExtractedData` - 7 edges
10. `generateWithFallback()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `runValidations()`  [EXTRACTED]
  app/api/generar-pdf/route.ts → lib/validations/index.ts
- `POST()` --calls--> `extractPILACandidates()`  [EXTRACTED]
  app/api/generar-pdf/route.ts → lib/pdf/parsers/keyword-extractor.ts
- `POST()` --calls--> `buildFormat053Data()`  [EXTRACTED]
  app/api/generar-pdf/route.ts → lib/pdf/build-format-data.ts
- `POST()` --calls--> `buildFormat069Data()`  [EXTRACTED]
  app/api/generar-pdf/route.ts → lib/pdf/build-format-data.ts
- `POST()` --calls--> `nombreArchivoFinal()`  [EXTRACTED]
  app/api/generar-pdf/route.ts → lib/pdf/utils.ts

## Hyperedges (group relationships)
- **PDF Processing Pipeline** — api_extract_text, api_extract, lib_validations_index, api_generar_pdf [EXTRACTED 1.00]
- **Three Mandatory Input Documents** — pdf_pila_planilla, pdf_arl_certificate, pdf_contract [EXTRACTED 1.00]
- **AI Provider Fallback Chain** — ai_provider_mistral, ai_provider_openrouter, ai_provider_gemini [EXTRACTED 1.00]

## Communities (19 total, 5 thin omitted)

### Community 0 - "AI Client & Provider Registry"
Cohesion: 0.06
Nodes (40): buildRegistry(), GenerateTextParams, generateWithFallback(), getOrderedProviders(), getRegistry(), isRateLimitError(), isTransientError(), MISTRAL_MODELS (+32 more)

### Community 1 - "PDF Format Data & Months"
Cohesion: 0.09
Nodes (44): SPANISH_MONTHS, ActivityReportData, ActivityReportItem, ARLData, ContractData, ContributionCalculation, ExtractedData, Format053Data (+36 more)

### Community 2 - "AI Extraction Pipeline"
Cohesion: 0.05
Nodes (47): Activity Report Format U.FT.12.011.020, Google Gemini (google/gemini-2.5-flash via OpenRouter), Mistral AI Provider (devstral-latest, mistral-large-latest), OpenRouter AI Provider (fallback chain), API Route: /api/extract (AI structured extraction), API Route: /api/extract-text, API Route: /api/generar-pdf, Web App: Verificación de Pagos UNAL (+39 more)

### Community 3 - "UI Layout & Components"
Cohesion: 0.08
Nodes (13): ancizarFont, cn(), uniqueErrors, Label(), CentroLogoProps, { theme = "system" }, DocumentDropzoneProps, handleDrop() (+5 more)

### Community 4 - "Wizard Navigation & Manual Form"
Cohesion: 0.07
Nodes (27): PROCESS_STEPS, REQUIRED_DOCUMENTS, INITIAL_STATE, useWizardStore, WizardState, RawPDFText, UploadedDocuments, ManualFormInput (+19 more)

### Community 5 - "Document Profile & Upload"
Cohesion: 0.06
Nodes (33): DocType, DocumentProfile, getAllProfiles(), getProfile(), key(), saveProfile(), abortRef, [activityReport, setActivityReport] (+25 more)

### Community 6 - "Verification Steps UI"
Cohesion: 0.08
Nodes (20): WizardStep, nombreArchivoFinal(), Alert(), alertVariants, buttonVariants, handleBack, { step, setStep, reset }, {
    extractedData,
    manualData,
    documents,
    setDocuments,
    setStep,
    setExtractedData,
  } (+12 more)

### Community 7 - "PDF API Routes"
Cohesion: 0.14
Nodes (24): POST(), PDF_KEYS, PDFKey, POST(), ExtractedDataSchema, POST(), joinSplitDates(), extractTextFromPDF() (+16 more)

### Community 8 - "Contract Extraction & Editing"
Cohesion: 0.1
Nodes (27): CONTRACT_LABELS, CONTRACT_TYPE_OPTIONS, ContractType, DocumentType, RiskClass, ARL_END_LABELS, ARL_RATE_LABELS, ARL_START_LABELS (+19 more)

### Community 9 - "Business Date Calculations"
Cohesion: 0.28
Nodes (12): addDays(), calcularEaster(), calcularFechaLimite(), diasHabilAsignados(), diasLimite(), esDiaHabil(), getHolidaysForYear(), holidayCache (+4 more)

### Community 10 - "Security & Integrity Tests"
Cohesion: 0.4
Nodes (4): errors, extracted, manual, summary

## Knowledge Gaps
- **127 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `ancizarFont`, `REQUIRED_DOCUMENTS` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pdf-lib (PDF filling and unification library)` connect `PDF API Routes` to `AI Extraction Pipeline`?**
  _High betweenness centrality (0.196) - this node is a cross-community bridge._
- **Why does `API Route: /api/generar-pdf` connect `AI Extraction Pipeline` to `PDF API Routes`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Client & Provider Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `PDF Format Data & Months` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `AI Extraction Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `UI Layout & Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._