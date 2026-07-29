import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

// Short-lived in-memory cache so we don't hit the DB on every message
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getOpenRouterApiKey(): Promise<string> {
  // Return from cache if still fresh
  if (cachedKey && Date.now() < cacheExpiry) {
    return cachedKey;
  }

  // Try to load from DB
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "openrouter_api_key"));

    if (row) {
      const key = decrypt(row.encryptedValue, row.iv, row.authTag);
      cachedKey = key;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return key;
    }
  } catch {
    // Fall through to env var
  }

  // Fall back to env var
  const envKey = process.env.OPENROUTER_API_KEY;
  if (!envKey) {
    throw new Error(
      "No OpenRouter API key configured. Add one in Settings or set OPENROUTER_API_KEY."
    );
  }
  return envKey;
}

/** Call this after storing/deleting a key so the cache is invalidated immediately. */
export function invalidateApiKeyCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}

export async function getOpenRouterClient(): Promise<OpenAI> {
  const apiKey = await getOpenRouterApiKey();
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}
