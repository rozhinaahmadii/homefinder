import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools';
import { countListings } from './db';

// stdout carries the protocol. Log to stderr only, and do not import dotenv here.

function hasError(result: unknown): boolean {
  return typeof result === 'object' && result !== null && 'error' in result;
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'homefinder', version: '0.1.0' });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      (input: unknown) => {
        const result = tool.handler(input);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          isError: hasError(result),
        };
      },
    );
  }

  return server;
}

function hasListings(): boolean {
  try {
    return countListings() > 0;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!hasListings()) {
    console.error('No data. Run: npm run ingest');
    process.exit(1);
  }
  await createMcpServer().connect(new StdioServerTransport());
  console.error('Homefinder MCP server running on stdio');
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
