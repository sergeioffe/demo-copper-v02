// Card Definitions — source of truth for what cards exist, their prop shapes,
// allowed actions, and WHEN guidance for the engine.
// Seeded once to GCS at knowledge/ux-cards/; after seed, GCS is authoritative.

export interface CardDefinition {
  cardType: string;
  propsSchema: Record<string, string>; // propName → type description
  exampleProps: Record<string, unknown>;
  allowedActions: string[];
  fallbackText: string;
  whenToUse: string;
  whenNotToUse: string;
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    cardType: "tableDiscovery",
    propsSchema: {
      tableName: "string",
      sourceLabel: "string?",
      sourceUrl: "string?",
      rows: "number",
      columns: "number",
      warnings: "number?",
      skippedRows: "number?",
      isLiveFeed: "boolean?",
      status: "'analyzing' | 'analyzed' | 'error'?",
    },
    exampleProps: {
      tableName: "Zesty Zing Catalog",
      sourceLabel: "Google Sheets",
      rows: 12567,
      columns: 6,
      warnings: 3,
      skippedRows: 6,
      isLiveFeed: true,
      status: "analyzed",
    },
    allowedActions: ["inspect", "reload", "delete"],
    fallbackText: "I analyzed the source and found row/column counts, warnings, and live-feed status.",
    whenToUse: "A source has been read and the system can summarize what it found: row counts, column counts, live-feed status, warnings. ALSO use when the user asks to describe or summarize an existing table in the project model — populate tableName, columns (count of known fields), rows (0 if unknown), sourceLabel from Import if present, isLiveFeed if the import is recurring, status: 'analyzed'.",
    whenNotToUse: "Listing specific data-quality issues → validationFindings. Showing the final row grid → tablePreview. Summarizing a mutation → changeSummary.",
  },

  {
    cardType: "validationFindings",
    propsSchema: {
      findings: "Array<{ id: string; title: string; column?: string; rowsAffected: number; severity?: 'info'|'warning'|'error'; status?: 'open'|'ignored'|'excluded' }>",
    },
    exampleProps: {
      findings: [
        { id: "missing_price", title: "Empty cells in Price column", column: "Price", rowsAffected: 18, severity: "warning", status: "open" },
        { id: "broken_image", title: "Broken URL in Image column", column: "Image", rowsAffected: 4, severity: "warning", status: "open" },
      ],
    },
    allowedActions: ["exclude", "ignore", "undo"],
    fallbackText: "I found data-quality issues in the source that may affect import quality.",
    whenToUse: "Data-quality issues have been found in the source or table: empty cells, broken URLs, duplicate keys, type mismatches.",
    whenNotToUse: "A proposed change rather than a finding → changeSummary. Specifically a key problem → keySelection. A filter suggestion → filterRecommendation.",
  },

  {
    cardType: "filterRecommendation",
    propsSchema: {
      title: "string",
      reason: "string",
      rowsRemoved: "number",
      field: "string?",
      operator: "string?",
      value: "string?",
      status: "'recommended' | 'applied' | 'dismissed'?",
    },
    exampleProps: {
      title: "Exclude out-of-stock products",
      reason: "2,312 products have availability = out of stock. Advertising unavailable items wastes spend.",
      rowsRemoved: 2312,
      field: "availability",
      operator: "=",
      value: "out of stock",
      status: "recommended",
    },
    allowedActions: ["apply", "dismiss", "undo"],
    fallbackText: "I recommend a filter rule that would narrow the working set.",
    whenToUse: "The agent recommends one specific filter rule, with a reason and estimated row impact.",
    whenNotToUse: "The user is building a rule manually → customFilter. Showing aggregate filter impact → filterImpactSummary. Filter is part of a larger proposed mutation → changeSummary.",
  },

  {
    cardType: "keySelection",
    propsSchema: {
      keyName: "string",
      mode: "'single' | 'composite'?",
      isRecommended: "boolean?",
      isValid: "boolean",
      uniqueValues: "number",
      totalValues: "number",
      duplicates: "number",
      missing: "number",
      sampleValues: "string[]?",
      reason: "string?",
    },
    exampleProps: {
      keyName: "SKU",
      mode: "single",
      isRecommended: true,
      isValid: true,
      uniqueValues: 2808,
      totalValues: 2808,
      duplicates: 0,
      missing: 0,
      sampleValues: ["SKU-4954333", "SKU-58444333"],
      reason: "SKU is unique, complete, and stable across syncs.",
    },
    allowedActions: ["edit", "apply", "cancel"],
    fallbackText: "I recommend a primary key for this table based on uniqueness and stability analysis.",
    whenToUse: "Choosing, confirming, or warning about a primary key — single or composite.",
    whenNotToUse: "General validation findings → validationFindings. Field mapping → fieldMapping.",
  },

  {
    cardType: "changeSummary",
    propsSchema: {
      title: "string",
      status: "'proposed' | 'accepted' | 'rejected' | 'applied' | 'rolled_back'?",
      why: "string?",
      changes: "Array<{ id: string; op: 'add'|'modify'|'remove'|'warning'; label: string; detail?: string }>",
      consequences: "string[]?",
      warnings: "string[]?",
      affectedObjects: "string[]?",
    },
    exampleProps: {
      title: "Create Products Table",
      status: "proposed",
      why: "The uploaded Google Sheet appears to be an operational product catalog.",
      changes: [
        { id: "create_table", op: "add", label: "Products table", detail: "Input type" },
        { id: "set_key", op: "add", label: "Primary key", detail: "SKU" },
        { id: "add_filter", op: "add", label: "Filter rule", detail: "Exclude out-of-stock" },
        { id: "map_fields", op: "modify", label: "Field mapping", detail: "5 of 5 columns mapped" },
      ],
      warnings: ["3 validation issues remain non-blocking"],
      consequences: ["2,312 rows excluded on each sync", "Table refreshes every hour"],
      affectedObjects: ["Products Table", "Import Definition"],
    },
    allowedActions: ["accept", "reject", "inspect", "undo"],
    fallbackText: "I am proposing a change to the project model that requires your approval.",
    whenToUse: "Summarizing a proposed, accepted, rejected, applied, or rolled-back mutation. The general-purpose approval card. Use for: table creation, import changes, filter additions, key changes, field mapping changes, plan diffs, rollbacks.",
    whenNotToUse: "Just choosing a source → sourceInput. A single specialized recommendation with no approval bundle — use the specialized card first.",
  },

  {
    cardType: "filterImpactSummary",
    propsSchema: {
      originalRows: "number",
      currentRows: "number",
      activeFilters: "number",
    },
    exampleProps: {
      originalRows: 12567,
      currentRows: 10255,
      activeFilters: 1,
    },
    allowedActions: [],
    fallbackText: "The active filters are keeping X% of rows and removing Y rows from the working set.",
    whenToUse: "After one or more filters have been applied and the user needs to see the cumulative row-level impact. Show after filterRecommendation when status = 'applied'.",
    whenNotToUse: "Proposing a single filter → filterRecommendation. Letting the user build a custom rule → customFilter.",
  },

  {
    cardType: "sourceInput",
    propsSchema: {
      selectedSourceId: "string?",
      options: "Array<{ id: string; label: string; description: string }>",
      authLabel: "string?",
      fields: "Array<{ label: string; placeholder: string; value?: string }>?",
    },
    exampleProps: {
      options: [
        { id: "file",    label: "Upload file",   description: "Excel, CSV, or JSON" },
        { id: "gsheets", label: "Google Sheets", description: "Connect a live spreadsheet" },
        { id: "api",     label: "REST API",      description: "Pull from an endpoint" },
      ],
    },
    allowedActions: ["select"],
    fallbackText: "Choose where your data is coming from — file upload, live feed, or API.",
    whenToUse: "The wizard is starting and no source has been connected yet, or the user is switching from one source type to another.",
    whenNotToUse: "A source is already connected and only schema info is needed → tableDiscovery.",
  },

  {
    cardType: "fieldMapping",
    propsSchema: {
      rows: "Array<{ fileColumn: string; systemColumn: string; type: string; required?: boolean }>",
      mappedCount: "number",
      totalCount: "number",
      typeWarnings: "number?",
    },
    exampleProps: {
      rows: [
        { fileColumn: "SKU",         systemColumn: "sku",          type: "string",  required: true },
        { fileColumn: "Price",        systemColumn: "price",        type: "number" },
        { fileColumn: "Product Name", systemColumn: "product_name", type: "string" },
      ],
      mappedCount: 3,
      totalCount: 3,
      typeWarnings: 0,
    },
    allowedActions: ["edit"],
    fallbackText: "Here is how the source columns map to system fields. You can rename any system field.",
    whenToUse: "Showing how source columns map to the system's field names and types. Present after tableDiscovery and before importSettings.",
    whenNotToUse: "Choosing a primary key → keySelection. Showing data-quality issues → validationFindings.",
  },

  {
    cardType: "importSettings",
    propsSchema: {
      tableName: "string",
      brand: "string?",
      refreshMode: "'manual' | 'scheduled' | 'live'",
      scheduleLabel: "string?",
      sourceLabel: "string?",
    },
    exampleProps: {
      tableName: "Zesty Zing Catalog",
      brand: "Zesty Zing",
      refreshMode: "scheduled",
      scheduleLabel: "Every hour",
      sourceLabel: "Google Sheets",
    },
    allowedActions: ["edit", "save"],
    fallbackText: "The table will be imported with the chosen refresh mode and schedule.",
    whenToUse: "Setting or confirming how and when the table refreshes: manual, scheduled cadence, or live connection. The final configuration step before preview.",
    whenNotToUse: "Previewing actual row data → tablePreview. Showing field names → fieldMapping.",
  },

  {
    cardType: "tablePreview",
    propsSchema: {
      tableName: "string",
      rowsCount: "number",
      columns: "string[]",
      rows: "string[][]",
      pageSize: "number?",
    },
    exampleProps: {
      tableName: "Products",
      rowsCount: 2808,
      columns: ["SKU", "Product Name", "Price"],
      rows: [
        ["SKU-4954333", "Zesty Zing Original", "4.99"],
        ["SKU-58444333", "Zesty Zing Lime", "4.99"],
      ],
      pageSize: 5,
    },
    allowedActions: ["save"],
    fallbackText: "Here is a preview of the data that will be imported into the table.",
    whenToUse: "Showing the user a sample of the actual row data just before final confirmation. The last step in an import wizard.",
    whenNotToUse: "Describing table schema without row data → tableDiscovery. Showing field mappings → fieldMapping.",
  },

  {
    cardType: "questionnaire",
    propsSchema: {
      title: "string?",
      questions: "Array<{ id: string; label: string; type: 'text'|'number'|'date'|'date-range'|'select'|'multi-select'; placeholder?: string; options?: string[] }>",
    },
    exampleProps: {
      title: "Let's set up your campaign",
      questions: [
        { id: "flight", label: "Flight dates", type: "date-range" },
        { id: "budget", label: "Budget", type: "number", placeholder: "$" },
        { id: "objective", label: "Objective", type: "select", options: ["Prospecting", "Retargeting", "Brand awareness", "Conversions"] },
        { id: "partners", label: "Media partners", type: "multi-select", options: ["Meta", "DV360", "The Trade Desk", "Yahoo DSP"] },
        { id: "kpi", label: "Primary KPI", type: "text", placeholder: "e.g. CTR, ROAS" },
      ],
    },
    allowedActions: [],
    fallbackText: "To get started, I need a few details about your campaign.",
    whenToUse: "The user is starting a new campaign, media plan, or planning task and needs to supply several structured inputs at once (dates, budget, objective, partners, formats, KPIs, etc.). Use this INSTEAD of listing questions as a numbered text list — always prefer the card for media-plan intake. The card supports types: text, number, date (single calendar), date-range (from/to calendars), select (dropdown with options[]), multi-select (pill checkboxes with options[]).",
    whenNotToUse: "Only one simple clarification is needed — ask it in 'reply' text. The user has already provided enough information to proceed. The question is about the data model rather than campaign setup.",
  },

  {
    cardType: "customFilter",
    propsSchema: {
      columns: "string[]",
      operators: "string[]?",
      selectedColumn: "string?",
      selectedOperator: "string?",
      value: "string?",
    },
    exampleProps: {
      columns: ["SKU", "Price", "availability", "Category"],
      operators: ["=", "≠", ">", "<", "contains", "is empty"],
      selectedColumn: "availability",
      selectedOperator: "=",
      value: "out of stock",
    },
    allowedActions: ["apply", "cancel"],
    fallbackText: "Build a custom filter rule by choosing a column, an operator, and a value.",
    whenToUse: "The user wants to define their own filter rule rather than accept an AI recommendation. Use after filterRecommendation is dismissed, or when the user explicitly asks to build a filter.",
    whenNotToUse: "The agent is recommending a specific rule → filterRecommendation. Showing the aggregate effect of filters already applied → filterImpactSummary.",
  },
];
