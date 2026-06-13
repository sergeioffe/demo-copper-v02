import { callAnthropic } from "./anthropic.js";
import { callOpenAI } from "./openai.js";
import { callGoogle } from "./google.js";

export interface LLMRequest {
  llmModel: string;
  systemPrompt: string;
  userMessage: string;
}

export interface ReasoningBlock {
  problem: string;
  solution: string;
  justification: string;
  alternativesConsidered: string[];
}

export interface LLMResponse {
  summary: string;
  ops: unknown[] | null;
  proposal: unknown | null;
  plan: string | null;
  rawResponse: string;
  // M3 fields
  reasoning: ReasoningBlock | null;
  reply: string | null;
  card: { cardType: string; props: Record<string, unknown> } | null;
}

export async function routeLLM(req: LLMRequest): Promise<LLMResponse> {
  if (req.llmModel.startsWith("claude-")) return callAnthropic(req);
  if (req.llmModel.startsWith("gpt-"))    return callOpenAI(req);
  if (req.llmModel.startsWith("gemini-")) return callGoogle(req);
  throw new Error(`Unknown model prefix: ${req.llmModel}`);
}
