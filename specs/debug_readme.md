# Debug & KB Testing — Endpoint Reference

All endpoints are available over HTTP. No terminal access required — works on Railway.

**Production base URL:** `https://copper-demo-v02-production.up.railway.app`
**Local base URL:** `http://localhost:3001`

Start every session by calling `GET /api/projects` to discover the project ID — it is not fixed and must be read from the response.

---

## Typical test loop

```
1. List projects            GET  /api/projects
2. Browse KB structure      GET  /api/admin/list?prefix=knowledge/
3. Read a KB file           GET  /api/admin/file?path=knowledge/<folder>/<file>
4. Submit a test message    POST /api/debug/project/:id/submit
5. Inspect ops + rlogEntry  (in the response body)
6. Update KB if needed      PUT  /api/admin/file
7. Repeat from 4
```

---

## Projects

### List all projects
```
GET /api/projects
```
Response: array of project summaries. The `id` field is what you pass to all other endpoints.

```json
[
  {
    "id": "luminary-health-q3-2025",
    "name": "Luminary Health Q3 2025",
    "version": 1,
    "parentVersion": null,
    "authoredBy": "seed",
    "createdAt": "2025-06-11T00:00:00.000Z"
  }
]
```

Use the `id` value (e.g. `luminary-health-q3-2025`) wherever `:id` appears in the endpoints below.

### Get full current state of a project
```
GET /api/projects/:id
```
Response: the full `Version` object (context + all plans).

### Get reasoning log entries for a pass
```
GET /api/projects/:id/versions/:ver/transactions/:pass
```
Response: array of `ReasoningLogEntry`.
`pass` is the `pass` field from the `rlogEntry` in a submit response (e.g. `dbg_m3x2kz`).

---

## Knowledge Base

### List KB folders and files
```
GET /api/admin/list?prefix=knowledge/
```
Response: `{ folders: string[], files: string[] }` — immediate children only.

Drill into a subfolder:
```
GET /api/admin/list?prefix=knowledge/data-activation/
```

### Read a KB file
```
GET /api/admin/file?path=knowledge/data-activation/schema.md
```
Response: `{ path: string, content: string }`

### Update a KB file
```
PUT /api/admin/file
Content-Type: application/json

{ "path": "knowledge/data-activation/schema.md", "content": "...new content..." }
```
Response: `{ ok: true, path: string }`
Write is restricted to the `knowledge/` prefix — project data is not editable this way.

---

## Debug submit (the core test endpoint)

### Submit a message and get verbose diagnostics
```
POST /api/debug/project/:id/submit
Content-Type: application/json

{
  "message": "Add a new filter entity called Revenue Filter",
  "llmModel": "claude-sonnet-4-6",
  "exchanges": [],
  "version": null
}
```

`exchanges` — optional array of prior `Exchange` objects (last 6 are used for context).
`version` — optional: pass your current client version to use it as base instead of the stored one.
`llmModel` — optional, defaults to `claude-sonnet-4-6`. Also accepts `gpt-4o`, `gemini-pro`.

#### Response
```json
{
  "ok": true,
  "projectId": "luminary-health-q3",
  "versioned": true,
  "exchange": {
    "id": "ex_dbg_...",
    "role": "assistant",
    "text": "I've added the Revenue Filter entity...",
    "status": "success",
    "responseTimeMs": 1840,
    "llmModel": "claude-sonnet-4-6"
  },
  "version": { ... },
  "ops": [
    { "op": "addEntity", "type": "Filter", "name": "Revenue Filter", ... }
  ],
  "rlogEntry": {
    "id": "rlog_0000",
    "pass": "dbg_m3x2kz",
    "fromVersion": 3,
    "toVersion": 4,
    "reasoning": {
      "problem": "...",
      "solution": "...",
      "justification": "...",
      "alternativesConsidered": []
    },
    "producedChanges": [],
    "contextSeen": {
      "chat": {
        "userMessage": "Add a new filter entity called Revenue Filter",
        "history": []
      }
    }
  },
  "diagnostics": {
    "llmModel": "claude-sonnet-4-6",
    "systemPromptLength": 4821,
    "userMessageSent": "Add a new filter entity called Revenue Filter",
    "responseTimeMs": 1840,
    "fromVersion": 3,
    "toVersion": 4
  }
}
```

#### Key fields to inspect when debugging

| Field | What to look for |
|---|---|
| `ops` | Did the LLM produce the right op type and fields? Empty = LLM replied but made no changes. |
| `rlogEntry.reasoning.justification` | Did the LLM explain its decision in terms of KB concepts? |
| `rlogEntry.reasoning.alternativesConsidered` | Did it consider alternatives, or did it jump straight to an answer? |
| `diagnostics.systemPromptLength` | Very short (~1000 chars) = KB probably didn't load; very long (>20k) = may be truncating. |
| `diagnostics.userMessageSent` | Exact string sent to LLM — confirms what history was included. |
| `versioned` | `false` = LLM replied but produced no ops. Check `exchange.text` for why. |

---

## What `contextSeen.chat` tells you

Every reasoning log entry stores the exact chat trigger that caused this reasoning pass:

```json
"contextSeen": {
  "chat": {
    "userMessage": "original user message (no history prefix)",
    "history": [
      { "role": "user",      "content": "prior turn..." },
      { "role": "assistant", "content": "prior reply..." }
    ]
  }
}
```

This is separate from `diagnostics.userMessageSent`, which includes the history prefix that was actually sent to the LLM. `contextSeen.chat.userMessage` is the clean user intent; `userMessageSent` is what the LLM saw.

Future subsections (`kbSnippets`, `projectSnapshot`) will be added here when populated.

---

## GCS browser (read-only via admin list)

You can walk the raw bucket structure using the list endpoint:

```
GET /api/admin/list?prefix=                        ← top-level folders
GET /api/admin/list?prefix=project_data/           ← all projects
GET /api/admin/list?prefix=project_data/<id>/      ← versions for a project
GET /api/admin/list?prefix=project_data/<id>/ver02/transactions/  ← passes
```

Then read any file:
```
GET /api/admin/file?path=project_data/<id>/ver02/project.json
GET /api/admin/file?path=project_data/<id>/ver02/transactions/<pass>/rlog_0000.json
```
