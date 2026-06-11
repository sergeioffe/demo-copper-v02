// GCS-backed ProjectStore — activated when GOOGLE_SERVICE_ACCOUNT_JSON is present.
// Wraps project-store package's ProjectStoreGCS with the server's GCSStorageProvider.

import { randomUUID } from "crypto";
import type { ProjectStore, ProjectSummary, VersionSummary } from "./store.js";
import { makeBlankVersion, slugify } from "./store.js";
import type { Version, ReasoningLogEntry } from "@copper/contracts";
import { GCSStorageProvider } from "./storage/gcs.js";
import { ProjectStoreGCS } from "@copper/project-store";

export class GCSProjectStore implements ProjectStore {
  private inner: ProjectStoreGCS;
  private gcsProvider: GCSStorageProvider;

  constructor() {
    this.gcsProvider = new GCSStorageProvider();
    this.inner = new ProjectStoreGCS(this.gcsProvider);
  }

  async validate(): Promise<void> {
    await this.gcsProvider.validate();
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return this.inner.listProjects();
  }

  async createProject(name: string): Promise<Version> {
    const id = `${slugify(name)}-${randomUUID().replace(/-/g, "").slice(0, 5)}`;
    const blank = makeBlankVersion(id, name);
    await this.inner.saveVersion(id, blank);
    return blank;
  }

  async loadLatestVersion(id: string): Promise<Version | null> {
    return this.inner.loadLatestVersion(id);
  }

  async saveVersion(id: string, version: Version): Promise<Version> {
    return this.inner.saveVersion(id, version);
  }

  async listTransactionPasses(id: string, versionNum: number): Promise<string[]> {
    return this.inner.listTransactionPasses(id, versionNum);
  }

  async listReasoningEntries(id: string, versionNum: number, pass: string): Promise<ReasoningLogEntry[]> {
    return this.inner.listReasoningEntries(id, versionNum, pass);
  }

  async loadVersionAt(id: string, versionNum: number): Promise<Version | null> {
    return this.inner.loadVersion(id, versionNum);
  }

  async listVersionSummaries(id: string): Promise<VersionSummary[]> {
    return this.inner.listVersionSummaries(id);
  }

  async appendReasoningEntry(id: string, versionNum: number, pass: string, entry: ReasoningLogEntry): Promise<void> {
    return this.inner.appendReasoningEntry(id, versionNum, pass, entry);
  }
}
