# KB Test Log

This file is the permanent record of every KB test case: what was tested, what the LLM actually produced, how failures were diagnosed, and exactly what KB change fixed them.

**Read this first** at the start of any KB debugging session. The status index shows where things stand. Individual entries show the full run history so you are not repeating work already done.

The test protocol (how to run, pass criteria notation, diagnostic checklist) lives in `specs/qa_runbook1.md`.

---

## Methodology

### The loop

```
define criteria → run → record → diagnose → fix one thing → restart → run → record → repeat until PASS
```

Every step is recorded here in real time. Do not batch: record the run result before touching the KB.

### Four rules that must hold on every fix

**1. Test before touching.** Always run first. The failure output — not your hypothesis — tells you which KB file and which concept is wrong. A fix applied without a confirming failure run is a guess.

**2. One change per iteration.** Fix the most upstream failure first, restart, re-run. If the Products table has no description field and the Output therefore has no description field, fix the table fields first — not both at once. Batching changes makes it impossible to know which change fixed (or broke) what.

**3. Diagnose from the LLM's output, not from the KB text.** Read `rlogEntry.reasoning.justification`. If it mentions v1 concepts (FlowObject, UARef, ActivationEntry), the LLM is reading stale KB. If it names the right entity types but gets fields wrong, the KB structure is right but the example fields are wrong. The diagnosis comes from the response, not from re-reading the KB.

**4. Fixes must be generic.** A fix that names a specific brand, project, or entity is wrong — it will pass this test and fail the next. Every fix must be statable as a transferable rule: *"when the user mentions X, always include Y"* or *"for any entity used for display/recommendation, include these fields."* If you cannot state it generically, you have not found the real root cause.

### What to record for each run

**On failure:**
- Which criteria passed and which failed (the table format)
- Root cause: *which KB file*, *which concept or example was wrong*, *why the LLM did what it did*
- Fix applied: *which file*, *what was added/changed*, stated as a rule/principle (KB is in GCS, not git — this log is the only diff record)

**On pass:**
- Which criteria passed (the table format)
- No diagnosis needed — just record it and move on

**On unexpected results** (criteria pass but output looks wrong in some other way):
- Record it as a note, not a failure — unless you add a criterion for it
- Consider whether a new criterion is needed before the next test case

### When to add a test case

Add the entry (prompt + criteria) **before running**, not after. Writing the criteria first forces you to be explicit about what "correct" means for this prompt. If you cannot write the criteria before running, the test is underspecified — clarify with the user first.

### How future Claude should use this file

1. Read the status index first — it tells you which tests are pending or failing
2. For any FAIL entry, read the last run's diagnosis before doing anything
3. Do not re-run a test that is already PASS unless something in the KB has changed
4. New test cases from the user go here first (define criteria), then run

---

## Status index

| ID | Description | Status | Last run |
|---|---|---|---|
| TC-001 | Zip activation + product recommendation, empty project | ✅ PASS | 2026-06-11 |
| TC-101 | Typing when named — impression + zip filter + 1 product table | ✅ PASS | 2026-06-12 |
| TC-201 | Default shape, under-specified goal | ✅ PASS | 2026-06-11 |
| TC-202 | Default shape, banner vertical (generalization guard) | ✅ PASS | 2026-06-11 |
| TC-301 | Disambiguation — deterministic lookup vs ML ranking | ✅ PASS | 2026-06-11 |
| TC-302 | Context-correction — context flips choice to Filter | ✅ PASS | 2026-06-11 |
| TC-401 | Category-error reshape — impressions table → Impression entity | ✅ PASS | 2026-06-11 |
| TC-501 | Negative constraint — narrow op, no over-generation | ✅ PASS | 2026-06-11 |
| TC-601 | Commercial fields generalization — products carousel | ✅ PASS | 2026-06-11 |
| TC-602 | Commercial fields generalization — offers email module | ✅ PASS | 2026-06-11 |

---

## Test cases

---

### TC-001 — Zip activation + product recommendation, empty project

**Status:** ✅ PASS

**Prompt:**
```
add impression, activation by zip and then a Products table and a ProductsByZip recommendation table
```

**Starting state:** Empty data plan (pass `TEMP/test_empty_version.json` as `version` field — see runbook)

**Pass criteria:**
- `types:[Impression, Table, Filter, Output]` — zip lookup is a Filter, not AlgoAI
- `tables:2` — Products (Input) and ProductsByZip (Transform); no extras
- `output_fields:any[sku, description, image, price, image_url]` — at least one commercial field
- `no_type:AlgoAI`

