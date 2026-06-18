# CLAUDE.md — CoPPER v2 (go-forward reference)

> Full original build spec: `specs/v2_build_instructions.md`
> Architecture rationale: `specs/v2_architecture_design.md`
> Authoritative data shapes: `specs/v2_object_schemas.md` — **wins on all structure conflicts**
> Debug endpoint guide: `specs/debug_readme.md`

---

## Current state

Milestones 1 and 2 are complete. M3 (intelligence/mutation) is in progress.

- UI renders from GCS-backed versioned state
- Chat route submits ops, applies them, and journals reasoning log entries to GCS
- Reasoning log is browsable in the QA viewer
- Admin panel reads/writes KB files in GCS

---

## Non-negotiable invariants

- **Full state per version.** Never delta. Never stored diffs.
- **`contextSeen` is a structured JSON object**, not a flat list. Add new subsections (e.g. `kbSnippets`, `projectSnapshot`) — never flatten back to an array.
- **No invented entity types.** Use only what `v2_object_schemas.md` lists. Flag gaps with `TODO(human)`.
- **Storage-generic ops only.** `addEntity` / `modifyEntity` / `removeEntity` / `addConnection` / `removeConnection`. A new entity type requires zero new backend code.
- **Never modify `demo.v01/`.** It is the read-only migration source.
- **Co.P.P scope only.** No Execution, no Reality. If a decision seems to need them, re-read the scope.

---

## Key file map

| What | Where |
|---|---|
| Data contracts (all shared types) | `packages/contracts/src/index.ts` |
| GCS store implementation | `packages/project-store/src/gcsStore.ts` |
| GCS low-level adapter | `server/src/storage/gcs.ts` |
| LLM router (multi-model) | `server/src/llm/router.ts` |
| System prompt builder | `server/src/llm/systemPrompt.ts` |
| Op applicator | `server/src/llm/applyOps.ts` |
| Chat route (production) | `server/src/routes/chat.ts` |
| Debug submit endpoint | `server/src/routes/debug.ts` |
| Admin KB endpoints | `server/src/routes/admin.ts` |
| KB loader | `server/src/kb.ts` |
| QA / reasoning viewer | `apps/client/src/components/QAViewer.tsx` |
| Admin panel (KB editor) | `apps/client/src/components/AdminPanel.tsx` |

---

## Debug and KB testing workflow

The system can be tested entirely over HTTP — no terminal access required. This matters on Railway where only the UI and API are reachable.

**The loop:**
1. `GET /api/projects` — list projects, pick an id
2. `GET /api/admin/list?prefix=knowledge/` — browse KB structure
3. `GET /api/admin/file?path=knowledge/<folder>/<file>` — read a KB file
4. `POST /api/debug/project/:id/submit` — submit a chat message, get back verbose JSON: ops produced, full reasoning log entry, diagnostics
5. Inspect the response — if KB needs fixing, `PUT /api/admin/file` to update it
6. Repeat from step 4

Full endpoint reference and example payloads: **`specs/debug_readme.md`**.

The `contextSeen.chat` field in every reasoning log entry records exactly what user message and conversation history triggered that pass — use this as the ground truth for whether the LLM saw what you intended.

---

## Local dev server (Vite)

The client source files are all `.tsx` / `.ts`. Vite imports use `.js` extensions in the source (e.g. `import { useStore } from "../store.js"`) — Vite resolves these to the `.ts`/`.tsx` counterparts automatically.

**Known failure mode: stale `.js` files in `src/`**
If compiled `.js` files ever appear inside `apps/client/src/` (e.g. from a runaway `tsc` invocation without `--outDir`), Vite will resolve them in preference to the `.tsx` sources. Symptoms: UI shows a stale version number and code changes have no effect even after hard refresh.

Fix:
```
find apps/client/src -name "*.js" -not -path "*/node_modules/*" -delete
```
Then kill the Vite process, delete `apps/client/node_modules/.vite`, and restart Vite. Hard-refresh the browser once it's back up.

**Restarting Vite** (I manage the dev server — user cannot restart it directly):
1. Kill all node processes whose command line matches `vite`
2. Delete `apps/client/node_modules/.vite` (module/deps cache)
3. Start: `node C:\code\copper\demo.v02\node_modules\vite\bin\vite.js` with CWD `apps/client`
4. Wait ~5s, verify port 5173 is LISTENING before telling user to refresh

**Never deploy to Railway unless the user explicitly asks.** "Push" in this project means `git push` only.

**Railway is intentionally NOT connected to GitHub.** A `git push` never triggers a Railway deploy. Never assume a push caused a deployment. To deploy, always run `railway up --detach` explicitly via the CLI. Verify the deploy started by checking `railway deployment list`.

---

## Open decisions (flagged, not resolved)

- `TODO(human): Import may be canonical if it is named & kept across source changes — see schema doc B1.`
- `contextSeen` future subsections (`kbSnippets`, `projectSnapshot`) are reserved by shape but not yet populated.
