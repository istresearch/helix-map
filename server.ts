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

// ---- logging helper ----
function log(level: "info" | "warn" | "error", msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data !== undefined) {
    console.log(prefix, msg, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, msg);
  }
}

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
        "Look up raw coordinates for a place name or address using OpenStreetMap Nominatim. " +
        "Returns latitude, longitude, and bounding box data ONLY — does NOT display a map. " +
        "If the user wants to SEE locations on a map, use 'geocode-and-map' instead.",
      inputSchema: {
        query: z
          .string()
          .describe("Place or address to search (e.g., 'Paris', '1600 Pennsylvania Ave')"),
        limit: z.number().int().min(1).max(10).optional().default(5),
      },
    },
    async ({ query, limit }: { query: string; limit?: number }) => {
      log("info", `geocode called: query="${query}" limit=${limit ?? 5}`);
      try {
        const results = await geocodeWithNominatim(query, limit ?? 5);

        if (results.length === 0) {
          log("warn", `geocode: no results for "${query}"`);
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

  // Register geocode-and-map: batch-geocode multiple addresses → render on the map
  registerAppTool(
    server,
    "geocode-and-map",
    {
      description:
        "THE PRIMARY TOOL for showing addresses or place names on a map. " +
        "Accepts one or more raw addresses, geocodes them automatically, and renders all results as markers on a single interactive map. " +
        "Use this tool whenever the user asks to 'show', 'map', 'pin', or 'plot' addresses or places — " +
        "do NOT call 'view-map' or 'geocode' separately for this purpose. " +
        "New markers overlay on the existing map by default (clearExisting defaults to false).",
      inputSchema: {
        addresses: z
          .array(z.string())
          .min(1)
          .describe("One or more addresses or place names to geocode and plot (e.g., ['1600 Pennsylvania Ave', 'Empire State Building'])"),
        clearExisting: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, clear all existing map overlays before adding the new markers."),
        color: z
          .string()
          .optional()
          .describe("Marker colour applied to all points (e.g., '#e11d48'). Each marker can also be given a unique colour via the host agent."),
      },
      _meta: { ui: { resourceUri } },
    },
    async (args: { addresses: string[]; clearExisting?: boolean; color?: string }) => {
      log("info", "geocode-and-map called", { addresses: args.addresses, clearExisting: args.clearExisting });

      const features: MapFeatureCollection["features"] = [];
      const errors: string[] = [];

      // Geocode every address in parallel
      const settled = await Promise.allSettled(
        args.addresses.map(async (addr) => {
          const results = await geocodeWithNominatim(addr, 1);
          const first = results[0];
          if (!first) throw new Error(`No results for "${addr}"`);
          return { addr, result: first };
        }),
      );

      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          const { addr, result } = outcome.value;
          features.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(result.lon), Number(result.lat)],
            },
            properties: {
              title: result.display_name.split(",")[0],
              description: result.display_name,
              color: args.color ?? "#e11d48",
            },
          });
        } else {
          errors.push(outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
          log("warn", "geocode-and-map: geocode failure", outcome.reason);
        }
      }

      const mapFeatures: MapFeatureCollection = { type: "FeatureCollection", features };
      const summary = features.length > 0
        ? `Mapped ${features.length} location(s).${errors.length ? ` ${errors.length} address(es) could not be geocoded.` : ""}`
        : `Could not geocode any of the provided addresses.`;

      log("info", `geocode-and-map result: ${features.length} mapped, ${errors.length} errors`);

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: {
          clearExisting: args.clearExisting ?? false,
          mapFeatures,
          errors: errors.length ? errors : undefined,
        },
      };
    },
  );

  // Register the view-map app tool
  registerAppTool(
    server,
    "view-map",
    {
      description:
        "Renders an interactive map from pre-computed coordinates, GeoJSON, lines, or polygons. " +
        "All inputs must already be numeric lat/lon values — this tool does NOT accept raw addresses or place names. " +
        "If you have addresses or place names instead of coordinates, use 'geocode-and-map' instead. " +
        "New features overlay on the existing map by default (clearExisting defaults to false). " +
        "Set clearExisting to true only when you want to start with a blank map.",
      inputSchema: {
        clearExisting: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, clear all existing map overlays before adding new ones. Defaults to false so new features overlay on the current map."),
        point: z
          .object({
            lat: z.number(),
            lon: z.number(),
            title: z.string().optional(),
            description: z.string().optional(),
            color: z.string().optional(),
          })
          .optional()
          .describe("Single point marker to plot on the map"),
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
          .describe("Multiple point markers to plot. Use this when adding two or more locations so they all appear on the same map."),
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
      log("info", "view-map called", {
        clearExisting: args.clearExisting,
        hasPoint: !!args.point,
        pointsCount: args.points?.length ?? 0,
        hasLine: !!args.line,
        hasPolygon: !!args.polygon,
        hasGeojson: !!args.geojson,
      });
      const mapFeatures = buildFeatureCollection(args);

      return {
        content: [
          {
            type: "text",
            text:
              mapFeatures.features.length > 0
                ? `Displaying map with ${mapFeatures.features.length} feature(s).`
                : "Displaying interactive map.",
          },
        ],
        structuredContent: {
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

  let response: globalThis.Response;
  try {
    response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "helix-map-mcp/1.0",
        "Accept": "application/json",
      },
    });
  } catch (err: unknown) {
    // Surface the real cause (e.g. SELF_SIGNED_CERT_IN_CHAIN) so logs are useful
    const cause = (err as { cause?: Error })?.cause;
    const detail = cause?.message ?? (err instanceof Error ? err.message : String(err));
    log("error", `Nominatim fetch failed: ${detail}`);
    throw new Error(`Nominatim fetch failed: ${detail}`);
  }

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
      tools: ["geocode", "geocode-and-map", "view-map"],
      uptimeSeconds: Math.floor((Date.now() - serviceStartTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // MCP endpoint — stateless, one server per request
  app.all("/mcp", async (req: Request, res: Response) => {
    const method = (req.body as Record<string, unknown>)?.method ?? "unknown";
    const id = (req.body as Record<string, unknown>)?.id ?? null;
    log("info", `→ ${req.method} /mcp  jsonrpc method=${String(method)}  id=${String(id)}`);

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    transport.onerror = (err) => {
      log("error", "Transport error:", err instanceof Error ? err.message : String(err));
    };

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      log("info", `← ${req.method} /mcp  method=${String(method)}  status=${res.statusCode}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.stack ?? error.message : String(error);
      log("error", `MCP handler error for method=${String(method)}:`, errMsg);
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
    log("info", `MCP server listening on http://localhost:${port}/mcp`);
    log("info", `Health endpoint: http://localhost:${port}/health`);
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
