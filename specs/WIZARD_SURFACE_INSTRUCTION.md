# Instruction for Claude Code — Wizard Surface (card-sequence player)

## What this is

A new **surface** that plays a sequence of cards as a stepped progression. It is NOT a
hardcoded wizard. The Synapse Figma (the 6-step "Add Product Catalog" flow) is a
hardcoded wizard; we are reimagining it as **dynamically trafficked cards**. Do not
rebuild the Figma's fixed steps. Build a surface that renders whatever card sequence it
is handed.

This reuses everything already built: the same card definitions, the same CardPlayer,
the same card contract (typed props in, semantic action out via the existing event
path). The wizard is a second surface over the same machinery — the chat surface's
sibling, not a new card system.

## The core model — read carefully, this is the part that's easy to get wrong

The engine composes the **entire wizard shape at once** for a given situation, and hands
it over whole. The surface then plays that shape autonomously — no engine round-trip
between cards.

- Chat surface is fed **one** card: `{ say, card }`.
- Wizard surface is fed **a sequence** of cards: `{ wizard: { steps: [ envelope, envelope, … ] } }`.

Same engine, same cards, same player, same action bubbling. The only difference is
cardinality: chat gets one envelope, the wizard gets an ordered list of envelopes.

Critical points that must hold:

1. **There is no fixed "step 3."** Card order is a property of the emitted shape, not of
   the surface and not of the card. "Primary Key" is not "step 3" — it is wherever the
   shape places it for this situation. The surface renders position N of whatever list
   it was given; it has no knowledge of what any step "is."
2. **The shape is composed once, up front.** The surface does not ask the engine "what's
   next" after each card. It receives the whole sequence and walks it.
3. **The shape is data, per-situation.** A different situation yields a different shape —
   different order, possibly different cards. The Figma's order is just ONE example
   shape (the one a plain context happens to produce).
4. **Once handed over, the shape is fixed for this first cut.** The wizard plays it to
   the end and commits. Re-shaping mid-flow (e.g. a key choice invalidating a later
   step) is explicitly out of scope for now. Do not build re-computation.

## The seam (same discipline as the chat fixtures)

The surface must receive its shape from **outside itself** — a real seam — even though
the brain behind that seam is faked for now.

- Build a stand-in that occupies the engine's seat and returns **one hardcoded wizard
  shape**: the Figma's sequence (below). This is the equivalent of the chat keyword/ops
  stand-in already in place — a throwaway occupying the engine seam, no real LLM
  composition.
- Keep it clearly isolated so it can later be replaced by the real engine emitting
  `{ wizard: {...} }` without touching the surface, the player, the registry, or the
  cards.

Do NOT bake the Figma sequence into the surface. The surface gets a shape; the stand-in
is what currently produces that shape.

## The wizard shape (envelope)

```json
{
  "wizard": {
    "title": "Add Product Catalog",
    "steps": [
      { "id": "s1", "label": "Upload and detect", "card": { "cardType": "...", "props": { } } },
      { "id": "s2", "label": "...",                "card": { "cardType": "...", "props": { } } }
    ],
    "commit": { "label": "Save" }
  }
}
```

- Each `step.card` is an ordinary card envelope — the SAME shape the chat surface
  consumes. The wizard shape is a list of those, plus `label` per step (for the rail)
  and a `commit` marker for the final action.
- The surface owns presentation only: a step rail, one card at a time, Back / Continue,
  accumulating draft state across steps, and a single commit at the end.
- The surface owns NO card selection and NO ordering logic.

## First-cut example shape — the Figma sequence

Use this as the single shape the stand-in returns. Cards in **bold** are already seeded;
the rest need seeding (see scope note).

1. Upload and detect — **`tableDiscovery`**, then **`validationFindings`**
   (the Figma's step 1 walks source-pick → connect → analyze → discovery → findings;
   for the first cut, represent step 1 with `tableDiscovery` followed by
   `validationFindings`. `sourceInput` can come later.)
2. Filtering rules — **`filterRecommendation`** (+ `customFilter`, `filterImpactSummary` later)
3. Primary key — **`keySelection`**
4. Field mapping — `fieldMapping`
5. Schedule — `importSettings`
6. Catalog Preview — `tablePreview`, then **Save** commits

Note: the wizard does NOT use `changeSummary`. `changeSummary` is the chat surface's
mutation card; the wizard commits with its own Save. This is expected and correct.

## Scope — pick the smaller cut first

**Build the reduced cut first: steps 1–3 only**, using only the already-seeded cards
(`tableDiscovery`, `validationFindings`, `filterRecommendation`, `keySelection`). This
proves the surface plays a handed-over shape, with zero new card seeding. Stub steps 4–6
as "coming."

Defer the full 6-step version (which requires seeding `sourceInput`, `customFilter`,
`filterImpactSummary`, `fieldMapping`, `importSettings`, `tablePreview` — they exist as
TSX in the zip but are not yet seeded).

## Done means

- A wizard surface renders a card sequence from a handed-over shape, one card at a time,
  with a step rail and Back / Continue, accumulating draft state, committing once at the
  end.
- The surface contains no card-ordering or card-selection logic; it plays whatever shape
  it is given. Reordering the stand-in's shape reorders the wizard with no surface
  change.
- The shape is produced by an isolated stand-in occupying the engine seam, replaceable
  later by a real `{ wizard: {...} }` from the engine without touching surface, player,
  registry, or cards.
- The same CardPlayer and the same card definitions are used as in chat — no parallel
  card system.
- Reduced cut (steps 1–3) works end to end with the 4 already-seeded cards.

---

## Before you stop — commit and push

Commit ALL current changes (this instruction's work plus anything pending) and push to
git, so it can be picked up from another machine.

**Do NOT deploy/push to Railway.** Git only. No production deploy.

To be explicit:
- `git add -A`, commit with a clear message, `git push` to the remote (e.g. origin).
- Do not trigger a Railway deploy, do not push to any branch/remote wired to Railway
  auto-deploy, and do not run any Railway CLI deploy step.
