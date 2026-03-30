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

If you are behind a corporate proxy or see `SELF_SIGNED_CERT_IN_CHAIN` errors, use the dev variant which disables Node TLS verification:

```bash
npm run serve:dev
```

This starts the streamable HTTP MCP server on port 3132.

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

### geocode-and-map

Geocodes one or more addresses and plots them all as markers on the map in a single call.
This is the preferred tool when the user provides multiple addresses.
By default, new markers are added on top of the existing map (`clearExisting` defaults to `false`).

Input:

```json
{
  "addresses": ["1600 Pennsylvania Ave, Washington DC", "350 Fifth Avenue, New York, NY"],
  "clearExisting": false,
  "color": "#e11d48"
}
```

### view-map

App tool that opens the map UI and renders overlays.
By default, features are added on top of the existing map (`clearExisting` defaults to `false`).

Supported input fields:

- location
- clearExisting (default: false — overlays on existing map)
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

## Docker

### Build and run with Docker

```bash
docker build -t helix-map .
docker run -d -p 3132:3132 --name helix-map helix-map
```

Verify it's running:

```bash
curl http://localhost:3132/health
```

Stop and remove the container:

```bash
docker stop helix-map && docker rm helix-map
```

### Run with Docker Compose

Start the service:

```bash
docker compose up -d
```

Follow logs:

```bash
docker compose logs -f
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

Stop the service:

```bash
docker compose down
```

### Override the port

Both methods respect the `PORT` environment variable (default `3132`).

Docker run:

```bash
docker run -d -p 8080:8080 -e PORT=8080 --name helix-map helix-map
```

Docker Compose — create a `.env` file:

```
PORT=8080
```

Then update `docker-compose.yml` ports to `${PORT:-3132}:${PORT:-3132}` or simply edit the file.

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
