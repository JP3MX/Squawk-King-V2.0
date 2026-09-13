import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic-provider";

let cachedProvider: AIProvider | null = null;

/**
 * Returns the active AIProvider. This is the ONLY place that decides which
 * vendor implementation is used. To swap providers, add a new class that
 * implements AIProvider and change the branch below (or the AI_PROVIDER
 * env var) — nothing else in the app needs to change.
 */
export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER || "anthropic";

  switch (providerName) {
    case "anthropic":
    default:
      cachedProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || "");
      break;
  }

  return cachedProvider;
}

export * from "./provider";
