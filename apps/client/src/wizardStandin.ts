// Stand-in for the engine seam: returns one hardcoded wizard shape.
// Replace with a real engine call when the LLM can emit { wizard: {...} }.
// The surface, player, registry, and cards do NOT need to change when this is replaced.

export interface WizardStep {
  id: string;
  label: string;
  card?: { cardType: string; props: Record<string, unknown> };
  stub?: true;
}

export interface WizardShape {
  wizard: {
    title: string;
    steps: WizardStep[];
    commit: { label: string };
  };
}

export function getWizardShape(): WizardShape {
  return {
    wizard: {
      title: "Add Product Catalog",
      steps: [
        {
          id: "s1",
          label: "Upload & detect",
          card: {
            cardType: "tableDiscovery",
            props: {
              tableName: "Zesty Zing Catalog",
              sourceLabel: "Google Sheets",
              rows: 12567,
              columns: 6,
              warnings: 3,
              skippedRows: 6,
              isLiveFeed: true,
              status: "analyzed",
            },
          },
        },
        {
          id: "s2",
          label: "Data findings",
          card: {
            cardType: "validationFindings",
            props: {
              findings: [
                {
                  id: "missing_price",
                  title: "Empty cells in Price column",
                  column: "Price",
                  rowsAffected: 18,
                  severity: "warning",
                  status: "open",
                },
                {
                  id: "broken_image",
                  title: "Broken URL in Image column",
                  column: "Image",
                  rowsAffected: 4,
                  severity: "warning",
                  status: "open",
                },
              ],
            },
          },
        },
        {
          id: "s3",
          label: "Filtering rules",
          card: {
            cardType: "filterRecommendation",
            props: {
              title: "Exclude out-of-stock products",
              reason:
                "2,312 products have availability = out of stock. Advertising unavailable items wastes spend.",
              rowsRemoved: 2312,
              field: "availability",
              operator: "=",
              value: "out of stock",
              status: "recommended",
            },
          },
        },
        {
          id: "s4",
          label: "Primary key",
          card: {
            cardType: "keySelection",
            props: {
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
          },
        },
        { id: "s5", label: "Field mapping",    stub: true },
        { id: "s6", label: "Schedule",         stub: true },
        { id: "s7", label: "Catalog preview",  stub: true },
      ],
      commit: { label: "Save" },
    },
  };
}
