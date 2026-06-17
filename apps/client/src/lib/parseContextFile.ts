import * as XLSX from "xlsx";
import type { ContextFile } from "@copper/contracts";
import type { WizardShape } from "../wizardStandin.js";

export type FileClass = "table" | "spreadsheet" | "file";

export function classifyFile(name: string): FileClass {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["csv", "json"].includes(ext)) return "table";
  if (["xlsx", "xls"].includes(ext)) return "spreadsheet";
  return "file";
}

export function parkRawFile(f: File): ContextFile {
  return { name: f.name, kind: "file", size: f.size, addedAt: new Date().toISOString() };
}

export async function parseContextFile(f: File): Promise<ContextFile> {
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv") return parseCSV(f);
  if (ext === "json") return parseJSON(f);
  if (["xlsx", "xls"].includes(ext)) return parseExcel(f);
  return parkRawFile(f);
}

async function parseCSV(f: File): Promise<ContextFile> {
  const text = await f.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const columns = lines.length > 0 ? splitCSVRow(lines[0]) : [];
  const dataRows = lines.slice(1);
  const preview = dataRows.slice(0, 3).map(splitCSVRow);
  return {
    name: f.name,
    kind: "spreadsheet",
    size: f.size,
    addedAt: new Date().toISOString(),
    sheets: [{ name: "Sheet1", rowCount: dataRows.length, columns, preview }],
  };
}

function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

async function parseJSON(f: File): Promise<ContextFile> {
  const text = await f.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { return parkRawFile(f); }
  const arr = Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);
  const columns = arr.length > 0 ? Object.keys(arr[0] as object) : [];
  const preview = arr.slice(0, 3).map((r) =>
    columns.map((c) => String((r as Record<string, unknown>)[c] ?? "")),
  );
  return {
    name: f.name,
    kind: "spreadsheet",
    size: f.size,
    addedAt: new Date().toISOString(),
    sheets: [{ name: "Sheet1", rowCount: arr.length, columns, preview }],
  };
}

async function parseExcel(f: File): Promise<ContextFile> {
  const buf = await f.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    const columns = (rows[0] ?? []).map(String);
    const dataRows = rows.slice(1);
    return {
      name,
      rowCount: dataRows.length,
      columns,
      preview: dataRows.slice(0, 3).map((r) => r.map(String)),
    };
  });
  return {
    name: f.name,
    kind: "spreadsheet",
    size: f.size,
    addedAt: new Date().toISOString(),
    sheets,
  };
}

export function buildWizardShapeFromFile(cf: ContextFile): WizardShape {
  const sheet = cf.sheets?.[0];
  const tableName = cf.name.replace(/\.[^.]+$/, "");
  const ext = cf.name.toLowerCase().split(".").pop() ?? "";
  const sourceLabel =
    ext === "csv" ? "CSV Upload" : ext === "json" ? "JSON Upload" : "Excel Upload";
  const firstCol = sheet?.columns[0] ?? "id";
  const sampleVals = (sheet?.preview ?? []).slice(0, 2).map((r) => r[0] ?? "").filter(Boolean);
  const columns = sheet?.columns ?? [];
  const preview = sheet?.preview ?? [];
  const rowCount = sheet?.rowCount ?? 0;

  const fieldMappingRows = columns.map((col) => ({
    fileColumn: col,
    systemColumn: col.toLowerCase().replace(/\s+/g, "_"),
    type: "string",
    required: col === firstCol,
  }));

  return {
    wizard: {
      title: `Import: ${tableName}`,
      steps: [
        {
          id: "s1", label: "Upload & detect",
          card: {
            cardType: "tableDiscovery",
            props: {
              tableName,
              sourceLabel,
              rows: rowCount,
              columns: columns.length,
              warnings: 0,
              skippedRows: 0,
              isLiveFeed: false,
              status: "analyzed",
            },
          },
        },
        {
          id: "s2", label: "Data findings",
          card: { cardType: "validationFindings", props: { findings: [] } },
        },
        {
          id: "s3", label: "Primary key",
          card: {
            cardType: "keySelection",
            props: {
              keyName: firstCol,
              mode: "single",
              isRecommended: true,
              isValid: true,
              uniqueValues: rowCount,
              totalValues: rowCount,
              duplicates: 0,
              missing: 0,
              sampleValues: sampleVals,
              reason: "First column detected as likely primary key.",
            },
          },
        },
        {
          id: "s4", label: "Field mapping",
          card: {
            cardType: "fieldMapping",
            props: {
              rows: fieldMappingRows,
              mappedCount: fieldMappingRows.length,
              totalCount: fieldMappingRows.length,
              typeWarnings: 0,
            },
          },
        },
        {
          id: "s5", label: "Import settings",
          card: {
            cardType: "importSettings",
            props: {
              tableName,
              sourceLabel,
              refreshMode: "manual",
              scheduleLabel: "Not scheduled",
            },
          },
        },
        {
          id: "s6", label: "Preview",
          card: {
            cardType: "tablePreview",
            props: {
              tableName,
              rowsCount: rowCount,
              columns,
              rows: preview,
              pageSize: 5,
            },
          },
        },
      ],
      commit: { label: "Import" },
    },
  };
}
