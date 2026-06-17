export interface WizardStep {
  id: string;
  label: string;
  card?: { cardType: string; props: Record<string, unknown> };
  stub?: true;
}

export interface WizardShape {
  wizard: { title: string; steps: WizardStep[]; commit: { label: string } };
}

export function getWizardShape(): WizardShape {
  return {
    wizard: {
      title: "Add Product Catalog",
      steps: [
        {
          id: "s1", label: "Choose source",
          card: {
            cardType: "sourceInput",
            props: {
              options: [
                { id: "gsheets", label: "Google Sheets", description: "Connect a live spreadsheet" },
                { id: "file",    label: "Upload file",   description: "Excel, CSV, or JSON" },
                { id: "api",     label: "REST API",      description: "Pull from an endpoint" },
              ],
              selectedSourceId: "gsheets",
            },
          },
        },
        {
          id: "s2", label: "Upload & detect",
          card: { cardType: "tableDiscovery", props: { tableName: "Zesty Zing Catalog", sourceLabel: "Google Sheets", rows: 12567, columns: 6, warnings: 3, skippedRows: 6, isLiveFeed: true, status: "analyzed" } },
        },
        {
          id: "s3", label: "Data findings",
          card: { cardType: "validationFindings", props: { findings: [
            { id: "missing_price", title: "Empty cells in Price column", column: "Price", rowsAffected: 18, severity: "warning", status: "open" },
            { id: "broken_image", title: "Broken URL in Image column", column: "Image", rowsAffected: 4, severity: "warning", status: "open" },
          ] } },
        },
        {
          id: "s4", label: "Filtering rules",
          card: { cardType: "filterRecommendation", props: { title: "Exclude out-of-stock products", reason: "2,312 products have availability = out of stock...", rowsRemoved: 2312, field: "availability", operator: "=", value: "out of stock", status: "recommended" } },
        },
        {
          id: "s5", label: "Filter impact",
          card: { cardType: "filterImpactSummary", props: { originalRows: 12567, currentRows: 10255, activeFilters: 1 } },
        },
        {
          id: "s6", label: "Primary key",
          card: { cardType: "keySelection", props: { keyName: "SKU", mode: "single", isRecommended: true, isValid: true, uniqueValues: 10255, totalValues: 10255, duplicates: 0, missing: 0, sampleValues: ["SKU-4954333", "SKU-58444333"], reason: "SKU is unique, complete, and stable across syncs." } },
        },
        {
          id: "s7", label: "Field mapping",
          card: {
            cardType: "fieldMapping",
            props: {
              rows: [
                { fileColumn: "SKU",          systemColumn: "sku",          type: "string",  required: true },
                { fileColumn: "Product Name",  systemColumn: "product_name", type: "string" },
                { fileColumn: "Price",         systemColumn: "price",        type: "number" },
                { fileColumn: "availability",  systemColumn: "availability", type: "string" },
                { fileColumn: "Image",         systemColumn: "image_url",    type: "url" },
                { fileColumn: "Category",      systemColumn: "category",     type: "string" },
              ],
              mappedCount: 6,
              totalCount: 6,
              typeWarnings: 1,
            },
          },
        },
        {
          id: "s8", label: "Import settings",
          card: {
            cardType: "importSettings",
            props: {
              tableName: "Zesty Zing Catalog",
              brand: "Zesty Zing",
              refreshMode: "live",
              sourceLabel: "Google Sheets",
            },
          },
        },
        {
          id: "s9", label: "Catalog preview",
          card: {
            cardType: "tablePreview",
            props: {
              tableName: "Zesty Zing Catalog",
              rowsCount: 10255,
              columns: ["SKU", "Product Name", "Price", "availability", "Image", "Category"],
              rows: [
                ["SKU-4954333", "Zesty Zing Original", "4.99", "in stock",     "https://...", "Beverages"],
                ["SKU-58444333","Zesty Zing Lime",     "4.99", "in stock",     "https://...", "Beverages"],
                ["SKU-7823111", "Zesty Zing Berry",    "5.49", "in stock",     "https://...", "Beverages"],
              ],
              pageSize: 5,
            },
          },
        },
      ],
      commit: { label: "Save" },
    },
  };
}

// Extract a best-guess table name from a natural-language message
function extractTableNameHint(message: string): string {
  // "add a Products table" / "create an Orders dataset"
  const m = message.match(/(?:add|create|import|upload|new)\s+(?:a\s+|an\s+)?["']?([A-Za-z0-9_\- ]+?)["']?\s+(?:table|dataset|data\s+table)/i);
  if (m) return m[1].trim();
  // "add [some word]" — last resort
  const m2 = message.match(/(?:add|create|import)\s+(?:a\s+|an\s+)?["']?([A-Za-z0-9_\-]+)["']?/i);
  if (m2 && !["table", "dataset", "new"].includes(m2[1].toLowerCase())) return m2[1].trim();
  return "New Table";
}

// Build a minimal wizard for chat-triggered table addition (no file provided)
export function buildWizardShapeFromIntent(message: string): WizardShape {
  const tableName = extractTableNameHint(message);
  return {
    wizard: {
      title: `Add table: ${tableName}`,
      steps: [
        {
          id: "s1", label: "Choose source",
          card: {
            cardType: "sourceInput",
            props: {
              options: [
                { id: "file",    label: "Upload file",   description: "Excel, CSV, or JSON" },
                { id: "gsheets", label: "Google Sheets", description: "Connect a live spreadsheet" },
                { id: "api",     label: "REST API",      description: "Pull from an endpoint" },
              ],
            },
          },
        },
        {
          id: "s2", label: "Detect schema",
          card: {
            cardType: "tableDiscovery",
            props: {
              tableName,
              sourceLabel: "Not connected",
              rows: 0,
              columns: 0,
              warnings: 0,
              skippedRows: 0,
              isLiveFeed: false,
              status: "pending",
            },
          },
        },
        {
          id: "s3", label: "Primary key",
          card: {
            cardType: "keySelection",
            props: {
              keyName: "id",
              mode: "single",
              isRecommended: false,
              isValid: false,
              uniqueValues: 0,
              totalValues: 0,
              duplicates: 0,
              missing: 0,
              sampleValues: [],
              reason: "Connect a source to auto-detect the best key.",
            },
          },
        },
        {
          id: "s4", label: "Import settings",
          card: {
            cardType: "importSettings",
            props: {
              tableName,
              refreshMode: "manual",
              scheduleLabel: "Not scheduled",
            },
          },
        },
      ],
      commit: { label: "Add Table" },
    },
  };
}

const ACTION_WORDS = ["add", "create", "upload", "import", "set up", "setup", "build", "configure", "new"];
const CATALOG_WORDS = ["catalog", "product catalog"];

export function detectWizardIntent(message: string): boolean {
  const lower = message.toLowerCase();
  // Catalog-specific intent (original)
  if (ACTION_WORDS.some((a) => lower.includes(a)) && CATALOG_WORDS.some((t) => lower.includes(t))) return true;
  // Generic table-creation intent: action word near "table" / "dataset"
  if (/\b(add|create|import|upload|new)\b.{0,40}\b(table|dataset|data\s+table)\b/i.test(message)) return true;
  return false;
}
