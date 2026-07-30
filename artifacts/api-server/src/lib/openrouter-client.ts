import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

// Short-lived in-memory cache
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export async function getOpenRouterApiKey(userEmail?: string, userHeaderKey?: string): Promise<string> {
  // 1. If user passed their own key in request headers, prioritize user's key
  if (userHeaderKey && userHeaderKey.startsWith("sk-or-")) {
    return userHeaderKey;
  }

  // 2. Try to load key stored in database settings
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "openrouter_api_key"));

    if (row) {
      const key = decrypt(row.encryptedValue, row.iv, row.authTag);
      return key;
    }
  } catch {
    // Fall through
  }

  // 3. ONLY allow server env fallback if the user is the Owner/Admin
  const isAdmin = userEmail === "mdmahinkhan851@gmail.com";
  if (isAdmin && process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  // 4. Strict BYOK enforcement for community users
  throw new Error(
    "OpenRouter API Key Required: Please pair your own OpenRouter API key in Settings to execute prompts."
  );
}

export function invalidateApiKeyCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}

export async function getOpenRouterClient(userEmail?: string, userHeaderKey?: string): Promise<OpenAI> {
  const apiKey = await getOpenRouterApiKey(userEmail, userHeaderKey);
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    maxRetries: 1,
    timeout: 15_000,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:19606",
      "X-Title": "OpenRouter Model Manager cockpit",
    },
  });
}
