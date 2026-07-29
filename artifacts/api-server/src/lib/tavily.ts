import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

type TavilyResponse = {
  results: TavilyResult[];
  answer?: string;
};

// Short-lived cache for the Tavily key
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export function invalidateTavilyKeyCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}

async function getTavilyApiKey(): Promise<string | null> {
  if (cachedKey && Date.now() < cacheExpiry) return cachedKey;

  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "tavily_api_key"));

    if (row) {
      const key = decrypt(row.encryptedValue, row.iv, row.authTag);
      cachedKey = key;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return key;
    }
  } catch {}

  // Fall back to env var
  return process.env.TAVILY_API_KEY ?? null;
}

export async function tavilySearch(
  query: string,
  maxResults = 5
): Promise<TavilyResult[]> {
  const apiKey = await getTavilyApiKey();
  if (!apiKey) throw new Error("Tavily API key not configured");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search failed (${response.status}): ${text}`);
  }

  const data: TavilyResponse = await response.json();
  return data.results ?? [];
}

export const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the web for current information, recent news, real-time data, prices, or anything that requires up-to-date knowledge beyond the training cutoff.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up",
        },
      },
      required: ["query"],
    },
  },
};