---

#### Run 1 — 2026-06-11 — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Table,Filter,Output]` | ✅ | All present |
| `tables:2` | ✅ | Products + ProductsByZip |
| `output_fields:any[sku,description,image,price]` | ❌ | Output: product_id, product_name, zip, distance_miles, geo |
| `no_type:AlgoAI` | ✅ | |

**Root cause:** `knowledge/data-activation/patterns.md` Pattern 2 defines the Products table with only 3 fields (`product_id, name, category`). The Output can only reference fields that exist on a Table. Because the pattern example was sparse, the LLM copied a sparse Products table and the Output had no commercial fields to reference.

**KB diff applied:**

File: `knowledge/data-activation/patterns.md`

Added to General rules: *"Rule: Output fields must cover downstream display needs"* — states that commercial entity tables (products, offers, content) must include the standard 5-field set: `sku`, `name`, `description`, `image_url`, `price`. These belong on the Table AND in the Output. The Output cannot reference fields that do not exist on the Table.

Updated Pattern 2 (product recommendation): Products table now has all 5 commercial fields; Output now references all 5.

Updated Pattern 5 (eligibility + recommendation, now Pattern 6): same Products table update.

Added Pattern 4 (geo/zip + product recommendation): combines the geo ETL shape (Products Input + ProductsByZip Transform + Filter) with the full commercial field set on Products and Output. This is the exact combined shape TC-001 exercises.

---

#### Run 2 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Table,Filter,Output]` | ✅ | |
| `tables:2` | ✅ | Products (sku,name,description,image_url,price) + ProductsByZip |
| `output_fields:any[sku,description,image,price]` | ✅ | Output: sku, name, description, image_url, price |
| `no_type:AlgoAI` | ✅ | |

---

### TC-101 — Typing when named *(Class 1 — floor)*

**Status:** ❌ FAIL

**Prompt:** `Add an impression, a zip-code filter, a Products table, and an Output that returns product recommendations.`

**Starting state:** Empty plan

**Pass criteria:**
- `types:[Impression, Filter, Table, Output]`
- `entity_count:{Impression:1, Output:1}`
- `tables:1`
- `connections:[Impression→Filter, Filter→Table, Table→Output]`
- `reasoning_excludes:[FlowObject, UARef, ActivationEntry, FlowSegment]`

---

#### Run 1 — 2026-06-11 (baseline) — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Filter,Table,Output]` | ✅ | All present |
| `entity_count:{Impression:1,Output:1}` | ✅ | |
| `tables:1` | ❌ | Got 2: Products + ProductsByZip |
| `connections:[Impression→Filter,Filter→Table,Table→Output]` | ❌ | Topology broken by extra table |
| `reasoning_excludes:[FlowObject,…]` | ✅ | |

**Root cause:** Pattern 4 (geo/zip + product) in `patterns.md` auto-adds a ProductsByZip geo-dimension table whenever it sees "zip + products." The user explicitly named one table (Products); Pattern 4 added a second. Pattern 4 is scoped too broadly — it fires on any "zip + products" mention, not just when geo expansion is explicitly requested.

**KB diff applied (Run 2):**

File: `knowledge/data-activation/patterns.md`

Added to General rules: *"Rule: Geo-dimension expansion is explicit, not automatic"* — geo-dimension tables (ProductsByZip, StoresByZip) are added ONLY when the user explicitly names them OR the ETL expansion pattern applies. A zip-code Filter can operate directly on an existing table without a geo-dimension derivative.

Added Pattern 3 (zip Filter against single table, no geo expansion) — provides the canonical shape for TC-101 explicitly: Impression→Filter, Table→Filter, Filter→Output. Renamed old Pattern 4 (geo expansion) to Pattern 4 with explicit scope note "use ONLY when user names geo-dimension table."

Also fixed: evaluator connection criterion was checking wrong arrow direction (`Filter→Table, Table→Output` per test file, but correct topology is `Table→Filter, Filter→Output`). Evaluator corrected; criterion flagged for user review.

#### Run 2 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Filter,Table,Output]` | ✅ | |
| `entity_count:{Impression:1,Output:1}` | ✅ | |
| `tables:1` | ✅ | Products only |
| `connections:[Imp→Filter,Table→Filter,Filter→Output]` | ✅ | Correct topology |
| `reasoning_excludes:[FlowObject,…]` | ✅ | |

