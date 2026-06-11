// GCS-backed project store.
// Layout (from schema doc C):
//   project_data/{project-id}/ver{NN}/project.json
//   project_data/{project-id}/ver{NN}/transactions/{pass-id}/rlog_{seq}.json

import type { Version, ReasoningLogEntry } from "@copper/contracts";
import type { StorageProvider } from "./types.js";

const ROOT = "project_data";

function projectRoot(projectId: string): string {
  return `${ROOT}/${projectId}`;
}

function verFolder(projectId: string, versionNum: number): string {
  return `${projectRoot(projectId)}/ver${String(versionNum).padStart(2, "0")}`;
}

export class ProjectStoreGCS {
  constructor(private readonly storage: StorageProvider) {}

  async listProjects(): Promise<Array<{ id: string; name: string; version: number; updatedAt: string }>> {
    const folders = await this.storage.listFolders(ROOT);
    const results = [];
    for (const projectId of folders) {
      try {
        const latest = await this.loadLatestVersion(projectId);
        if (latest) {
          results.push({
            id: latest.id,
            name: latest.name,
            version: latest.version,
            updatedAt: latest.createdAt,
          });
        }
      } catch {
        // Skip projects that fail to load
      }
    }
    return results;
  }

  async loadVersion(projectId: string, versionNum: number): Promise<Version | null> {
    const p = `${verFolder(projectId, versionNum)}/project.json`;
    const exists = await this.storage.exists(p);
    if (!exists) return null;
    const raw = await this.storage.read(p);
    return JSON.parse(raw) as Version;
  }

  async loadLatestVersion(projectId: string): Promise<Version | null> {
    const folders = await this.storage.listFolders(projectRoot(projectId));
    const verFolders = folders
      .filter((f) => /^ver\d+$/.test(f))
      .sort()
      .reverse();
    // Walk backwards: a version folder may exist with only transactions (no project.json)
    // when reasoning log was journaled before the user explicitly saved the version.
    for (const folder of verFolders) {
      const num = parseInt(folder.slice(3), 10);
      const v = await this.loadVersion(projectId, num);
      if (v) return v;
    }
    return null;
  }

  async saveVersion(projectId: string, version: Version): Promise<Version> {
    const p = `${verFolder(projectId, version.version)}/project.json`;
    await this.storage.write(p, JSON.stringify(version, null, 2));
    console.log(`[project-store] saved ${p}`);
    return version;
  }

  async listTransactionPasses(projectId: string, versionNum: number): Promise<string[]> {
    const prefix = `${verFolder(projectId, versionNum)}/transactions`;
    return this.storage.listFolders(prefix);
  }

  async listReasoningEntries(
    projectId: string,
    versionNum: number,
    pass: string,
  ): Promise<ReasoningLogEntry[]> {
    const prefix = `${verFolder(projectId, versionNum)}/transactions/${pass}`;
    const files = await this.storage.list(prefix);
    const entries: ReasoningLogEntry[] = [];
    for (const file of files.sort()) {
      if (!file.endsWith(".json")) continue;
      const raw = await this.storage.read(`${prefix}/${file}`);
      entries.push(JSON.parse(raw) as ReasoningLogEntry);
    }
    return entries;
  }

  async listVersionSummaries(projectId: string): Promise<Array<{
    versionNum: number;
    parentVersion: number | null;
    authoredBy: "user" | "system";
    createdAt: string;
  }>> {
    const folders = await this.storage.listFolders(projectRoot(projectId));
    const verFolders = folders.filter((f) => /^ver\d+$/.test(f)).sort();
    const results: Array<{ versionNum: number; parentVersion: number | null; authoredBy: "user" | "system"; createdAt: string }> = [];
    for (const folder of verFolders) {
      const num = parseInt(folder.slice(3), 10);
      try {
        const v = await this.loadVersion(projectId, num);
        if (v) results.push({ versionNum: v.version, parentVersion: v.parentVersion, authoredBy: v.authoredBy, createdAt: v.createdAt });
      } catch { /* skip */ }
    }
    return results;
  }

  async appendReasoningEntry(
    projectId: string,
    versionNum: number,
    pass: string,
    entry: ReasoningLogEntry,
  ): Promise<void> {
    const p = `${verFolder(projectId, versionNum)}/transactions/${pass}/rlog_${String(entry.seq).padStart(4, "0")}.json`;
    await this.storage.write(p, JSON.stringify(entry, null, 2));
  }

  async validate(): Promise<void> {
    await this.storage.listFolders(ROOT);
    console.log("[project-store] ✅ GCS store validated");
  }
}
