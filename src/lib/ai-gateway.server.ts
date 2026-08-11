import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Server-only OpenAI-compatible AI gateway provider. */
export function createAiGatewayProvider(apiKey: string) {
  const baseURL = process.env["AI_GATEWAY_BASE_URL"] ?? "https://openrouter.ai/api/v1";

  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL,
    apiKey,
  });
}
