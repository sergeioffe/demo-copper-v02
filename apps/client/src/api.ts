import type { Version, ReasoningLogEntry, Exchange } from "@copper/contracts";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export function listProjects(): Promise<ProjectSummary[]> {
  return get<ProjectSummary[]>("/projects");
}

export function createProject(name: string): Promise<Version> {
  return post<Version>("/projects", { name });
}

export function loadProject(id: string): Promise<Version> {
  return get<Version>(`/projects/${id}`);
}

export function saveProject(id: string, version: Version): Promise<Version> {
  return put<Version>(`/projects/${id}`, version);
}

export function listTransactionPasses(id: string, versionNum: number): Promise<string[]> {
  return get<string[]>(`/projects/${id}/versions/${versionNum}/transactions`);
}

export function listReasoningEntries(
  id: string,
  versionNum: number,
  pass: string,
): Promise<ReasoningLogEntry[]> {
  return get<ReasoningLogEntry[]>(`/projects/${id}/versions/${versionNum}/transactions/${pass}`);
}

export interface VersionSummary {
  versionNum: number;
  parentVersion: number | null;
  authoredBy: "user" | "system";
  createdAt: string;
}

export interface EntityChangeSummary {
  id: string;
  type: string;
  name: string;
  plan: "data" | "media";
  kind: "added" | "removed" | "modified";
  changedFields?: string[];
}

export interface VersionDiff {
  fromVersion: number | null;
  toVersion: number;
  isInitial: boolean;
  entityChanges: EntityChangeSummary[];
  connectionsAdded: number;
  connectionsRemoved: number;
}

export interface ChatResponse {
  exchange: Exchange;
  version: Version | null;
}

export function chat(
  id: string,
  message: string,
  llmModel: string,
  exchanges: Exchange[],
  version: Version,
): Promise<ChatResponse> {
  return post<ChatResponse>(`/projects/${id}/chat`, { message, llmModel, exchanges, version });
}

export function listVersions(id: string): Promise<VersionSummary[]> {
  return get<VersionSummary[]>(`/projects/${id}/versions`);
}

export function getVersionDiff(id: string, versionNum: number): Promise<VersionDiff> {
  return get<VersionDiff>(`/projects/${id}/versions/${versionNum}/diff`);
}

export type { ReasoningLogEntry };

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminListResult {
  folders: string[];
  files: string[];
}

export function adminList(prefix: string): Promise<AdminListResult> {
  return get<AdminListResult>(`/admin/list?prefix=${encodeURIComponent(prefix)}`);
}

export function adminReadFile(path: string): Promise<{ path: string; content: string }> {
  return get(`/admin/file?path=${encodeURIComponent(path)}`);
}

export function adminWriteFile(path: string, content: string): Promise<{ ok: boolean; path: string }> {
  const res = fetch(`${BASE}/admin/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  return res.then((r) => {
    if (!r.ok) throw new Error(`PUT /admin/file → ${r.status}`);
    return r.json();
  });
}

// ── KB versioning ─────────────────────────────────────────────────────────────

export interface KBVersionMeta {
  realId: string;
  label: string;
  description: string;
  by: "human" | "agent";
  at: string;
  superseded?: boolean;
}

export function adminKBVersions(): Promise<{ versions: KBVersionMeta[] }> {
  return get("/admin/kb/versions");
}

export function adminKBCut(
  label: string,
  description: string,
  by: "human" | "agent",
): Promise<{ ok: boolean; version: KBVersionMeta }> {
  return post("/admin/kb/cut", { label, description, by });
}

export function adminKBVersionFiles(realId: string): Promise<{ files: string[] }> {
  return get(`/admin/kb/versions/${encodeURIComponent(realId)}/files`);
}

export function adminKBVersionFile(
  realId: string,
  name: string,
): Promise<{ name: string; content: string }> {
  return get(`/admin/kb/versions/${encodeURIComponent(realId)}/file?name=${encodeURIComponent(name)}`);
}

export function adminKBRollback(realId: string): Promise<{ ok: boolean; realId: string }> {
  return post(`/admin/kb/versions/${encodeURIComponent(realId)}/rollback`, {});
}

// ── QA agent ──────────────────────────────────────────────────────────────────

export interface QARunResult {
  ops: unknown[];
  reasoning: Record<string, unknown>;
  systemPromptLength: number;
}

export interface QAJudgeResult {
  judgment: "pass" | "fail";
  diagnosis: string | null;
  proposedFiles: Array<{ path: string; content: string; original: string }>;
}

const QA_EMPTY_VERSION = {
  id: "qa-test", name: "QA Test Project", version: 1,
  parentVersion: null, authoredBy: "system",
  createdAt: new Date().toISOString(),
  context: { contextFiles: [], exchanges: [] },
  plans: {
    data: { document: "", model: { entities: {}, connections: [] } },
    media: { document: "", model: { entities: {}, connections: [] } },
    creative: { document: "", model: null },
  },
};

export async function adminQARun(
  prompt: string,
  kbOverride?: Array<{ path: string; content: string }>,
): Promise<QARunResult> {
  const body: Record<string, unknown> = { message: prompt, version: QA_EMPTY_VERSION, exchanges: [] };
  if (kbOverride) body.kbOverride = kbOverride;
  const res = await fetch(`${BASE}/debug/project/qa-test/submit`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`QA run failed: ${res.status}`);
  const data = await res.json();
  return {
    ops: data.ops ?? [],
    reasoning: data.rlogEntry?.reasoning ?? {},
    systemPromptLength: data.diagnostics?.systemPromptLength ?? 0,
  };
}

export async function adminQAFetchKBFiles(): Promise<Array<{ path: string; content: string }>> {
  const { files } = await get<{ files: string[] }>("/admin/list?prefix=knowledge%2Fdata-activation%2F");
  const results = await Promise.all(
    files.filter((f: string) => f.endsWith(".md")).map(async (name: string) => {
      const path = `knowledge/data-activation/${name}`;
      const { content } = await get<{ content: string }>(`/admin/file?path=${encodeURIComponent(path)}`);
      return { path, content };
    }),
  );
  return results;
}

// ── Card definitions ──────────────────────────────────────────────────────────

export interface CardDefinition {
  cardType: string;
  propsSchema: Record<string, string>;
  exampleProps: Record<string, unknown>;
  allowedActions: string[];
  fallbackText: string;
  whenToUse: string;
  whenNotToUse: string;
}

export function loadCardDefinitions(): Promise<{ definitions: CardDefinition[] }> {
  return get("/cards/definitions");
}

export function seedCards(): Promise<{ ok: boolean; written: string[] }> {
  return post("/cards/seed", {});
}

export function adminQAPropose(
  prompt: string,
  expected: string,
  run: QARunResult,
  kbFiles: Array<{ path: string; content: string }>,
): Promise<QAJudgeResult> {
  return post("/admin/qa/propose", {
    prompt, expected, ops: run.ops, reasoning: run.reasoning, kbFiles,
  });
}
