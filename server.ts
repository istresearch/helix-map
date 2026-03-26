import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";

const thisFilePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(thisFilePath);
const DIST_DIR = thisFilePath.endsWith(".ts")
  ? path.join(__dirname, "dist")
  : __dirname;
const serviceStartTime = Date.now();
const port = Number(process.env.PORT ?? 3132);
const healthPort = Number(process.env.HEALTH_PORT ?? port);

const resourceUri = "ui://helix-map/app.html";

function createServer(): McpServer {
  const server = new McpServer({
    name: "helix-map",
    version: "1.0.0",
  });

  // Register geocode tool
  server.registerTool(
    "geocode",
    {
      description:
        "Search for places with OpenStreetMap Nominatim. Returns coordinates and bounding boxes for up to 5 matches.",
      inputSchema: {
        query: z
          .string()
          .describe("Place or address to search (e.g., 'Paris', '1600 Pennsylvania Ave')"),
        limit: z.number().int().min(1).max(10).optional().default(5),
      },
    },
    async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const results = await geocodeWithNominatim(query, limit ?? 5);

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: `No geocoding matches found for \"${query}\".` }],
            structuredContent: { query, results: [] },
          };
        }

        const normalized = results.map((result) => ({
          displayName: result.display_name,
          lat: Number(result.lat),
          lon: Number(result.lon),
          boundingBox: {
            south: Number(result.boundingbox[0]),
            north: Number(result.boundingbox[1]),
            west: Number(result.boundingbox[2]),
            east: Number(result.boundingbox[3]),
          },
        }));

        return {
          content: [{ type: "text", text: `Found ${normalized.length} geocoding result(s) for \"${query}\".` }],
          structuredContent: {
            query,
            results: normalized,
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Geocoding request failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Register the view-map app tool
  registerAppTool(
    server,
    "view-map",
    {
      description:
        "Displays an interactive map. Supports geocoding by location name and adding points, lines, polygons, or GeoJSON features.",
      inputSchema: {
        location: z
          .string()
          .optional()
          .describe("Location to geocode and show on the map (e.g., 'Central Park', 'Paris')"),
        clearExisting: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, clear existing map overlays before adding new ones"),
        point: z
          .object({
            lat: z.number(),
            lon: z.number(),
            title: z.string().optional(),
            description: z.string().optional(),
            color: z.string().optional(),
          })
          .optional()
          .describe("Single point to plot"),
        points: z
          .array(
            z.object({
              lat: z.number(),
              lon: z.number(),
              title: z.string().optional(),
              description: z.string().optional(),
              color: z.string().optional(),
            }),
          )
          .optional()
          .describe("Multiple points to plot"),
        line: z
          .object({
            coordinates: z.array(z.object({ lat: z.number(), lon: z.number() })).min(2),
            title: z.string().optional(),
            description: z.string().optional(),
            color: z.string().optional(),
            weight: z.number().optional(),
          })
          .optional()
          .describe("LineString path to draw"),
        polygon: z
          .object({
            coordinates: z.array(z.object({ lat: z.number(), lon: z.number() })).min(3),
            title: z.string().optional(),
            description: z.string().optional(),
            color: z.string().optional(),
            fillOpacity: z.number().min(0).max(1).optional(),
            weight: z.number().optional(),
          })
          .optional()
          .describe("Polygon boundary to draw"),
        geojson: z
          .any()
          .optional()
          .describe("Optional GeoJSON FeatureCollection to add directly"),
      },
      _meta: { ui: { resourceUri } },
    },
    async (args: {
      location?: string;
      clearExisting?: boolean;
      point?: { lat: number; lon: number; title?: string; description?: string; color?: string };
      points?: Array<{ lat: number; lon: number; title?: string; description?: string; color?: string }>;
      line?: {
        coordinates: Array<{ lat: number; lon: number }>;
        title?: string;
        description?: string;
        color?: string;
        weight?: number;
      };
      polygon?: {
        coordinates: Array<{ lat: number; lon: number }>;
        title?: string;
        description?: string;
        color?: string;
        fillOpacity?: number;
        weight?: number;
      };
      geojson?: MapFeatureCollection;
    }) => {
      const mapFeatures = buildFeatureCollection(args);

      if (args.location) {
        try {
          const geocodeResults = await geocodeWithNominatim(args.location, 1);
          const first = geocodeResults[0];
          if (first) {
            mapFeatures.features.push({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [Number(first.lon), Number(first.lat)],
              },
              properties: {
                title: first.display_name.split(",")[0],
                description: first.display_name,
                color: "#e11d48",
              },
            });
          }
        } catch {
          // Geocoding failure should not block rendering other provided features.
        }
      }

      return {
        content: [
          {
            type: "text",
            text:
              mapFeatures.features.length > 0
                ? `Displaying map with ${mapFeatures.features.length} feature(s).`
                : args.location
                  ? `Displaying map for ${args.location}.`
                  : "Displaying interactive map.",
          },
        ],
        structuredContent: {
          location: args.location,
          clearExisting: args.clearExisting ?? false,
          mapFeatures,
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
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  connectDomains: ["https://*.openstreetmap.org"],
                  resourceDomains: ["https://*.openstreetmap.org"],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}

// --- shared helpers (stateless) ---

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string];
}

type MapFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point" | "LineString" | "Polygon";
      coordinates:
        | [number, number]
        | [number, number][]
        | [number, number][][];
    };
    properties?: Record<string, unknown>;
  }>;
};

