# KB Fix — Standing Procedure and Current Work Queue

This is the standing procedure for diagnosing and fixing KB-driven LLM behavior bugs.
The test protocol lives in `specs/qa_runbook1.md` — read it first. This document records
decisions, the current bug queue, and the precise fix spec for each.

---

## How the KB works (read this before touching anything)

- **GCS is the sole source of truth for KB content.** There is no git copy. Git does not
  affect what the running server sees.
- **KB is loaded once at server startup** into memory and passed to every chat/debug call.
  Any GCS write via `PUT /api/admin/file` is invisible to the running server until restart.
- **Workflow for any KB fix:** write to GCS → restart server → verify with debug endpoint →
  commit code changes (contracts, systemPrompt) to git → push.
- **KB lives at** `knowledge/data-activation/` and `knowledge/media-plan/` in the GCS bucket.
  Read files via `GET /api/admin/file?path=knowledge/...`, write via `PUT /api/admin/file`.
- **The system prompt** (`server/src/llm/systemPrompt.ts`) injects the full KB verbatim as
  `## DOMAIN KNOWLEDGE` and then lists entity types and rules. Both must stay in sync.
- **Local server:** `node server/dist/index.js` from `demo.v02/` (reads `.env` for GCS creds).
  Build first if code changed: `npx tsc -b server/tsconfig.json`.

---

## Architecture decisions (settled — do not re-open)

**Every entity that appears as a node in the UI graph IS an entity in the KB.**
The entity type list in the contracts (`packages/contracts/src/index.ts`) is the canonical
set. The KB must describe each type and when to use it. The system prompt entity reference
must match the contracts.

**Impression IS a data-plan entity type.** It must be added to contracts, the system prompt,
and the KB. It represents the runtime entry context — the inbound signal the plan activates
on (dmp_id, geo, device, placement_id). It is NOT a stored table. There is exactly one per
data plan.

**Activation rule = Filter or AlgoAI entity.** Both are already in contracts. A Filter is a
predicate gate (eligibility, zip-based lookup). An AlgoAI is a recommendation/ML step (1:N,
produces ranked candidates). Together these ARE the activation rules. The KB must make this
explicit.

**Output IS a data-plan entity type** (already in contracts). It is the goal — the
array-shaped result delivered back at activation time. Every data plan must have one. The KB
must say so as a directive, not a description.

**GCS is master. No git copy of KB.** When Railway redeploys from git, the `knowledge/`
prefix in GCS is not re-seeded — only `project_data/` is seeded on first startup. Changes
to KB files in git are cosmetic only and will be ignored at runtime.

---

## Current entity type reference (ground truth)

From `packages/contracts/src/index.ts` — `DataPlanEntity` union:

| Type | Key fields | Notes |
|---|---|---|
| `Impression` | `name`, `fields[]` (dmp_id, geo, device, placement_id) | **MISSING — must be added** |
| `Table` | `name`, `tableType` (Input\|Transform\|Standard), `fields[]` | Already in contracts |
| `Import` | `name`, `source`, `frequency`, `syncMode` | Already in contracts |
| `Filter` | `name`, `predicate` | Already in contracts |
| `AlgoAI` | `name`, `optimization`, `promoted` | Already in contracts |
| `Output` | `name`, `maxRows`, `fields[]` (each with `sourceFieldId`) | Already in contracts |

---

## Bug queue

### Bug #1 — Data plan defaults to stored tables; no activation rule, no Output

**Status:** Diagnosis complete. Fix not started.

**Symptom:** Sending "add impression, activation by zip, product tables and
product-by-zip recommendation" produces only Table addEntity ops. No Filter or AlgoAI op.
No Output op. The plan is a catalog of data sources, not an activating plan.

**Root cause:** The entire `knowledge/data-activation/` KB is written for the v1 data model
(Tables, FlowObjects, FlowSegments, UARef objects, ActivationEntry). The v2 system uses
entity ops. The KB actively misleads — `patterns.md` rule 1 says "return the complete model"
which directly contradicts the system prompt's ops format. The LLM reads detailed v1
patterns and produces v1-shaped output, ignoring the sparse v2 entity reference.

**Specific problems:**
1. `Impression` entity type does not exist in contracts or system prompt — LLM has no op to emit
2. KB teaches FlowObjects/UARefs/ActivationEntry — none are valid v2 ops
3. `patterns.md` general rules say "return the complete model JSON" — wrong format
4. `data-plan-document.md` example shows Impressions as an `[Input]` table (stored, with PK) — wrong model
5. No directive anywhere saying "default to Impression + activation rule + Output"
6. Output entity exists in contracts but KB never mentions it

**Fix — ordered steps:**

**Step 1: Add ImpressionEntity to contracts**

File: `packages/contracts/src/index.ts`

Add after `OutputEntity`:
```typescript
export interface ImpressionEntity {
  type: "Impression";
  name: string;
  fields: Field[]; // the inbound context attributes: dmp_id, geo, device, placement_id
}
```

Add `ImpressionEntity` to the `DataPlanEntity` union:
```typescript
export type DataPlanEntity =
  | ImpressionEntity
  | TableEntity
  | ImportEntity
  | FilterEntity
  | AlgoAIEntity
  | OutputEntity;
```

Rebuild contracts: `npx tsc -b packages/contracts/tsconfig.json`

**Step 2: Update system prompt entity reference**

File: `server/src/llm/systemPrompt.ts`

