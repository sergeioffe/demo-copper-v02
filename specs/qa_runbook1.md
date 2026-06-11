# QA Runbook — KB Test Loop

This is the standing protocol for running and recording KB test cases.
The fix procedure lives in `specs/kb_rewrite_todo.md`.

---

## How to run a test

```
1. Start server:     node server/dist/index.js
2. Get project id:   GET http://localhost:3001/api/projects
3. Run test:         POST http://localhost:3001/api/debug/project/:id/submit
4. Inspect:          ops[], rlogEntry.reasoning, diagnostics.systemPromptLength
5. Fix KB if needed: PUT http://localhost:3001/api/admin/file  (one file at a time)
6. Restart server:   kill old pid, node server/dist/index.js
7. Re-run from 3
```

For a **new project / empty plan** test, pass `version` in the request body:

```json
{
  "message": "your prompt here",
  "exchanges": [],
  "version": {
    "id": "test-new", "name": "Test Project", "version": 1,
    "parentVersion": null, "authoredBy": "system",
    "createdAt": "2026-06-11T00:00:00.000Z",
    "context": { "contextFiles": [], "exchanges": [] },
    "plans": {
      "data":    { "document": "", "model": { "entities": {}, "connections": [] } },
      "media":   { "document": "", "model": { "entities": {}, "connections": [] } },
      "creative":{ "document": "", "model": null }
    }
  }
}
```

---

## Pass criteria notation

Each test defines criteria as a checklist. A test PASSES only when every item is checked.

| Symbol | Meaning |
|---|---|
| `types:[X,Y,Z]` | ops must include addEntity for each listed type |
| `tables:N` | exactly N Table entities emitted |
| `output_fields:any[X,Y,Z]` | Output.fields must contain AT LEAST ONE of the listed names (case-insensitive substring match) |
| `output_fields:all[X,Y,Z]` | Output.fields must contain ALL of the listed names |
| `no_type:X` | no addEntity of type X should appear |

---

## Diagnostic checklist (when a test fails)

1. `diagnostics.systemPromptLength` — if < 5000, KB probably didn't load. Restart server.
2. `ops` is empty — LLM replied but produced no changes. Check `exchange.text` for refusal.
3. Wrong entity types — check `rlogEntry.reasoning.justification`. Is the LLM referencing KB concepts or v1 FlowObject/UARef language?
4. Correct types but wrong fields — the KB pattern example has the wrong fields. Fix the pattern, not the schema.
5. Output fields missing — check if the referenced Table entity even has those fields. The Output can only reference fields that exist on Table entities or $impression.* attributes.
6. `alternativesConsidered` is empty — LLM jumped straight to answer; prompt may be too easy or KB rules too prescriptive.

---

## Test log

Record every test run here. **Do not delete failures** — the failure record is how we know what the KB fixed.

---

### TC-001 — Zip activation with product recommendation, empty project

**Status:** PASS ✅

**Prompt:**
```
add impression, activation by zip and then a Products table and a ProductsByZip recommendation table
```

**Starting state:** Empty data plan (no existing entities)

**Pass criteria:**
- `types:[Impression, Table, Filter, Output]`
- `tables:2` (Products and ProductsByZip)
- `output_fields:any[sku, description, image, price, image_url]`
- `no_type:AlgoAI` (zip lookup is a Filter, not a recommendation engine)

**Run command:**
```
POST http://localhost:3001/api/debug/project/luminary-health-q3-2025/submit
body: TEMP/test_empty_version.json  (see above for format)
```

#### Run 1 — 2026-06-11

| Check | Result | Notes |
|---|---|---|
| types:[Impression,Table,Filter,Output] | PASS | Impression, Table×2, Filter, Output all present |
| tables:2 | PASS | Products + ProductsByZip |
| output_fields:any[sku,description,image,price] | FAIL | Output has: product_id, product_name, zip, distance_miles, geo — no description/image/price |
| no_type:AlgoAI | PASS | Only Filter used |

**Root cause:** `patterns.md` Pattern 2 (product recommendation) defines Products table with only 3 fields (product_id, name, category). The Output can only reference fields that exist on the Table. Pattern 2 needs richer product fields.

**Fix:** Added `Rule: Output fields must cover downstream display needs` to `patterns.md` General rules section. Updated Pattern 2 (product rec) and Pattern 6 (eligibility+rec) with full commercial field set (sku, name, description, image_url, price) on the Products table and matching Output fields. Added Pattern 4 (geo/zip + product) combining the geo ETL shape with the commercial field set.

#### Run 2 — 2026-06-11

| Check | Result | Notes |
|---|---|---|
| types:[Impression,Table,Filter,Output] | PASS | All present |
| tables:2 | PASS | Products (sku,name,description,image_url,price) + ProductsByZip |
| output_fields:any[sku,description,image,price] | PASS | Output: sku, name, description, image_url, price |
| no_type:AlgoAI | PASS | Filter used for zip lookup |

**Status: PASS** ✅

---
