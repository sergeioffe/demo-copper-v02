import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { CARD_DEFINITIONS } from "../cards/definitions.js";
import type { CardDefinition } from "../cards/definitions.js";

const UXCARDS_PREFIX = "knowledge/ux-cards/";

function makeStorage(): GCSStorageProvider {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    throw new Error("GCS not configured");
  }
  return new GCSStorageProvider();
}

async function readDefinitionsFromGCS(s: GCSStorageProvider): Promise<CardDefinition[]> {
  let files: string[];
  try {
    files = await s.list(UXCARDS_PREFIX);
  } catch {
    return [];
  }
  const jsonFiles = files.filter((f) => f.endsWith(".json") && f !== "meta.json");
  const defs: CardDefinition[] = [];
  for (const file of jsonFiles) {
    try {
      const raw = await s.read(`${UXCARDS_PREFIX}${file}`);
      defs.push(JSON.parse(raw) as CardDefinition);
    } catch { /* skip corrupt */ }
  }
  return defs;
}

// Writes all bundled definitions to GCS. Idempotent.
async function runSeed(s: GCSStorageProvider): Promise<string[]> {
  const written: string[] = [];
  for (const def of CARD_DEFINITIONS) {
    const path = `${UXCARDS_PREFIX}${def.cardType}.json`;
    await s.write(path, JSON.stringify(def, null, 2));
    written.push(path);
  }
  const meta = { seededAt: new Date().toISOString(), count: CARD_DEFINITIONS.length };
  await s.write(`${UXCARDS_PREFIX}meta.json`, JSON.stringify(meta, null, 2));
  written.push(`${UXCARDS_PREFIX}meta.json`);
  return written;
}

// ── Auto-seed on startup ──────────────────────────────────────────────────────
// Called from server/src/index.ts after GCS is confirmed available.
// Checks knowledge/ux-cards/meta.json; seeds if absent.
export async function ensureCardsSeedded(): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return; // local/M1 mode

  let s: GCSStorageProvider;
  try {
    s = makeStorage();
  } catch {
    return;
  }

  try {
    await s.read(`${UXCARDS_PREFIX}meta.json`);
    console.log("[cards] ✅ Card definitions already in GCS — skipping seed");
  } catch {
    console.log("[cards] ⏳ Seeding card definitions to GCS…");
    try {
      const written = await runSeed(s);
      console.log(`[cards] ✅ Seeded ${written.length} files to knowledge/ux-cards/`);
    } catch (err) {
      console.warn(`[cards] ⚠️  Seed failed: ${(err as Error).message}`);
    }
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export function makeCardsRouter(): Router {
  const router = Router();

  // GET /api/cards/definitions
  router.get("/definitions", async (_req, res) => {
    try {
      const s = makeStorage();
      let defs = await readDefinitionsFromGCS(s);
      if (defs.length === 0) {
        defs = CARD_DEFINITIONS;
        res.setHeader("X-Cards-Source", "bundled");
      } else {
        res.setHeader("X-Cards-Source", "gcs");
      }
      res.json({ definitions: defs });
    } catch {
      res.setHeader("X-Cards-Source", "bundled-fallback");
      res.json({ definitions: CARD_DEFINITIONS });
    }
  });

  // POST /api/cards/seed — idempotent, re-seeds from bundled definitions
  router.post("/seed", async (_req, res) => {
    try {
      const s = makeStorage();
      const written = await runSeed(s);
      res.json({ ok: true, written });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
