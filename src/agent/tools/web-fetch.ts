import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const DEFAULT_MAX_LENGTH = 5000;

export class WebFetchTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "web_fetch",
    description:
      "Fetch a web page as plain text (HTML stripped). Useful for docs, library references, and datasheets.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch.",
        },
        max_length: {
          type: "number",
          description: "Max characters to return (default 5000).",
        },
      },
      required: ["url"],
    },
  };

  readonly requiresApproval = false;

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext,
  ): Promise<ToolCallOutput> {
    if (!this.apiKey) {
      return {
        content:
          "Error: Web fetch is not available. A web search API key must be configured to enable this tool.",
        isError: true,
      };
    }

    const url = args.url as string;
    if (!url) {
      return { content: "Error: 'url' argument is required.", isError: true };
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return {
        content: `Error: Invalid URL: ${url}`,
        isError: true,
      };
    }

    const maxLength = (args.max_length as number) || DEFAULT_MAX_LENGTH;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ArduinoBot/1.0; +https://github.com/arduino-bot)",
          Accept: "text/html,application/xhtml+xml,text/plain,*/*",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return {
          content: `Error fetching URL: ${response.status} ${response.statusText}`,
          isError: true,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const html = await response.text();

      let text: string;
      if (contentType.includes("text/html") || contentType.includes("xhtml")) {
        text = this.stripHtml(html);
      } else {
        text = html;
      }

      // Collapse whitespace
      text = text.replace(/\n{3,}/g, "\n\n").trim();

      if (text.length > maxLength) {
        text = text.slice(0, maxLength) + "\n...(truncated)";
      }

      if (!text) {
        return { content: `No readable content found at: ${url}` };
      }

      return { content: `Content from ${url}:\n\n${text}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: `Failed to fetch URL: ${message}`,
        isError: true,
      };
    }
  }

  private stripHtml(html: string): string {
    // Remove script and style blocks entirely
    let text = html.replace(
      /<script[\s\S]*?<\/script>/gi,
      "",
    );
    text = text.replace(
      /<style[\s\S]*?<\/style>/gi,
      "",
    );

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, "");

    // Replace block-level tags with newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
    text = text.replace(/<(br|hr)[^>]*\/?>/gi, "\n");

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode common HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    return text;
  }
}
