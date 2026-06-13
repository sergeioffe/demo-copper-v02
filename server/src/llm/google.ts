import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMRequest, LLMResponse, ReasoningBlock } from "./router.js";
import { extractJSON } from "./utils.js";

export async function callGoogle({ llmModel, systemPrompt, userMessage }: LLMRequest): Promise<LLMResponse> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  const model = genAI.getGenerativeModel({ model: llmModel, systemInstruction: systemPrompt });
  const result = await model.generateContent(userMessage);
  const text = result.response.text();
  console.log(`[google] raw (${text.length} chars): ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`);
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
    console.error(`[google] JSON parse failed: ${(err as Error).message}`);
    throw Object.assign(new Error("LLM returned invalid JSON"), { raw: text });
  }
}
