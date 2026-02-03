import { loadApiSettings } from "./settings-store.js";
import { loadLLMProviderSettings } from "./llm-providers-store.js";
import OpenAI from "openai";

export const DEFAULT_SESSION_TITLE = "New Chat";

export const generateSessionTitle = async (userIntent: string | null, sessionModel?: string) => {
  if (!userIntent) return DEFAULT_SESSION_TITLE;

  try {
    let apiKey: string | undefined;
    let baseURL: string | undefined;
    let modelName: string | undefined;

    // Prefer provider-based config when model is in provider::model format
    if (sessionModel && sessionModel.includes("::")) {
      const [providerId, modelId] = sessionModel.split("::");
      const llmSettings = loadLLMProviderSettings();

      if (llmSettings) {
        const provider = llmSettings.providers.find((p) => p.id === providerId);
        if (provider) {
          apiKey = provider.apiKey;
          modelName = modelId;

          if (provider.type === "openrouter") {
            baseURL = "https://openrouter.ai/api/v1";
          } else if (provider.type === "zai") {
            const prefix = provider.zaiApiPrefix === "coding" ? "api/coding/paas" : "api/paas";
            baseURL = `https://api.z.ai/${prefix}/v4`;
          } else {
            baseURL = provider.baseUrl || undefined;
          }
        }
      }
    }

    // Fall back to legacy API settings
    if (!apiKey) {
      const guiSettings = loadApiSettings();

      if (guiSettings && guiSettings.apiKey) {
        apiKey = guiSettings.apiKey;
        baseURL = guiSettings.baseUrl || undefined;
        modelName = guiSettings.model;
      }
    }

    // If no valid settings, use simple fallback
    if (!apiKey) {
      return extractFallbackTitle(userIntent);
    }

    // Create OpenAI client with user settings
    const client = new OpenAI({
      apiKey,
      baseURL: baseURL ? `${baseURL}` : undefined,
    });

    const response = await client.chat.completions.create({
      model: modelName || 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `You are a chat title generator. Generate a SHORT title (1-2 words MAX) that captures the essence of the user's request. 

Rules:
- Output ONLY the title, nothing else
- Maximum 2 words
- No quotes, no punctuation
- Use nouns or noun+verb format
- Examples: "File Analysis", "Code Review", "Python Help", "Web Parsing"`
        },
        {
          role: 'user',
          content: userIntent
        }
      ],
      max_tokens: 10,
      temperature: 0.3,
    });

    const title = response.choices[0]?.message?.content?.trim();
    if (title) {
      // Clean up: remove quotes, limit to 2 words, max 30 chars
      const cleaned = title
        .replace(/^["']|["']$/g, '')
        .replace(/[.,!?:;]/g, '')
        .split(/\s+/)
        .slice(0, 2)
        .join(' ')
        .slice(0, 30);

      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  } catch (error) {
    console.error('Failed to generate session title:', error);
  }

  // Fallback: extract key words from user input
  return extractFallbackTitle(userIntent);
};

/**
 * Extract a simple title from user input when LLM is not available
 */
function extractFallbackTitle(text: string): string {
  // Remove common words and extract first meaningful words
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
    'please', 'can', 'need', 'want', 'help', 'make', 'get', 'show', 'tell']);

  const cleaned = text
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();

  const words = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w))
    .slice(0, 2);

  const titleRaw = words.length > 0
    ? words.join(' ')
    : cleaned.split(/\s+/).slice(0, 2).join(' ');

  if (!titleRaw) {
    return DEFAULT_SESSION_TITLE;
  }

  // Capitalize first letter of each word (noop for non-Latin scripts)
  return titleRaw
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 30);
}
