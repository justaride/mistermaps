# Mister Maps MCP Pilot

This document outlines the Model Context Protocol (MCP) servers configured for this project. These servers allow AI agents (like Claude Desktop or Cursor) to directly interact with map data, geocoding, and routing services.

## 1. Mapbox MCP Server (Official)

**Source:** `@mapbox/mcp-server`
**Capabilities:** Geocoding, Directions, Static Maps.

### Setup

Prerequisites:
- `MAPBOX_ACCESS_TOKEN` environment variable must be set.

### Configuration (Claude Desktop)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mapbox": {
      "command": "npx",
      "args": ["-y", "@mapbox/mcp-server"],
      "env": {
        "MAPBOX_ACCESS_TOKEN": "pk.eyJ1... (your token)"
      }
    }
  }
}
```

## 2. OpenStreetMap (OSM) MCP Server

**Source:** `github.com/jagan-shanmugam/open-streetmap-mcp` (Python) or similar.
**Selected for Pilot:** `jagan-shanmugam/open-streetmap-mcp` due to broad feature set.

### Setup

```bash
# Clone and run locally if needed, or use npx/uvx if available.
# Since this is a Python server, we recommend using uvx (uv) or pipx.

uvx open-streetmap-mcp
```

### Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "openstreetmap": {
      "command": "uvx",
      "args": ["open-streetmap-mcp"]
    }
  }
}
```

## 3. Supported Agent Workflows

Once connected, you can ask your agent the following:

### Workflow A: Geocoding & Context
> "Find coordinates for 'Oslo Opera House' and show me what's nearby."

**Tools Used:**
- `mapbox_geocode` (or `osm_search`)
- `mapbox_search_nearby`

### Workflow B: Routing Assistant
> "Plan a driving route from Oslo S to Holmenkollen. How long does it take?"

**Tools Used:**
- `mapbox_directions` (returns GeoJSON + duration)
- Agent can then suggest: "I can visualize this in the app using the Route Display pattern."

### Workflow C: Map Data Inspection
> "Get the raw map data for the area around 59.91, 10.75."

**Tools Used:**
- `osm_query` (Overpass API)

## 4. Testing the Pilot

1.  Ensure your `MAPBOX_ACCESS_TOKEN` is valid.
2.  Configure your MCP client (Claude Desktop / Cursor).
3.  Restart the client.
4.  Prompt: "Use the mapbox tool to find the coordinates of 'Mister Maps HQ' (or a real place)."
