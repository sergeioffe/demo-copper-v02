import { Router } from "express";
import { GCSStorageProvider } from "../storage/gcs.js";
import { CARD_DEFINITIONS } from "../cards/definitions.js";
import type { CardDefinition } from "../cards/definitions.js";

const UXCARDS_PREFIX = "knowledge/ux-cards/";
const HISTORY_PREFIX = "knowledge/ux-cards/history/";

export interface CardVersionEntry {
  v: string;   // "0001", "0002", ...
  at: string;  // ISO timestamp
  by: "seed" | "admin";
  note?: string;
}

function makeStorage(): GCSStorageProvider {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    throw new Error("GCS not configured");
  }
  return new GCSStorageProvider();
}

function padVersion(n: number): string {
  return String(n).padStart(4, "0");
}

async function readHistory(s: GCSStorageProvider, cardType: string): Promise<CardVersionEntry[]> {
  try {
    const raw = await s.read(`${HISTORY_PREFIX}${cardType}/log.json`);
    return JSON.parse(raw) as CardVersionEntry[];
  } catch {
    return [];
  }
}

async function appendVersion(
  s: GCSStorageProvider,
  cardType: string,
  def: CardDefinition,
  by: "seed" | "admin",
  note?: string,
): Promise<string> {
  const history = await readHistory(s, cardType);
  const v = padVersion(history.length + 1);
  const entry: CardVersionEntry = { v, at: new Date().toISOString(), by, ...(note ? { note } : {}) };
  await s.write(`${HISTORY_PREFIX}${cardType}/${v}.json`, JSON.stringify(def, null, 2));
  history.push(entry);
  await s.write(`${HISTORY_PREFIX}${cardType}/log.json`, JSON.stringify(history, null, 2));
  return v;
}

async function readDefinitionsFromGCS(s: GCSStorageProvider): Promise<CardDefinition[]> {
  let files: string[];
  try {
    files = await s.list(UXCARDS_PREFIX);
  } catch {
    return [];
  }
  // list() only returns non-nested filenames (no "/") so history/ files are naturally excluded
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

async function runSeed(s: GCSStorageProvider, by: "seed" | "admin" = "seed"): Promise<string[]> {
  const written: string[] = [];
  for (const def of CARD_DEFINITIONS) {
    await s.write(`${UXCARDS_PREFIX}${def.cardType}.json`, JSON.stringify(def, null, 2));
    const v = await appendVersion(s, def.cardType, def, by, "Seeded from bundled definitions");
    written.push(`${UXCARDS_PREFIX}${def.cardType}.json`);
    written.push(`${HISTORY_PREFIX}${def.cardType}/${v}.json`);
  }
  const meta = { seededAt: new Date().toISOString(), count: CARD_DEFINITIONS.length };
  await s.write(`${UXCARDS_PREFIX}meta.json`, JSON.stringify(meta, null, 2));
  written.push(`${UXCARDS_PREFIX}meta.json`);
  return written;
}

// ── Auto-seed on startup ──────────────────────────────────────────────────────

export async function ensureCardsSeedded(): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return;

  let s: GCSStorageProvider;
  try {
    s = makeStorage();
  } catch {
    return;
  }

  try {
    const existing = await readDefinitionsFromGCS(s);
    if (existing.length >= CARD_DEFINITIONS.length) {
      console.log(`[cards] ✅ Card definitions in GCS (${existing.length}) — skipping seed`);
      return;
    }
    console.log(`[cards] ⏳ GCS has ${existing.length} cards, bundled has ${CARD_DEFINITIONS.length} — re-seeding…`);
  } catch {
    console.log("[cards] ⏳ Seeding card definitions to GCS (first run)…");
  }
  try {
    const written = await runSeed(s, "seed");
    console.log(`[cards] ✅ Seeded ${CARD_DEFINITIONS.length} cards (${written.length} files) to knowledge/ux-cards/`);
  } catch (err) {
    console.warn(`[cards] ⚠️  Seed failed: ${(err as Error).message}`);
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

  // POST /api/cards/seed — re-seeds all cards; always creates a new version entry per card
  router.post("/seed", async (_req, res) => {
    try {
      const s = makeStorage();
      const written = await runSeed(s, "admin");
      res.json({ ok: true, written });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /api/cards/:cardType — update editable fields, record a new version
  router.put("/:cardType", async (req, res) => {
    try {
      const s = makeStorage();
      const { cardType } = req.params;
      const patch = req.body as Partial<Pick<CardDefinition, "whenToUse" | "whenNotToUse" | "fallbackText" | "allowedActions" | "exampleProps">>;
      const existingRaw = await s.read(`${UXCARDS_PREFIX}${cardType}.json`);
      const existing = JSON.parse(existingRaw) as CardDefinition;
      const updated: CardDefinition = {
        ...existing,
        ...(patch.whenToUse    !== undefined ? { whenToUse:    patch.whenToUse    } : {}),
        ...(patch.whenNotToUse !== undefined ? { whenNotToUse: patch.whenNotToUse } : {}),
        ...(patch.fallbackText !== undefined ? { fallbackText: patch.fallbackText } : {}),
        ...(patch.allowedActions !== undefined ? { allowedActions: patch.allowedActions } : {}),
        ...(patch.exampleProps  !== undefined ? { exampleProps:  patch.exampleProps  } : {}),
      };
      await s.write(`${UXCARDS_PREFIX}${cardType}.json`, JSON.stringify(updated, null, 2));
      const newV = await appendVersion(s, cardType, updated, "admin", "Edited via admin panel");
      res.json({ ok: true, cardType, version: newV, definition: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/cards/:cardType/history
  router.get("/:cardType/history", async (req, res) => {
    try {
      const s = makeStorage();
      const history = await readHistory(s, req.params.cardType);
      res.json({ cardType: req.params.cardType, history });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/cards/:cardType/versions/:v
  router.get("/:cardType/versions/:v", async (req, res) => {
    try {
      const s = makeStorage();
      const { cardType, v } = req.params;
      const raw = await s.read(`${HISTORY_PREFIX}${cardType}/${v}.json`);
      res.json({ cardType, v, definition: JSON.parse(raw) });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  // POST /api/cards/:cardType/rollback/:v — restore working copy to that snapshot, record new version
  router.post("/:cardType/rollback/:v", async (req, res) => {
    try {
      const s = makeStorage();
      const { cardType, v } = req.params;
      const raw = await s.read(`${HISTORY_PREFIX}${cardType}/${v}.json`);
      const def = JSON.parse(raw) as CardDefinition;
      await s.write(`${UXCARDS_PREFIX}${cardType}.json`, JSON.stringify(def, null, 2));
      const newV = await appendVersion(s, cardType, def, "admin", `Rolled back to v${v}`);
      res.json({ ok: true, cardType, rolledBackTo: v, newVersion: newV });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