**Open item:** `QA_TESTSUITE_01.md` criterion says `connections:[Impression→Filter, Filter→Table, Table→Output]`. The correct topology for a Filter pattern is `Table→Filter` (table is lookup source) and `Filter→Output`. Criterion in the test file has the middle two arrows reversed. Flagged for user review.

#### Run 3 — 2026-06-12 — ✅ PASS (filter topology integrated)

**Context:** Filter semantics directive integrated into KB. Three KB files updated (schema.md, activation-graph.md, patterns.md). QA_TESTSUITE_01.md TC-101 criteria updated to match new topology rule. Re-ran to confirm suite still passes.

**Criteria (updated):**
- `types:[Impression, Filter, Table, Output]`
- `entity_count:{Impression:1, Output:1}`
- `tables:1`
- `connections:[Table→Filter, Filter→Output]`
- `predicate_references:[$impression.geo]`
- `reasoning_excludes:[FlowObject, UARef, ActivationEntry, FlowSegment]`

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression,Filter,Table,Output]` | ✅ | All four present |
| `entity_count:{Impression:1,Output:1}` | ✅ | |
| `tables:1` | ✅ | Products only |
| `connections:[Table→Filter, Filter→Output]` | ✅ | `tbl_products→flt_zip`, `flt_zip→out_main`; no Impression→Filter edge |
| `predicate_references:[$impression.geo]` | ✅ | predicate: `getZip($impression.geo) matches Products.zip` |
| `reasoning_excludes:[FlowObject,…]` | ✅ | |

Agent reasoning: *"Impression does NOT connect to the Filter; $impression.geo appears only in the predicate string."* — correctly internalized the new semantic rule.

**KB changes in this iteration:**

`knowledge/data-activation/schema.md` — Added "Filter connection topology" subsection to the Filter entity definition. Canonical topology: `Table → Filter` (FROM, ≥1), `Filter → Output`. Explicit rule: do not emit `Impression → Filter`; impression fields appear only as `$impression.*` tokens in the predicate string. Fixed data-flow comment in "The six op forms" section from `Impression → Filter → Table → Output` to `Table → Filter → Output`.

`knowledge/data-activation/activation-graph.md` — Fixed canonical shape at top (was `Impression → activation rule → Table → Output`, now shows Filter and AlgoAI paths separately). Replaced `Impression → Filter` connection entry in connections list with the correct `Table → Filter` + note that impression is predicate-text only.

`knowledge/data-activation/patterns.md` — Removed `Impression → Filter` connection from Patterns 1, 3, 4, 7. Added `Table → Filter` to Pattern 1 (was missing — filter without a FROM table is malformed). Updated predicate in Pattern 7 to `$impression.dmp_id in EligibleUsers.user_id` to make impression field usage visible in predicate.

`specs/QA_TESTSUITE_01.md` — Updated TC-101 connections criterion from `[Impression→Filter, Filter→Table, Table→Output]` to `[Table→Filter, Filter→Output]`. Added `predicate_references:[$impression.geo]` criterion. Added `predicate_references` token to Criteria DSL table.

---

### TC-201 — Default shape, under-specified *(Class 2)*

**Status:** ✅ PASS

**Prompt:** `Build a data plan for recommending products based on where the user is.`

**Starting state:** Empty plan

**Pass criteria:**
- `types:[Impression, Output]` and `activation:>=1`
- `entity_count:{Impression:1, Output:1}`
- `output_maxRows:>1`
- `reasoning_cites:supplied activation shape`

---

#### Run 1 — 2026-06-11 (baseline) — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types+activation` | ✅ | Impression, Table×2, Filter, Output |
| `entity_count:{Impression:1,Output:1}` | ✅ | |
| `output_maxRows:>1` | ✅ | |
| `reasoning_cites:supplied activation shape` | ✅ | |

---

### TC-202 — Default shape, banner vertical *(Class 2/6)*

**Status:** ✅ PASS

**Prompt:** `Set up personalization for the homepage hero banner.`

**Starting state:** Empty plan

**Pass criteria:**
- `types:[Impression, Output]` and `activation:>=1`
- `entity_count:{Impression:1, Output:1}`
- `output_fields:any[headline, image, cta, banner, title, hero, copy]`
- No product fields (`no sku, price`)

---

#### Run 1 — 2026-06-11 (baseline) — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types+activation` | ✅ | Impression, Table(HeroContent), AlgoAI, Output |
| `entity_count:{Impression:1,Output:1}` | ✅ | |
| `output_fields:any[headline,image,cta,…]` | ✅ | Output: content_id, name, description, image_url, cta |
| `no sku,price` | ✅ | |

