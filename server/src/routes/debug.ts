import { Router } from "express";
import type { ProjectStore } from "../store.js";
import type { Exchange, Intent, ReasoningLogEntry, Version } from "@copper/contracts";
import { routeLLM } from "../llm/router.js";
import { buildSystemPrompt } from "../llm/systemPrompt.js";
import { applyOps } from "../llm/applyOps.js";

// POST /api/debug/project/:id/submit
// Synchronous, verbose version of the chat route. Returns full diagnostics as plain JSON.
// Designed for LLM test drivers that need to inspect ops, reasoning, and contextSeen
// without parsing SSE or driving the UI.
function assembleKBFromOverride(files: Array<{ path: string; content: string }>): string {
  return files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => {
      const name = f.path.replace(/^knowledge\//, "");
      return `## ${name}\n\n${f.content.trim()}`;
    })
    .join("\n\n---\n\n");
}

export function makeDebugRouter(store: ProjectStore, getKB: () => string = () => ""): Router {
  const router = Router();

  router.post("/project/:id/submit", async (req, res) => {
    const {
      message,
      llmModel = "claude-sonnet-4-6",
      exchanges = [],
      version: clientVersion,
      kbOverride,
    } = req.body as {
      message: string;
      llmModel?: string;
      exchanges?: Exchange[];
      version?: Version;
      kbOverride?: Array<{ path: string; content: string }>;
    };

    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const projectId = req.params.id;
    const version = clientVersion ?? (await store.loadLatestVersion(projectId));
    if (!version) return res.status(404).json({ error: "Project not found" });

    const effectiveKB = kbOverride?.length
      ? assembleKBFromOverride(kbOverride)
      : getKB();
    const systemPrompt = buildSystemPrompt(version, effectiveKB);

    const historyLines = exchanges.slice(-6).map((e) =>
      `${e.role === "user" ? "User" : "Assistant"}: ${e.text}`,
    );
    const userMessageSent = historyLines.length
      ? `Previous conversation:\n${historyLines.join("\n")}\n\nNew request: ${message}`
      : message;

    const startedAt = Date.now();
    let llmReply: string;
    let ops: Intent[];
    let reasoning: ReasoningLogEntry["reasoning"];
    let llmCard: { cardType: string; props: Record<string, unknown> } | null = null;

    try {
      const result = await routeLLM({ llmModel, systemPrompt, userMessage: userMessageSent });
      llmReply = result.reply ?? result.summary ?? "Done.";
      ops = ((result.ops ?? []) as Intent[]).filter(
        (o) => o && typeof o === "object" && "op" in o,
      );
      reasoning = result.reasoning ?? {
        problem: message,
        solution: llmReply,
        justification: "LLM did not provide structured reasoning.",
        alternativesConsidered: [],
      };
      llmCard = result.card ?? null;
    } catch (err) {
      return res.status(500).json({ error: `LLM error: ${(err as Error).message}` });
    }

    const responseTimeMs = Date.now() - startedAt;

    let newVersion = version;
    let versioned = false;
    if (ops.length > 0) {
      newVersion = applyOps(version, ops);
      newVersion = {
        ...newVersion,
        version: version.version + 1,
        parentVersion: version.version,
        authoredBy: "system",
        createdAt: new Date().toISOString(),
      };
      versioned = true;
    }

    const passId = `dbg_${Date.now().toString(36)}`;
    const rlogEntry: ReasoningLogEntry = {
      id: `rlog_0000`,
      fromVersion: version.version,
      toVersion: newVersion.version,
      pass: passId,
      seq: 0,
      reasoning,
      producedChanges: [],
      contextSeen: {
        chat: {
          userMessage: message,
          history: exchanges.slice(-6).map((e) => ({ role: e.role, content: e.text })),
        },
      },
    };
    await store.appendReasoningEntry(projectId, newVersion.version, passId, rlogEntry);

    const exchange: Exchange = {
      id: `ex_dbg_${Date.now()}`,
      role: "assistant",
      text: llmReply,
      status: "success",
      startedAt: new Date(startedAt).toISOString(),
      responseTimeMs,
      llmModel,
      planType: null,
      ...(llmCard ? { card: llmCard } : {}),
    };

    res.json({
      ok: true,
      projectId,
      versioned,
      exchange,
      version: versioned ? newVersion : null,
      ops,
      rlogEntry,
      diagnostics: {
        llmModel,
        systemPromptLength: systemPrompt.length,
        userMessageSent,
        responseTimeMs,
        fromVersion: version.version,
        toVersion: newVersion.version,
      },
    });
  });

  return router;
}
