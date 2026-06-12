# QA_TESTSUITE_01 — Data-Activation KB Behavior Suite

**For:** the Claude Code instance that runs the debug endpoint and edits the KB.
**Purpose:** define correct mutation-agent behavior for the data-activation KB, as runnable test cases with expected results. You execute these against the live endpoint, diagnose failures, fix the KB, and re-run until PASS. This file is the source of truth for *what correct looks like*; you supply the live access.

You have the access; this file has the business domain you don't. Read sections 1–6 before running anything. Don't skip to the cases.

---

## 1. Scope boundary — what this suite does and does NOT test

This harness exercises exactly one thing: **given a chat message + the loaded KB, does the mutation agent emit correct `ops` and reason well.** That is the entire surface. The debug endpoint returns `ops`, `rlogEntry.reasoning`, and `diagnostics` — nothing else is observable here.

**In scope:** entity typing, entity counts, connection topology, Output field sourcing, reasoning quality, and whether the KB *defaults* to the right shape when under-specified.

**Out of scope — do NOT write cases for these (they need separate harnesses or don't exist yet):**
- Consistency engine / propagation ("does the pond settle") — not observable via this endpoint.
- Doc↔model bidirectional sync — separate worker, separate test.
- Versioning / accept-reject / HEAD placement — not exercised by a single submit.
- Media plan and creative plan KBs — different folders, parked. This suite is `knowledge/data-activation/` only.
- The **R** in CoPPER (Reality, N-output truth). The Project Model is deliberately simplified to 1 Output; do not test N-output behavior.

If a proposed case can't be decided from `ops` + `reasoning` + `diagnostics`, it doesn't belong in this file.

---

## 2. The layering chain (KB authoring law)

Specificity increases **monotonically** along this chain:

```
STORAGE  →  UI GRAPH  →  KB  →  CUSTOMER-SPECIFIC KB
generic     draws       business    this customer's vertical,
one op      distinct    semantics,  brands, field sets
shape       objects     MORE        (allowed to be specific)
            per type    specific
                        than the UI
```

Consequences that govern both fixes and criteria:
- **Storage is generic.** One op shape (`addEntity{type,…}`) holds everything. The KB is NOT a storage-schema mirror.
- **The KB is more specific than the UI draws.** The UI renders one "Filter" box; the KB distinguishes a zip-lookup filter from an eligibility gate from a segment filter — same rendering, finer business meaning. That *when-to-use* distinction is the KB's actual content. A KB that just re-lists the 6 UI types has only echoed the UI tier and done no work.
- **"Generic / no brand names" is a law of the BASE KB tier only.** The customer-specific tier is *supposed* to name brands and verticals — that's its job. When you fix the KB to pass these tests, fixes land in the base tier (`knowledge/data-activation/`) and must be generic. Customer-tier specificity is a future layer, parked.

The original Bug #1 was a layer conflation: the old KB described Impression at *storage* granularity (rows in a table), so the agent emitted a Table. Lift the KB to business granularity → Impression is its own object.

---

## 3. Ratified business decisions (canonical for this run)

These are settled for the purpose of this suite. (Per Serge: treat as canonical *for this test run*; they will be revisited later. Tags below mark which criteria lean on a not-yet-product-ratified judgment.)

**The model:** `Impression Context → Activation Graph → Output`. A data plan answers: *given this impression context, what do we output?*

**Cardinality (hard):**
- Exactly **1 Impression** per plan — the entry context. Not a stored table.
- **1 or more activation rules**, typically 1. (Activation rule = a `Filter` or an `AlgoAI`.)
- Exactly **1 Output** per plan. Recommendations returning many candidates are expressed as **one Output with `maxRows > 1`**, never as multiple Output entities.

**Entity semantics (this is the business layer the KB must carry):**

| Type | Business meaning | Key fields |
|---|---|---|
| `Impression` | The runtime entry context — the inbound signal the plan activates on. One per plan. NOT stored. | dmp_id, geo, device, placement_id |
| `Table` | Stored data the plan works with. `tableType`: **Input** (ETL'd read-only source), **Transform** (derived from other tables), **Standard** (other). | name, tableType, fields[] |
| `Import` | ETL descriptor for a Table. | source, frequency, syncMode |
| `Filter` | Activation rule — a **deterministic predicate/lookup gate**. Sub-meanings the KB must distinguish: zip→nearest-SKU lookup, eligibility check, segment gate. Same UI box, different business intent. | name, predicate |
| `AlgoAI` | Activation rule — an **algorithmic/ML recommendation** (1:N, ranked candidates, affinity/optimization driven). | optimization (CTR\|CVR\|Route), promoted |
| `Output` | The plan's goal. Array-shaped, capped by `maxRows`. Each field has a `sourceFieldId` pointing at a Table field or a `$impression.*` reserved attribute. | maxRows, fields[] (each sourceFieldId) |

**The Filter-vs-AlgoAI distinction is load-bearing and is itself a test target** (class 3): a *deterministic* zip lookup is a Filter; an *affinity-ranked* recommendation is an AlgoAI. Which one a vague prompt should default to is **OPEN** — not ratified — so cases that hinge on it assert *reasoning quality*, not a forced choice.

---

## 4. Methodology — the eight laws

Laws 1–4 are the original four (keep verbatim). Laws 5–8 are the additions the PoC proved necessary.

1. **Test before touching.** Run first. The failure output — not your hypothesis — names the file and concept that's wrong. A fix without a confirming failure run is a guess.
2. **One change per iteration.** Fix the most-upstream failure, restart, re-run. Batching hides which change fixed or broke what.
3. **Diagnose from the LLM's output, not the KB text.** Read `rlogEntry.reasoning.justification`. v1 vocabulary (FlowObject, UARef, ActivationEntry, FlowSegment) means stale KB; right types + wrong fields means the example fields are wrong, not the schema.
4. **Fixes must be generic** (base tier). If a fix names a brand/project/entity, it'll pass this test and fail the next. State every fix as a transferable rule or you haven't found the root cause.
5. **Prompt fidelity.** Criteria adapt to the prompt; never the prompt to the criteria. Use the user's real phrasing or an honestly vague prompt. Do not add words ("recommendation *table*") that steer the agent toward the expected op. Massaging the prompt is editing the test until it passes.
6. **Held-out generalization.** A fix is "generic" only when it passes a sibling case it was NOT authored against. Field/shape fixes ship as a **paired vertical** (products *and* offers). Both pass, or the rule memorized rather than generalized.
7. **Behavior-class coverage.** A "defaults to / errs toward" claim is only proven by an **under-specified** prompt that does *not* name the thing. Typed-when-named cases are necessary but never sufficient for a default-behavior claim.
8. **Ratified-only criteria** (run-scoped here). Encode only decisions made. Where a criterion rests on an open call, tag it `[run-scoped]` so the next revisit knows what to question instead of inheriting it as fact.

---

## 5. Criteria DSL

| Token | Meaning |
|---|---|
| `types:[X,Y,Z]` | ops must include an `addEntity` for each listed type |
| `entity_count:{X:N}` | exactly N entities of type X |
| `tables:N` | exactly N `Table` entities |
| `activation:>=1` | at least one entity of type `Filter` OR `AlgoAI` |
| `connections:[A→B,…]` | these directed connections must exist (activation topology) |
| `predicate_references:[…]` | the Filter entity's `predicate` field must contain each listed token (e.g. `$impression.geo`); checked in the predicate string, NOT as a connection edge |
| `output_fields:any[…]` | Output.fields contains AT LEAST ONE listed name (case-insensitive substring) |
| `output_fields:all[…]` | Output.fields contains ALL listed names |
| `output_maxRows:>1` | the single Output has maxRows > 1 (recommendation shape) |
| `no_type:X` | no `addEntity` of type X appears |
| `no_table_named:X` | no Table whose name matches X |
| `reasoning_excludes:[…]` | justification must NOT contain these (stale-KB guard; negative only — presence of a *word* is never a pass) |
| `alternatives:nonempty` | `reasoning.alternativesConsidered` is non-empty |
| `reasoning_cites:"…"` | justification must reference this factor (judgment call — you read it, you decide) |
| `pairs_with:TC-id` | Law 6 twin; both must pass for either to count |

---

## 6. Execution protocol

KB writes are **invisible to the running server until restart** (GCS is loaded once at startup). So the loop is:

```
run all cases → record baseline failure map → fix MOST-UPSTREAM failure (one file)
→ restart server → re-run → record → repeat until all PASS
```

- **Seeding starting state.** Empty plan: pass the empty `version` payload (per `qa_runbook1.md`). Populated plan: pass a `version` payload pre-loaded with the stated entities, or use an existing project that has them.
- **After every GCS write**, restart and confirm `[kb] ✅ Loaded N KB files`, then re-read one changed file via `GET /api/admin/file` to confirm the write landed. Check `diagnostics.systemPromptLength` moved.
- **Record every run in `test_log.md`** before touching the KB again (the log is the only KB diff record — GCS is master, not git).
- **Upstream-first:** if Output fields are wrong because the Table lacks them, fix the Table fields first. Don't fix two layers in one iteration.

---

## 7. Test taxonomy

Six classes; the suite covers all six so coverage is a checklist, not a vibe.

1. **Typing-when-named** — entities named explicitly; assert types/counts/topology. (Floor.)
2. **Default-shape** — under-specified goal; assert the KB *supplies* impression→activation→output unbidden. (Law 7; the Bug #1 proof.)
3. **Disambiguation** — two valid modelings; assert a defensible pick + that added context flips it. (Reasoning, not just ops.)
4. **Category-error reshape** — user mis-types a concept; assert reshape, not obedience.
5. **Negative constraint** — explicit narrow op; assert no over-generation.
6. **Generalization pair** — Law 6 twins across two verticals.

---

## 8. Test cases

> Use the real prompts as written (Law 5). Where a criterion is a judgment call, you (an LLM) read `reasoning` and decide — that's expected.

---

### TC-101 — Typing when named *(Class 1 — floor)*

**Prompt:** `Add an impression, a zip-code filter, a Products table, and an Output that returns product recommendations.`
**Start:** empty plan.

**Criteria**
- `types:[Impression, Filter, Table, Output]`
- `entity_count:{Impression:1, Output:1}`
- `tables:1`
- `connections:[Table→Filter, Filter→Output]`
- `predicate_references:[$impression.geo]`
- `reasoning_excludes:[FlowObject, UARef, ActivationEntry, FlowSegment]`

**Why:** the floor. If this fails, the v2 entity reference itself isn't reaching the agent — fix that before anything else.

---

### TC-201 — Default shape, under-specified *(Class 2 — THE Bug #1 proof)*

**Prompt:** `Build a data plan for recommending products based on where the user is.`
**Start:** empty plan.
**Note:** names a *goal*, names **no** entity types. Does not say impression, filter, or output.

**Criteria**
- `types:[Impression, Output]` **and** `activation:>=1`
- `entity_count:{Impression:1, Output:1}`
- `output_maxRows:>1`
- `reasoning_cites:"supplied the activation shape / output as the goal"` — the agent should justify *adding* the shape, not apologize for the user not asking.

**Why:** this is the behavior Serge actually asked for and the PoC never tested — that the KB *errs toward* impression→activation→output when the user doesn't enumerate it. If TC-101 passes but this fails, Bug #1 is **not** fixed. This case cannot be satisfied by a richer example; only by a directive default in the KB.

---

### TC-202 — Default shape, different vertical *(Class 2 / 6 — pairs_with: TC-201)*

**Prompt:** `Set up personalization for the homepage hero banner.`
**Start:** empty plan.
**Note:** content/display vertical, not products. Still under-specified.

**Criteria**
- `types:[Impression, Output]` **and** `activation:>=1`
- `entity_count:{Impression:1, Output:1}`
- Output fields appropriate to a banner (e.g. headline / image / cta), **not** product fields hallucinated from a memorized example. `[run-scoped field names]`

**Why:** proves the default-shape rule is a *generic KB law*, not memorized to "products." If TC-201 passes and TC-202 fails, the fix memorized the products pattern (Law 6).

---

### TC-301 — Disambiguation: deterministic lookup vs ML ranking *(Class 3)*

**Prompt (real, ambiguous):** `add a product-by-zip recommendation`
**Start:** populated — Impression + Products table already present.

**Criteria**
- exactly one activation rule chosen — `Filter` XOR `AlgoAI`, not both hedged
- `alternatives:nonempty`
- `reasoning_cites:"deterministic zip→nearest-SKU lookup (Filter) vs affinity/ranked recommendation (AlgoAI)"` — the tradeoff must be named.
- **We do NOT assert which type wins** — that default is OPEN. `[run-scoped]`

**Why:** tests *reasoning*, not ops. Either modeling can pass **if justified**. Catches the agent hedging (emitting both) or picking blindly (empty alternatives). The original agent chose AlgoAI off "affinity signals" — defensible; this case verifies it *reasoned* there.

---

### TC-302 — Replay / context-correction *(Class 3 — pairs_with: TC-301)*

**Prompt:** TC-301 prompt **plus added context:** `Zip maps deterministically to the single nearest store's in-stock SKU. There is no ranking and no affinity — it is a lookup.`
**Start:** same as TC-301.

**Criteria**
- resolves to `Filter` (deterministic) — `no_type:AlgoAI`
- `reasoning_cites:"the added context (deterministic lookup, no ranking) as the deciding factor"`

**Why:** the heart of the system thesis — adding **context** flips the modeling choice (replay-as-context-correction). TC-301 and TC-302 share a prompt and differ only by context; the choice must move. If it doesn't, the agent isn't actually using context to disambiguate.

---

### TC-401 — Category-error reshape *(Class 4 — the original bug, as a guard)*

**Prompt:** `add an impressions table with dmp_id, geo, device, and placement_id`
**Start:** empty plan.
**Note:** user mis-types the entry context as a Table.

**Criteria**
- `types:[Impression]` (emits an Impression entity)
- `no_table_named:impression` / `no_table_named:impressions`
- `reasoning_cites:"impression is the entry context, not a stored table"`

**Why:** the exact original failure, inverted into a guard. The agent must *reshape* the mis-typed concept, not obey it. Tests the §2 principle directly: "impression" is a reserved business concept, not a generic table name. If the agent builds an Impressions table here, the KB is still at storage granularity.

---

### TC-501 — Negative constraint: narrow op, no over-generation *(Class 5 — counterweight to TC-201)*

**Prompt:** `add a Products table with sku, name, price`
**Start:** empty plan.
**Note:** explicit narrow request — a specific op, NOT a goal.

**Criteria**
- `tables:1`
- `no_type:AlgoAI`, `no_type:Filter`, `no_type:Output`
- `entity_count:{Impression:0}` — do not auto-add the entry context here.

**Why:** bounds the default-shape behavior. Erring toward impression→activation→output is for **goal** prompts (TC-201), **not** for explicit narrow CRUD. "Goal → supply the shape; specific op → do exactly that, nothing more" is the business rule under test. Without this counterweight, a KB tuned to pass TC-201 will over-generate on every request.

---

### TC-601 / TC-602 — Commercial-fields generalization pair *(Class 6 — catches the PoC's circular fix)*

**TC-601 Prompt:** `recommend products to show in a 4-slot carousel`
**Criteria:** `output_maxRows:>1`; `output_fields:any[sku, name, description, image_url, price]`; the referenced Products Table actually carries those fields (Output can only source fields that exist).

**TC-602 Prompt:** `recommend offers to show in an email module` *(offers, not products)*
**Criteria:** `output_maxRows:>1`; `output_fields:any[offer_id, title, description, image_url, terms]` `[run-scoped field names]`; referenced Offers Table carries them.

`pairs_with:` each other.

**Why:** the PoC "fixed" missing Output fields by editing the *products* example to contain the five names the criterion checks — circular; it proved the LLM can copy a richer example, nothing more. This pair proves the underlying rule — *display/commercial entities carry a full display field set, and the Output references it* — generalized to a vertical it wasn't authored against. If 601 passes and 602 fails, the fix memorized products and the real rule was never written.

---

## 9. Run-scoped tags

Tags marked `[run-scoped]` (TC-202 field names, TC-301 no-forced-type, TC-602 field names) encode choices not yet ratified at the product level. They are valid for this run and **expected to be revisited**. Do not promote them to settled architecture; if a future decision contradicts one, the case changes, not the decision.

This is the starting suite — nine cases across six classes, chosen to prove the things the PoC left unproven (default-shape, context-flip, generalization, over-generation bound). It is not the whole testing program. Expand it case by case, criteria-first, recorded in `test_log.md`.