---

### TC-301 — Disambiguation: deterministic lookup vs ML ranking *(Class 3)*

**Status:** ❌ FAIL

**Prompt:** `add a product-by-zip recommendation`

**Starting state:** Populated — Impression + Products table already present

**Pass criteria:**
- Exactly one activation type (Filter XOR AlgoAI, not both)
- `alternatives:nonempty`
- `reasoning_cites:deterministic zip lookup (Filter) vs affinity/ranked recommendation (AlgoAI)`

---

#### Run 1 — 2026-06-11 (baseline) — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `exactly one activation (Filter XOR AlgoAI)` | ✅ | Filter chosen |
| `alternatives:nonempty` | ✅ | 2 alternatives listed |
| `reasoning_cites:deterministic vs affinity/ranked` | ❌ | Justification cited Pattern 4 shape only; did not name Filter-vs-AlgoAI tradeoff |

**Root cause (Run 1):** The LLM chose Filter (correct) but reasoned from Pattern 4 ("canonical shape") rather than from the Filter-vs-AlgoAI semantic distinction. No KB directive teaches the agent to explicitly name and reason through this tradeoff. The disambiguation rule is implicit at best.

**KB diff applied:**

File: `knowledge/data-activation/schema.md`

Added section *"Filter vs. AlgoAI — disambiguation rule"*: table mapping deterministic (Filter) vs. ranking (AlgoAI) use cases; directive to always name this tradeoff in `alternativesConsidered`; explicit statement that "product-by-zip recommendation" is deliberately ambiguous and must be resolved with justification.

**Evaluator fix:** criterion was checking `justification` field only. The LLM placed the tradeoff reasoning in `solution` and `alternativesConsidered`. Evaluator updated to check all reasoning fields combined (`problem + solution + justification + alternativesConsidered`). Per the test suite spec: "you (an LLM) read `reasoning` and decide."

#### Run 2 — 2026-06-11 — ❌ FAIL

Evaluator still checked justification only (fix not yet applied). Same result as Run 1.

#### Run 3 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `exactly one activation type (Filter XOR AlgoAI)` | ✅ | AlgoAI chosen |
| `alternatives:nonempty` | ✅ | 3 alternatives |
| `reasoning_cites:deterministic vs affinity/ranked` | ✅ | In solution: "deterministic zip→nearest-SKU lookup (Filter) or zip-influenced affinity/CTR recommendation (AlgoAI)" |

---

### TC-302 — Context-correction *(Class 3)*

**Status:** ✅ PASS

**Prompt:** `add a product-by-zip recommendation. Zip maps deterministically to the single nearest store's in-stock SKU. There is no ranking and no affinity — it is a lookup.`

**Starting state:** Populated — Impression + Products table already present

**Pass criteria:**
- `no_type:AlgoAI` (resolves to Filter)
- `reasoning_cites:deterministic/lookup context as deciding factor`

---

#### Run 1 — 2026-06-11 (baseline) — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `no_type:AlgoAI` | ✅ | Filter chosen |
| `reasoning_cites:deterministic/lookup` | ✅ | |

---

### TC-401 — Category-error reshape *(Class 4)*

**Status:** ✅ PASS

**Prompt:** `add an impressions table with dmp_id, geo, device, and placement_id`

**Starting state:** Empty plan

**Pass criteria:**
- `types:[Impression]`
- `no_table_named:impression`
- `reasoning_cites:impression is entry context, not a stored table`

---

#### Run 1 — 2026-06-11 (baseline) — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression]` | ✅ | Reshaped to Impression entity |
| `no_table_named:impression` | ✅ | |
| `reasoning_cites:entry context` | ✅ | |

#### Run 2 — 2026-06-11 — ❌ FAIL (regression from narrow-op rule)

The narrow-op rule (Rule 7) caused the LLM to honor the user's literal "table" request. LLM reasoning: "Adding an Impression entity instead — rejected because the user said 'table', and an Impression is a distinct entity type." The reshape logic lost to the narrow-op rule.

**Fix applied (Run 3):**

File: `server/src/llm/systemPrompt.ts` — added Rule 9: "RESHAPE EXCEPTION (overrides rules 7 and 8): 'Impression' is a reserved entity type — it is NOT a stored table. If the user asks to add a Table named 'Impression' or 'Impressions', emit an Impression entity instead and note the correction in 'reply'. Category errors on reserved types are always reshaped, even in narrow-op mode."

