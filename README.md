# Helix Map

Helix Map is a hybrid React + Leaflet mapping app that runs in two modes:

- Standalone web app for local browser development
- MCP App for LLM agent tool calls with an interactive UI

## Run Modes

### Standalone Web UI

Start Vite dev server:

```bash
yarn dev --host --port 3132
```

Open http://localhost:3132/

Health endpoint in this mode:

```bash
curl http://localhost:3132/health
```

### MCP Tool + UI Mode

Build and run MCP server:

```bash
npm run build
npm run serve
```

This starts the stdio MCP server used by your MCP host/LLM agent.

Health endpoint in this mode:

```bash
curl http://localhost:3132/health
```

## MCP Tools

### geocode

Searches OpenStreetMap Nominatim and returns coordinates and bounding boxes.

Input:

```json
{
  "query": "Tokyo",
  "limit": 5
}
```

### view-map

App tool that opens the map UI and renders overlays.

Supported input fields:

- location
- clearExisting
- point
- points
- line
- polygon
- geojson

## Agent Call Examples

### 1. Show a geocoded location

Tool: view-map

```json
{
  "location": "Central Park",
  "clearExisting": true
}
```

### 2. Add a single point

Tool: view-map

```json
{
  "clearExisting": true,
  "point": {
    "lat": 38.8895,
    "lon": -77.0353,
    "title": "Lincoln Memorial",
    "description": "Washington, DC",
    "color": "#2563eb"
  }
}
```

### 3. Add multiple points

Tool: view-map

```json
{
  "clearExisting": true,
  "points": [
    {
      "lat": 40.758,
      "lon": -73.9855,
      "title": "Times Square",
      "color": "#e11d48"
    },
    {
      "lat": 40.6892,
      "lon": -74.0445,
      "title": "Statue of Liberty",
      "color": "#16a34a"
    }
  ]
}
```

### 4. Draw a route (LineString)

Tool: view-map

```json
{
  "clearExisting": true,
  "line": {
    "title": "Sample Route",
    "color": "#0ea5e9",
    "weight": 4,
    "coordinates": [
      { "lat": 51.5007, "lon": -0.1246 },
      { "lat": 51.5033, "lon": -0.1195 },
      { "lat": 51.5079, "lon": -0.0877 }
    ]
  }
}
```

### 5. Draw an area (Polygon)

Tool: view-map

```json
{
  "clearExisting": true,
  "polygon": {
    "title": "Area of Interest",
    "description": "Simple polygon example",
    "color": "#22c55e",
    "fillOpacity": 0.3,
    "weight": 2,
    "coordinates": [
      { "lat": 37.789, "lon": -122.42 },
      { "lat": 37.789, "lon": -122.39 },
      { "lat": 37.77, "lon": -122.39 },
      { "lat": 37.77, "lon": -122.42 }
    ]
  }
}
```

### 6. Use geocode then render point from result

Step 1 tool: geocode

```json
{
  "query": "Eiffel Tower",
  "limit": 1
}
```

Step 2 tool: view-map

```json
{
  "clearExisting": true,
  "point": {
    "lat": 48.85837,
    "lon": 2.29448,
    "title": "Eiffel Tower",
    "color": "#f97316"
  }
}
```

## Notes

- Vite dev mode and MCP mode are separate processes.
- For MCP mode, rebuild UI after frontend changes:

```bash
npm run build:ui
```

- Then restart MCP server:

```bash
npm run serve
```
