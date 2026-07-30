export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilyResult[];
}

/**
 * Search the web via Tavily and return formatted context for the model.
 */
export async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set. Add it as a secret to enable web search.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(2500),
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Tavily search failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as TavilySearchResponse;

  const parts: string[] = [];

  if (data.answer) {
    parts.push(`Summary: ${data.answer}`);
    parts.push("");
  }

  for (const result of data.results) {
    parts.push(`Source: ${result.title}`);
    parts.push(`URL: ${result.url}`);
    parts.push(result.content);
    parts.push("");
  }

  return parts.join("\n").trim();
}
