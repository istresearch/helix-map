import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/dist/src/server/index.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "helix-map",
  version: "1.0.0",
});

const resourceUri = "ui://helix-map/app.html";

// Register the tool — agents use this to control the map
registerAppTool(
  server,
  "view-map",
  {
    description:
      "Displays an interactive map. Agents can specify a location to geocode and center the map on it.",
    inputSchema: {
      location: z
        .string()
        .optional()
        .describe("Location to geocode and display (e.g., 'Central Park', 'Paris')"),
    },
    _meta: { ui: { resourceUri } },
  },
  async (args: { location?: string }) => {
    return {
      content: [
        {
          type: "text",
          text: args.location
            ? `Displaying map centered on ${args.location}`
            : "Displaying interactive map",
        },
      ],
      structuredContent: {
        location: args.location,
      },
    };
  },
);

// Register the HTML resource
registerAppResource(
  server,
  "Helix Map",
  resourceUri,
  {
    mimeType: RESOURCE_MIME_TYPE,
  },
  async () => {
    const html = await fs.readFile(
      path.resolve(__dirname, "dist", "mcp-app.html"),
      "utf-8",
    );
    return {
      contents: [
        { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  },
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
