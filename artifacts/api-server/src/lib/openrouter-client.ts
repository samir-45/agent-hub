import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

// Short-lived in-memory cache
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export async function getOpenRouterApiKey(userEmail?: string, userHeaderKey?: string, userRole?: string): Promise<string> {
  // 1. If caller passed their own key in request headers (x-openrouter-key), use it
  if (userHeaderKey && typeof userHeaderKey === "string" && userHeaderKey.trim().startsWith("sk-or-")) {
    return userHeaderKey.trim();
  }

  // Check if caller is Admin
  const isAdmin = Boolean(
    (userEmail && userEmail.trim().toLowerCase() === "mdmahinkhan851@gmail.com") ||
    userRole === "admin"
  );

  // 2. STRICT ADMIN-ONLY: Admin can fall back to system DB key or .env key
  if (isAdmin) {
    try {
      const [row] = await db
        .select()
        .from(settingsTable)
        .where(eq(settingsTable.key, "openrouter_api_key"));

      if (row && row.encryptedValue) {
        const key = decrypt(row.encryptedValue, row.iv, row.authTag);
        if (key && key.startsWith("sk-or-")) {
          return key;
        }
      }
    } catch {
      // Fall through to env
    }

    if (process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY;
    }
  }

  // 3. Non-admin users MUST bring their own API key (BYOK policy)
  throw new Error(
    "Security Policy: OpenRouter API Key Required. Non-admin users must pair their own OpenRouter API key (sk-or-v1-...) in Settings."
  );
}

export function invalidateApiKeyCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}

export async function getOpenRouterClient(userEmail?: string, userHeaderKey?: string, userRole?: string): Promise<OpenAI> {
  const apiKey = await getOpenRouterApiKey(userEmail, userHeaderKey, userRole);
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
