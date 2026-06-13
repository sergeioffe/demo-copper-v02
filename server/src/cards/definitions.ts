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
    whenToUse: "A source has been read and the system can summarize what it found: row counts, column counts, live-feed status, warnings.",
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
];
