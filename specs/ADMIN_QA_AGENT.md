# ADMIN_QA_AGENT — In-App KB Tester-Proposer

**Status:** backlog / aside. Primary focus is UX; the KB is a necessary evil. Build this only if the seam check (§6) comes back clean. If it doesn't, park it — do not let reload-plumbing eat UX time.

**One-line purpose:** let an admin edit the KB *through its behavior* instead of by reading it. Assert "prompt X should produce Y," and the agent proposes the KB diff that makes it so, with the reasoning, for human approval.

---

## 1. Why this exists (the thesis)

Editing the KB by reading means: open `patterns.md`, find the wrong sentence, reword it. The tax isn't the human's knowledge — the human knows "zip recommendation is a Filter, not a table" instantly. The tax is *locating and rewording the KB prose* that's causing the wrong behavior. The human does not natively know that `patterns.md` line N teaches the v1 shape.

The agent closes exactly that gap and **only** that gap:
- **Domain knowledge enters at the assertion.** The expected result Y is a domain fact, supplied by the human who holds it. The agent never guesses the domain.
- **The agent translates behavioral intent into KB text.** Intent in (prompt + expected), textual edit out. It maintains the *text*; the human authors the *behavior*.

This is the CoPPER thesis pointed at the KB itself: edit at the level you think (behavior), let the machine keep the artifact (KB text) in sync. It's not a feature bolted on — it's the wireframe's own argument applied one level down. For the demo, that's the thing worth showing: *even the knowledge base is edited by behavior, not by hand.*

**Honest limit (must be visible in the UI, not hidden):** this accelerates a human who knows the domain. Assert Y carelessly and you get a confident diff toward a *wrong* KB. The speed comes from removing the read-tax, not from removing the human. The approve gate is where the human's knowledge does the work.

---

## 2. The loop (five beats)

```
assert (prompt + expected)  →  run  →  red/green  →  proposed diff + why  →  approve  →  retest
```

- **assert** — admin types a prompt and a plain-language expectation.
- **run** — `submit(prompt)` against the live KB; capture `ops` + `reasoning`.
- **red/green** — did the output satisfy the expectation? (judging: §4)
- **proposed diff + why** — on red, the agent returns a diagnosis + a unified diff over KB files.
- **approve** — human reviews diff + why; approve / reject / edit. Nothing is written until approve.
- **retest** — re-run the prompt with the proposed KB applied (inline dry-run, §5) and show red→green before committing.

No versioning tier, no candidate/HEAD machinery — reject *is* the rollback at this scale. Keep it that simple.

---

## 3. Endpoints

Reuses existing surface except the one new handler.

| Endpoint | Status | Role |
|---|---|---|
| `POST /api/debug/project/:id/submit` | exists | run the prompt, return `ops` + `reasoning` |
| `PUT /api/admin/file` | exists | write the approved KB diff |
| `GET /api/admin/file` | exists | read current KB for the proposer's context |
| `POST /api/admin/qa/propose` | **new** | failure in → diagnosis + unified diff out |
| `submit` w/ `kbOverride` param | **new param** | inline dry-run retest (§5) |

### `POST /api/admin/qa/propose`
**In:** `{ prompt, expected, ops, reasoning, kbFiles: [{path, content}] }`
**Out:** `{ diagnosis: string, diff: [{path, unifiedDiff}], proposedContent: [{path, content}] }`

One server-side LLM call (existing routing). Prompt contract: *here is the prompt, the expectation, what the agent actually emitted and why, and the relevant KB files. Diagnose which KB text caused the gap and return a minimal diff that closes it. Return the full proposed file content too, for the dry-run.* Keep the diff minimal and localized — minimal-change discipline matters for reviewability.

---

## 4. Judging red/green (wireframe grade)

Skip the criteria DSL. Let the LLM judge "does this `ops` output satisfy expectation Y." Near-zero code, honest at this fidelity. (If this graduates past wireframe, swap in the `QA_TESTSUITE_01` DSL for deterministic checks — but not now.)

---

## 5. Retest = inline dry-run (the key design choice)

**Do not** write-then-reload-then-retest. Instead, retest by **injecting the proposed KB inline for that single submit call** — apply the diff in memory, evaluate once, write nothing until approve.

Strictly better for a demo on three counts:
1. No hot-reload dependency in the retest path.
2. Source-of-truth doesn't mutate until the human approves.
3. "Preview the fix before committing" becomes a first-class feature, not a hack.

Mechanically: `submit` (or a debug variant) accepts an optional `kbOverride: [{path, content}]`. When present, the prompt builder uses the override instead of the loaded KB for that call only.

---

## 6. The seam check (the gate on the whole build)

The entire estimate hinges on **how the KB enters the system prompt.**

Grep where `server/src/llm/systemPrompt.ts` gets its KB content:
- **Passed in as an argument** → clean. The `kbOverride` param and per-call re-read both drop in. ~1–2 day build.
- **Read from a captured startup global** → add a seam first (KB as a value the builder receives). An hour if referenced cleanly; up to a day if closured across the codebase. If it's the bad case and time-boxed, park the feature.

This single check answers both the dry-run question and the restart-fix question at once.

---

## 7. Standing correction (independent of this feature)

**"KB invisible until restart" is a latent bug, not just a demo annoyance.** Anyone testing KB edits hits it; forcing a server restart to see a KB change is a non-starter for human testers. Fix regardless of whether the QA agent ships:

- KB must be re-read on demand — reload-after-write, or (better) passed as a value into the prompt builder so each call reads fresh.
- Same seam as §6. Doing it as "pass KB as a value" fixes the restart bug *and* enables the inline dry-run in one move.

This is a correction to the KB-loading model itself. It is no longer acceptable to treat KB as load-once-at-startup.

---

## 8. Scope discipline

- Wireframe fidelity. No versioning ceremony, no candidate/HEAD, no suite-gate (that's for a maintained KB; we're bootstrapping a 0.1 guess into something real, cost-of-wrong is low).
- The agent **proposes**; the human **disposes**. The agent is never in the KB-origination path unattended.
- Build only on a green §6 check. Otherwise this doc is the capture and Code picks it up later.
