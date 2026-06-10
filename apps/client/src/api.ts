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
): Promise<ChatResponse> {
  return post<ChatResponse>(`/projects/${id}/chat`, { message, llmModel, exchanges });
}

export function listVersions(id: string): Promise<VersionSummary[]> {
  return get<VersionSummary[]>(`/projects/${id}/versions`);
}

export function getVersionDiff(id: string, versionNum: number): Promise<VersionDiff> {
  return get<VersionDiff>(`/projects/${id}/versions/${versionNum}/diff`);
}

export type { ReasoningLogEntry };