Replace the data plan entity section with:
```
Data plan entity types and key fields:
  Impression — the runtime entry context. One per plan. Fields: dmp_id, geo, device,
               placement_id. NOT a stored table — it is the inbound signal the plan
               activates on.
  Table      — stored data the plan works with (tableType: Input|Transform|Standard).
               Input = ETL'd read-only source. Transform = derived from other tables.
               Standard = anything else.
  Import     — ETL descriptor for a Table: source, frequency, syncMode.
  Filter     — activation rule: predicate gate (e.g. "by zip", "by segment",
               "eligibility check"). Maps impression context to a table lookup.
  AlgoAI     — activation rule: algorithmic/ML recommendation (1:N, produces ranked
               candidates). Fields: optimization (CTR|CVR|Route), promoted (boolean).
  Output     — the plan's goal. maxRows (1=scalar, >1=recommendations). fields[] each
               have a sourceFieldId pointing to a Table field or $impression.* attribute.
```

Add two new rules to the RULES section:
```
6. Every data plan must include at least one Output entity. If a request is plausible for
   output (even loosely), propose Output fields. Err on the side of inclusion.
7. The default data plan shape is: Impression → Filter or AlgoAI (activation rule) →
   Table → Output. A plan with only Table entities and no activation rule and no Output
   is incomplete — always propose the activation shape.
```

Rebuild server: `npx tsc -b server/tsconfig.json`

**Step 3: Rewrite `knowledge/data-activation/` in GCS**

Write new content to each file via `PUT /api/admin/file`. Use the content below.

**`knowledge/data-activation/schema.md`** — replace entirely with v2 entity + ops reference.
Must cover: all 6 entity types with fields, the 6 op forms (addEntity/addConnection/etc.),
OutputField.sourceFieldId format, $impression.* reserved attribute names.

**`knowledge/data-activation/patterns.md`** — replace entirely with v2 patterns.
Each pattern must produce addEntity/addConnection ops, NOT a full graph JSON.
Must include:
- Pattern: impression + activation rule + output (the default shape)
- Pattern: product recommendation (Impression → AlgoAI → Table → Output)
- Pattern: geo/zip activation (Impression → Filter[getZip] → Table → Output)
- Pattern: adding Output fields (sourceFieldId format, when to use $impression.*)
- Pattern: combining Filter + AlgoAI (eligibility gate then recommendation)
Remove ALL FlowObject/FlowSegment/UARef/ActivationEntry language.
Replace "Return the complete model" rule with "Produce an ops array."

**`knowledge/data-activation/activation-graph.md`** — strip or replace.
The v1 domain overview is actively harmful. Replace with a short v2 orientation:
- What a data plan is (entry → activation → output)
- The 6 entity types and their roles
- Connections carry topology (Impression → Filter → Table → Output flow)
- $impression.* reserved attributes

**`knowledge/data-activation/data-plan-document.md`** — fix the example.
The current example shows `### Impressions [Input]` as a stored table with `impression_id`
PK. This must be changed to show Impression as a distinct entity type, not a Table.
The document format guide itself is useful — keep it, just fix the example.

**`knowledge/data-activation/etl-patterns.md`** — keep, translate ops only.
The geo-expansion logic (ProductsByZip, StoresByZip) is still valid. The only change:
replace the v1 addEtlEdge op example with addEntity + addConnection ops.

**Step 4: Restart server, verify KB loaded**

After all GCS writes:
```
node server/dist/index.js
```
Check startup log for `[kb] ✅ Loaded N KB files from GCS`.
Then read back one changed file to confirm:
```
GET /api/admin/file?path=knowledge/data-activation/patterns.md
```
Check `diagnostics.systemPromptLength` on first debug submit — should be longer than
before (new KB is more verbose than the old one in the right areas).

**Step 5: Run the Phase 4 test (per qa_runbook1.md)**

Test message:
```json
POST /api/debug/project/luminary-health-q3-2025/submit
{ "message": "add impression, activation by zip, product tables and product-by-zip recommendation", "exchanges": [], "version": null }
```

PASS: ops include `addEntity` of type `Impression`, at least one `addEntity` of type
`Filter` or `AlgoAI`, and at least one `addEntity` of type `Output`.

PARTIAL: activation rule and Output appear but Impression is still emitted as type `Table`
(means the contracts/systemPrompt change didn't take — check the build).

FAIL: ops still only contain Table entities — check `diagnostics.systemPromptLength`
before vs. after; if unchanged, the GCS write didn't land or server wasn't restarted.

**Step 6: Commit and push**

Stage: `packages/contracts/src/index.ts`, `server/src/llm/systemPrompt.ts`
Note: KB files live in GCS only — do NOT commit them to git.

---

## How to start on a fresh machine

```
git pull
npm install          (from demo.v02/)
npx tsc -b           (build all packages)
node server/dist/index.js   (reads .env for GCS creds)
```

Verify: `GET http://localhost:3001/health` → `{"ok":true,"version":"v2"}`
Get project id: `GET http://localhost:3001/api/projects` → use the `id` field
Debug endpoint: `POST http://localhost:3001/api/debug/project/:id/submit`
KB read: `GET http://localhost:3001/api/admin/file?path=knowledge/<folder>/<file>`
KB write: `PUT http://localhost:3001/api/admin/file` `{ "path": "...", "content": "..." }`
Full endpoint reference: `specs/debug_readme.md`

Pick up at Bug #1 Step 1 above.
