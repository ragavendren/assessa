/**
 * Server-only AI model factory.
 * Prefers free-tier Google Gemini (AI Studio key). Falls back to an OpenAI-compatible gateway.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

function stripQuotes(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function getGeminiApiKey() {
  return (
    stripQuotes(process.env["GEMINI_API_KEY"]) ||
    stripQuotes(process.env["GOOGLE_GENERATIVE_AI_API_KEY"]) ||
    ""
  );
}

export function getAiGatewayApiKey() {
  return stripQuotes(process.env["AI_GATEWAY_API_KEY"]);
}

/** True when any AI provider key is configured. */
export function aiConfigured() {
  return Boolean(getGeminiApiKey() || getAiGatewayApiKey());
}

/**
 * Resolve the chat model used by Assessa insights.
 * Default: Gemini 3.5 Flash-Lite via Google AI Studio (free-tier friendly).
 * gemini-2.5-flash is blocked for new API keys — override with GEMINI_MODEL if needed.
 */
export function createAssessaModel(): LanguageModel {
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    const modelId =
      stripQuotes(process.env["GEMINI_MODEL"]) || "gemini-3.5-flash-lite";
    return google(modelId);
  }

  const gatewayKey = getAiGatewayApiKey();
  if (!gatewayKey) {
    throw new Error(
      "AI is not configured. Set GEMINI_API_KEY (preferred) or AI_GATEWAY_API_KEY.",
    );
  }

  const baseURL =
    stripQuotes(process.env["AI_GATEWAY_BASE_URL"]) ||
    "https://openrouter.ai/api/v1";
  const gateway = createOpenAICompatible({
    name: "ai-gateway",
    baseURL,
    apiKey: gatewayKey,
  });
  const modelId =
    stripQuotes(process.env["AI_GATEWAY_MODEL"]) ||
    "google/gemini-3.5-flash-lite";
  return gateway(modelId);
}
