import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

interface TavilySearchResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilySearchResult[];
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export class WebSearchTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "web_search",
    description:
      "Search the web for Arduino docs, library references, and troubleshooting info. Returns titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        max_results: {
          type: "number",
          description: "Max results (default 5).",
        },
      },
      required: ["query"],
    },
  };

  readonly requiresApproval = false;

  private readonly apiKey: string;
  private readonly provider: string;

  constructor(apiKey: string, provider: string) {
    this.apiKey = apiKey;
    this.provider = provider;
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<ToolCallOutput> {
    const query = args.query as string;
    if (!query) {
      return { content: "Error: 'query' argument is required.", isError: true };
    }

    const maxResults = (args.max_results as number) || 5;

    try {
      switch (this.provider) {
        case "tavily":
          return await this.searchTavily(query, maxResults);
        case "brave":
          return await this.searchBrave(query, maxResults);
        default:
          return {
            content: `Error: Unsupported search provider '${this.provider}'. Supported: 'tavily', 'brave'.`,
            isError: true,
          };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: `Web search failed: ${message}`,
        isError: true,
      };
    }
  }

  private async searchTavily(
    query: string,
    maxResults: number,
  ): Promise<ToolCallOutput> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        api_key: this.apiKey,
      }),
    });

    if (!response.ok) {
      return {
        content: `Tavily API error: ${response.status} ${response.statusText}`,
        isError: true,
      };
    }

    const data = (await response.json()) as TavilyResponse;
    const results = data.results || [];

    if (results.length === 0) {
      return { content: `No results found for: "${query}"` };
    }

    const formatted = results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title || "Untitled"}\n   URL: ${r.url || "N/A"}\n   ${r.content || "No snippet available."}`,
      )
      .join("\n\n");

    return { content: `Search results for "${query}":\n\n${formatted}` };
  }

  private async searchBrave(
    query: string,
    maxResults: number,
  ): Promise<ToolCallOutput> {
    const params = new URLSearchParams({
      q: query,
      count: String(maxResults),
    });

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": this.apiKey,
        },
      },
    );

    if (!response.ok) {
      return {
        content: `Brave Search API error: ${response.status} ${response.statusText}`,
        isError: true,
      };
    }

    const data = (await response.json()) as BraveResponse;
    const results = data.web?.results || [];

    if (results.length === 0) {
      return { content: `No results found for: "${query}"` };
    }

    const formatted = results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title || "Untitled"}\n   URL: ${r.url || "N/A"}\n   ${r.description || "No snippet available."}`,
      )
      .join("\n\n");

    return { content: `Search results for "${query}":\n\n${formatted}` };
  }
}
