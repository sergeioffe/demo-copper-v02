// ProjectStore — thin adapter between routes and project-store package.
// For M1: uses the in-memory fixture as the only project.
// For M2: delegates to GCS-backed store (project-store package).

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";
import type { Version, ReasoningLogEntry } from "@copper/contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export interface VersionSummary {
  versionNum: number;
  parentVersion: number | null;
  authoredBy: "user" | "system";
  createdAt: string;
}

export interface ProjectStore {
  listProjects(): Promise<ProjectSummary[]>;
  createProject(name: string): Promise<Version>;
  loadLatestVersion(id: string): Promise<Version | null>;
  loadVersionAt(id: string, versionNum: number): Promise<Version | null>;
  listVersionSummaries(id: string): Promise<VersionSummary[]>;
  saveVersion(id: string, version: Version): Promise<Version>;
  listTransactionPasses(id: string, versionNum: number): Promise<string[]>;
  listReasoningEntries(id: string, versionNum: number, pass: string): Promise<ReasoningLogEntry[]>;
  appendReasoningEntry(id: string, versionNum: number, pass: string, entry: ReasoningLogEntry): Promise<void>;
}

export function makeBlankVersion(id: string, name: string): Version {
  return {
    id,
    name,
    version: 1,
    parentVersion: null,
    authoredBy: "user",
    createdAt: new Date().toISOString(),
    context: { contextFiles: [], exchanges: [] },
    plans: {
      data:     { document: "", model: { entities: {}, connections: [] } },
      media:    { document: "", model: { entities: {}, connections: [] } },
      creative: { document: "", model: null },
    },
  };
}

// ── M1: In-memory fixture store ───────────────────────────────────────────────

function loadFixture(): Version {
  const fixturePath = path.resolve(__dirname, "../fixtures/lmh-v2.json");
  const raw = readFileSync(fixturePath, "utf8");
  return JSON.parse(raw) as Version;
}

export class FixtureStore implements ProjectStore {
  // All projects: projectId → ordered Version array (index 0 = v1, last = latest)
  private projects = new Map<string, Version[]>();
  // In-memory reasoning log: key = "id/versionNum/pass"
  private rlog = new Map<string, ReasoningLogEntry[]>();

  constructor() {
    const seed = loadFixture();
    this.projects.set(seed.id, [seed]);
    console.log(`[store] ✅ Fixture loaded: ${seed.name} (v${seed.version})`);
  }

  private versionsFor(id: string): Version[] {
    return this.projects.get(id) ?? [];
  }

  private latestFor(id: string): Version | null {
    const vs = this.versionsFor(id);
    return vs.length ? vs[vs.length - 1] : null;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values()).map((vs) => {
      const latest = vs[vs.length - 1];
      return { id: latest.id, name: latest.name, version: latest.version, updatedAt: latest.createdAt };
    });
  }

  async createProject(name: string): Promise<Version> {
    const id = `${slugify(name)}-${randomUUID().replace(/-/g, "").slice(0, 5)}`;
    const blank = makeBlankVersion(id, name);
    this.projects.set(id, [blank]);
    console.log(`[store] ✅ New project created: "${name}" (${id})`);
    return blank;
  }

  async loadLatestVersion(id: string): Promise<Version | null> {
    return this.latestFor(id);
  }

  async saveVersion(_id: string, version: Version): Promise<Version> {
    const vs = this.projects.get(version.id);
    if (vs) {
      vs.push(version);
    } else {
      this.projects.set(version.id, [version]);
    }
    return version;
  }

  async loadVersionAt(id: string, versionNum: number): Promise<Version | null> {
    return this.versionsFor(id).find((v) => v.version === versionNum) ?? null;
  }

  async listVersionSummaries(id: string): Promise<VersionSummary[]> {
    return this.versionsFor(id).map((v) => ({
      versionNum: v.version,
      parentVersion: v.parentVersion,
      authoredBy: v.authoredBy,
      createdAt: v.createdAt,
    }));
  }

  async listTransactionPasses(id: string, versionNum: number): Promise<string[]> {
    const prefix = `${id}/${versionNum}/`;
    const passes = new Set<string>();
    for (const key of this.rlog.keys()) {
      if (key.startsWith(prefix)) passes.add(key.slice(prefix.length));
    }
    return Array.from(passes);
  }

  async listReasoningEntries(id: string, versionNum: number, pass: string): Promise<ReasoningLogEntry[]> {
    return this.rlog.get(`${id}/${versionNum}/${pass}`) ?? [];
  }

  async appendReasoningEntry(id: string, versionNum: number, pass: string, entry: ReasoningLogEntry): Promise<void> {
    const key = `${id}/${versionNum}/${pass}`;
    const existing = this.rlog.get(key) ?? [];
    this.rlog.set(key, [...existing, entry]);
  }
}

// ── M2: GCS-backed store (activated when GCS credentials are present) ─────────
// Imported lazily so M1 starts without GCS configured.

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "project";
}

export async function createStore(): Promise<ProjectStore> {
  const hasGCS =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim().length > 10;

  if (hasGCS) {
    // Dynamically import the GCS store to avoid startup crash when credentials are absent
    const { GCSProjectStore } = await import("./gcsStore.js");
    const gcsStore = new GCSProjectStore();
    console.log("[store] GCS credentials present — store ready (connection verified on first request)");

    // Seed check deferred to first listProjects() call so startup never touches GCS auth.
    // The bucket has been seeded in prior deploys; this is a no-op in production.
    setImmediate(async () => {
      try {
        const existing = await gcsStore.listProjects();
        if (existing.length === 0) {
          console.log("[store] GCS bucket is empty — seeding LMH fixture…");
          const seed = loadFixture();
          await gcsStore.saveVersion(seed.id, seed);
          console.log(`[store] ✅ Seeded ${seed.name} (v${seed.version}) into GCS`);
        } else {
          console.log(`[store] ✅ GCS connected (${existing.length} project${existing.length !== 1 ? "s" : ""})`);
        }
      } catch (err) {
        console.error("[store] GCS background check failed:", (err as Error).message);
      }
    });

    return gcsStore;
  }

  console.log("[store] No GCS credentials found — using in-memory fixture store (M1 mode)");
  return new FixtureStore();
}
