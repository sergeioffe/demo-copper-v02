import OpenAI from "openai";
import type { LLMRequest, LLMResponse, ReasoningBlock } from "./router.js";
import { extractJSON } from "./utils.js";

export async function callOpenAI({ llmModel, systemPrompt, userMessage }: LLMRequest): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: llmModel,
    max_completion_tokens: 16000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage  },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  console.log(`[openai] raw (${text.length} chars): ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`);
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
    console.error(`[openai] JSON parse failed: ${(err as Error).message}`);
    throw Object.assign(new Error("LLM returned invalid JSON"), { raw: text });
  }
}
