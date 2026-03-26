# Helix Map - Hybrid Web + MCP App

Helix Map is a Leaflet-based interactive map that works both as a **standalone web app** and as an **MCP App** for agent integration.

## 🚀 Quick Start

### Mode 1: Standalone Web App (Demo Mode)

```bash
yarn dev
```

Open **http://localhost:5173/** in your browser. You'll see the map with a demo toolbar where you can:
- Search for locations to geocode
- Add sample landmarks, parks, and routes
- Interact freely with the map

### Mode 2: MCP Tool (Agent Integration)

Build the MCP server and app bundle:

```bash
npm run build
```

Then run the MCP server:

```bash
npm run serve
```

The server will start listening on stdio, ready for MCP hosts (like Claude Desktop) to connect and invoke the `view-map` tool.

## 📋 Architecture

### Standalone Web App (`yarn dev`)
- Runs at `http://localhost:5173/`
- Shows the full demo toolbar with controls
- Can be deployed as a regular web app
- Uses URL query parameters: `?location=Central%20Park`

### MCP App (agent integration)
- Bundled as a single HTML file: `dist/mcp-app.html`
- Served by the MCP server from `dist/server.js`
- No demo toolbar (hidden in MCP mode)
- Agent controls via the `view-map` MCP tool with `location` parameter
- Automatically geocodes location when invoked

## 🔄 Shared Logic

Both modes share the exact same React rendering code. The only difference is:
- **Data source**: Query params (web) vs. MCP tool input (agent)
- **UI mode detection**: `detectMcpMode()` checks for `window.location.origin === 'null'`
- **Toolbar visibility**: Hidden when `isMcpApp` is true

## 🛠️ Build Commands

```bash
# Development
yarn dev              # Start web app on localhost:5173

# Production builds
npm run build:ui      # Build the single-file MCP App HTML
npm run build:server  # Compile the MCP server
npm run build         # Do both

# Run MCP server (after build)
npm run serve         # Start MCP server listening on stdio
```

## 🎯 MCP Tools

### `geocode` (text tool)

Searches OpenStreetMap Nominatim and returns up to 5 matches with coordinates and bounding boxes.

#### Input Schema
```typescript
{
   query: string
   limit?: number // default 5, min 1, max 10
}
```

### `view-map` (app tool)

Displays the interactive map UI and can render geocoded locations plus custom points, lines, polygons, and GeoJSON overlays.

### Input Schema
```typescript
{
   location?: string
   clearExisting?: boolean
   point?: { lat: number; lon: number; title?: string; description?: string; color?: string }
   points?: Array<{ lat: number; lon: number; title?: string; description?: string; color?: string }>
   line?: {
      coordinates: Array<{ lat: number; lon: number }>
      title?: string
      description?: string
      color?: string
      weight?: number
   }
   polygon?: {
      coordinates: Array<{ lat: number; lon: number }>
      title?: string
      description?: string
      color?: string
      fillOpacity?: number
      weight?: number
   }
   geojson?: FeatureCollection
}
```

### Response
- **Text content**: Human-readable status message
- **Structured content**: `{ location?, clearExisting, mapFeatures }` for UI rendering

### Example Agent Usage (Claude mode)

```
Agent: "Show me a map of Tokyo and add two nearby points"
Tool calls:
1) geocode(query="Tokyo", limit=1)
2) view-map(location="Tokyo", points=[...], clearExisting=true)
Response UI: Interactive map with geocoded Tokyo marker and requested overlays
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main React component (shared between both modes) |
| `src/main.tsx` | Entry point (detects MCP mode and initializes) |
| `src/mcp-app.tsx` | MCP initialization logic and context provider |
| `server.ts` | MCP server that registers the tool and resource |
| `mcp-app.html` | Entry point for MCP App build |
| `dist/mcp-app.html` | Generated single-file bundle |
| `dist/server.js` | Generated MCP server executable |

## 🌍 External Dependencies (CSP)

The app makes calls to:
- **Nominatim** (`nominatim.openstreetmap.org`) - Geocoding API
- **OpenStreetMap Tiles** (`tile.openstreetmap.org`) - Map tiles

These are allowed in MCP hosts.

## ✨ Demo Script

Once `yarn dev` is running, open **http://localhost:5173/** and try:

1. **Search a location**: Type "Statue of Liberty" → Click "Search"  
   → Map centers on it with a red pin showing the full name

2. **View landmarks**: Click "Landmarks" button  
   → Adds sample London landmarks to the map

3. **Try other locations**: "Eiffel Tower", "Big Ben", "Colosseum Rome"

4. **Copy the URL** to share the map:  
   → Maps also work with `?location=query` query parameter

## 🤖 How Agents Use This

1. **Claude Desktop calls the tool**:
   ```
   "Can you show me a map of the Taj Mahal?"
   ```

2. **MCP Server invokes tools**:
   ```javascript
   geocode(query="Taj Mahal")
   view-map(location="Taj Mahal", clearExisting=true)
   ```

3. **App receives location, geocodes it, renders map**:
   - Detects MCP mode (origin === "null")
   - Gets location from `ontoolinput` event
   - Calls Nominatim to geocode "Taj Mahal"
   - Centers map with location details

4. **Result shown inline in the agent's context**

## Building for Deployment

### Web App
```bash
npm run build:ui
# Output: dist/mcp-app.html (can be deployed as static file)
```

### MCP Server
```bash
npm run build:server
# Output: dist/server.js (Node.js executable)
```

Then add to Claude Desktop config:
```json
{
  "mcpServers": {
    "helix-map": {
      "command": "node",
      "args": ["/path/to/dist/server.js"]
    }
  }
}
```

## 🔍 Testing

### Web App Tests
- Search locations in the toolbar
- Verify map centers and zooms correctly
- Check popups show location details

### MCP Server Tests
```bash
npm run build
npm run serve

# In another terminal, test with Claude Desktop or send manual MCP messages
```

## 🎨 Customization

### Change the default map center/zoom
Edit `src/types/map.ts`:
```typescript
export const DEFAULT_MAP_CONFIG: MapConfig = {
  center: [20, 0],  // Change these
  zoom: 2,
  // ...
};
```

### Add more demo features
Edit `src/data/sample-features.ts` and add them to the toolbar in `src/App.tsx`.

### Customize geocoding service
The app currently uses OpenStreetMap Nominatim. To change, edit the `performGeocode` function in `src/App.tsx`.

---

**That's it!** Your map app now works both as a standalone web tool and an MCP-integrated agent assistant. 🗺️✨