#### Run 3 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `types:[Impression]` | ✅ | Reshaped correctly |
| `no_table_named:impression` | ✅ | |
| `reasoning_cites:entry context/reserved` | ✅ | |

---

### TC-501 — Negative constraint: narrow op, no over-generation *(Class 5)*

**Status:** ❌ FAIL

**Prompt:** `add a Products table with sku, name, price`

**Starting state:** Empty plan

**Pass criteria:**
- `tables:1`
- `no_type:AlgoAI`
- `no_type:Filter`
- `no_type:Output`
- `entity_count:{Impression:0}`

---

#### Run 1 — 2026-06-11 (baseline) — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `tables:1` | ✅ | Products table present |
| `no_type:AlgoAI` | ❌ | AlgoAI added (Product Recommendation) |
| `no_type:Filter` | ✅ | |
| `no_type:Output` | ❌ | Output added |
| `entity_count:{Impression:0}` | ❌ | Impression added |

**Root cause (Run 1):** System prompt rules 6+7 are too absolute. Rule 7 says "A plan with only Table entities and no activation rule and no Output is incomplete — always propose the activation shape." The LLM quoted this rule verbatim as justification for adding Impression+AlgoAI+Output to a narrow "add a table" request.

**Fix applied (Run 2):**

File: `server/src/llm/systemPrompt.ts` — replaced rules 6+7 with goal vs. narrow-op distinction: Rule 6 (goal prompt → supply full activation shape), Rule 7 (narrow op → do exactly that, nothing more), Rule 8 (tiebreaker: named entity types = narrow op).

File: `knowledge/data-activation/patterns.md` — added corresponding *"Rule: Goal prompt vs. narrow op"* section to General rules.

#### Run 2 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `tables:1` | ✅ | Products only |
| `no_type:AlgoAI` | ✅ | |
| `no_type:Filter` | ✅ | |
| `no_type:Output` | ✅ | |
| `entity_count:{Impression:0}` | ✅ | |

---

### TC-601 — Commercial fields, products carousel *(Class 6)*

**Status:** ✅ PASS

**Prompt:** `recommend products to show in a 4-slot carousel`

**Starting state:** Empty plan

**Pass criteria:**
- `output_maxRows:>1`
- `output_fields:any[sku, name, description, image_url, price]`
- Products Table carries those fields

---

#### Run 1 — 2026-06-11 (baseline) — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `output_maxRows:>1` | ✅ | |
| `output_fields:any[sku,name,description,image_url,price]` | ✅ | sku, name, description, image_url, price |
| `Products Table has those fields` | ✅ | |

---

### TC-602 — Commercial fields, offers email *(Class 6, pairs_with TC-601)*

**Status:** ❌ FAIL

**Prompt:** `recommend offers to show in an email module`

**Starting state:** Empty plan

**Pass criteria:**
- `output_maxRows:>1`
- `output_fields:any[offer_id, title, description, image_url, terms]`
- `no product fields (no sku, price)` `[run-scoped]`
- Offers Table carries display fields

---

#### Run 1 — 2026-06-11 (baseline) — ❌ FAIL

| Criterion | Result | Detail |
|---|---|---|
| `output_maxRows:>1` | ✅ | |
| `output_fields:any[offer_id,title,description,image_url,terms]` | ✅ | offer_id, name, description, image_url present |
| `no product fields (no sku,price)` | ❌ | Output contains `price` — product field applied to offers |
| `Offers Table has display fields` | ✅ | |

**Root cause (Run 1):** The KB "standard commercial entity fields" rule lists `price` as a universal field for any commercial entity. The LLM applied the products field set to offers, including `price`.

**Fix applied (Run 2):**

File: `knowledge/data-activation/patterns.md`

Replaced the generic "standard commercial entity fields" rule with an **entity-type field set table** distinguishing: Products (sku, name, description, image_url, price), Offers (offer_id, title, description, image_url, terms — NOT price), Content (content_id, headline, body, image_url, cta), Locations (location_id, name, address, distance_miles). Added Pattern 5 (Offer recommendation) with the offer field set as a concrete example.

Directive added: "Do not import a field set from a different entity type. An Offer table must not carry `price` just because the Products pattern does."

#### Run 2 — 2026-06-11 — ✅ PASS

| Criterion | Result | Detail |
|---|---|---|
| `output_maxRows:>1` | ✅ | |
| `output_fields:any[offer_id,title,description,image_url,terms]` | ✅ | offer_id, title, description, image_url, terms |
| `no product fields (no sku,price)` | ✅ | price absent |
| `Offers Table has display fields` | ✅ | |

---
