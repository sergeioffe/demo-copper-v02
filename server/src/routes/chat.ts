import { Router } from "express";
import type { ProjectStore } from "../store.js";
import type { Exchange, Intent, ReasoningLogEntry, Version } from "@copper/contracts";
import { routeLLM } from "../llm/router.js";
import { buildSystemPrompt } from "../llm/systemPrompt.js";
import { applyOps } from "../llm/applyOps.js";

export function makeChatRouter(store: ProjectStore, getKB: () => string = () => ""): Router {
  const router = Router();

  // POST /api/projects/:id/chat
  router.post("/:id/chat", async (req, res) => {
    const { message, llmModel = "claude-sonnet-4-6", exchanges = [], version: clientVersion } = req.body as {
      message: string;
      llmModel?: string;
      exchanges?: Exchange[];
      version?: Version;
    };

    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const projectId = req.params.id;
    // Use the client's current version as the base (may be provisional/unsaved).
    // Fall back to store only if client didn't send it.
    const version = clientVersion ?? await store.loadLatestVersion(projectId);
    if (!version) return res.status(404).json({ error: "Project not found" });

    const systemPrompt = buildSystemPrompt(version, getKB());

    // Build user message with recent conversation context
    const historyLines = exchanges.slice(-6).map((e) =>
      `${e.role === "user" ? "User" : "Assistant"}: ${e.text}`,
    );
    const userMessage = historyLines.length
      ? `Previous conversation:\n${historyLines.join("\n")}\n\nNew request: ${message}`
      : message;

    let llmReply: string;
    let ops: Intent[];
    let reasoning: ReasoningLogEntry["reasoning"];
    const startedAt = new Date().toISOString();

    try {
      const result = await routeLLM({ llmModel, systemPrompt, userMessage });

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
    } catch (err) {
      console.error("[chat] LLM call failed:", (err as Error).message);
      return res.status(500).json({ error: `LLM error: ${(err as Error).message}` });
    }

    // Apply ops and produce a provisional new version (NOT saved — user must explicitly save).
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

    // Journal reasoning entry
    const passId = `pass_${Date.now().toString(36)}`;
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

    const responseTimeMs = Date.now() - new Date(startedAt).getTime();
    const exchange: Exchange = {
      id: `ex_a_${Date.now()}`,
      role: "assistant",
      text: llmReply,
      status: "success",
      startedAt,
      responseTimeMs,
      llmModel,
      planType: null,
      ...(result.card ? { card: result.card } : {}),
    };

    console.log(
      `[chat] ✅ ${projectId} v${version.version}→v${newVersion.version} | ops:${ops.length} versioned:${versioned}`,
    );

    res.json({ exchange, version: versioned ? newVersion : null });
  });

  return router;
}
