import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ReasoningBlock } from "./router.js";
import { extractJSON } from "./utils.js";

export async function callAnthropic({ llmModel, systemPrompt, userMessage }: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  const response = await client.messages.create({
    model: llmModel,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = (response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined)?.text ?? "";
  console.log(`[anthropic] raw (${text.length} chars): ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`);
  try {
    const parsed = extractJSON(text);
    return {
      summary:     (parsed.summary as string)          ?? (parsed.reply as string) ?? "",
      ops:         (parsed.ops as unknown[])            ?? null,
      proposal:    parsed.proposal                       ?? null,
      plan:        (parsed.plan as string)               ?? null,
      rawResponse: text,
      reasoning:   (parsed.reasoning as ReasoningBlock) ?? null,
      reply:       (parsed.reply as string)             ?? null,
      card:        (parsed.card as { cardType: string; props: Record<string, unknown> }) ?? null,
    };
  } catch (err) {
    console.error(`[anthropic] JSON parse failed: ${(err as Error).message}`);
    throw Object.assign(new Error("LLM returned invalid JSON"), { raw: text });
  }
}