async function geocodeWithNominatim(query: string, limit = 5): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "helix-map-mcp/1.0",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  return (await response.json()) as NominatimResult[];
}

function buildFeatureCollection(args: {
  point?: { lat: number; lon: number; title?: string; description?: string; color?: string };
  points?: Array<{ lat: number; lon: number; title?: string; description?: string; color?: string }>;
  line?: {
    coordinates: Array<{ lat: number; lon: number }>;
    title?: string;
    description?: string;
    color?: string;
    weight?: number;
  };
  polygon?: {
    coordinates: Array<{ lat: number; lon: number }>;
    title?: string;
    description?: string;
    color?: string;
    fillOpacity?: number;
    weight?: number;
  };
  geojson?: MapFeatureCollection;
}): MapFeatureCollection {
  const features: MapFeatureCollection["features"] = [];

  if (args.geojson?.features?.length) {
    features.push(...args.geojson.features);
  }

  const allPoints = [
    ...(args.point ? [args.point] : []),
    ...(args.points ?? []),
  ];
  for (const point of allPoints) {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
      properties: {
        title: point.title,
        description: point.description,
        color: point.color,
      },
    });
  }

  if (args.line && args.line.coordinates.length >= 2) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: args.line.coordinates.map(
          (coordinate) => [coordinate.lon, coordinate.lat] as [number, number],
        ),
      },
      properties: {
        title: args.line.title,
        description: args.line.description,
        color: args.line.color,
        weight: args.line.weight,
      },
    });
  }

  if (args.polygon && args.polygon.coordinates.length >= 3) {
    const ring = args.polygon.coordinates.map((coordinate) => [coordinate.lon, coordinate.lat] as [number, number]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!last || last[0] !== first[0] || last[1] !== first[1]) {
      ring.push(first);
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
      properties: {
        title: args.polygon.title,
        description: args.polygon.description,
        color: args.polygon.color,
        fillOpacity: args.polygon.fillOpacity,
        weight: args.polygon.weight,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// --- Server startup ---

async function startStreamableHTTPServer(): Promise<void> {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  // Health endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "helix-map",
      version: "1.0.0",
      tools: ["geocode", "view-map"],
      uptimeSeconds: Math.floor((Date.now() - serviceStartTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // MCP endpoint — stateless, one server per request
  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
    console.log(`Health endpoint: http://localhost:${port}/health`);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function startStdioServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer();
  } else {
    await startStreamableHTTPServer();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
