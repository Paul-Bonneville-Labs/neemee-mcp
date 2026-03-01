# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run build` - Build TypeScript to `dist/` (runs `tsc`)
- `npm run dev` - Dev server with hot reload (`NODE_ENV=development tsx src/server.ts`)
- `npm start` - Production server from `dist/server.js`
- `npm test` - Run all tests (client + legacy)
- `npm run test:client` - Test client API (builds first)
- `npm run test:legacy` - Test legacy compatibility (builds first)
- `npm run test:server` - Start dev server with test API key
- `npm run release:patch` / `release:minor` / `release:major` - Bump version, push with tags

## Architecture

This is a **dual-purpose npm package** (`neemee-mcp`) for the Neemee personal knowledge management system:

1. **MCP Server Bridge** (CLI binary via `npx neemee-mcp`) — a thin proxy that connects Claude Code (STDIO transport) to a remote Neemee MCP server (Streamable HTTP transport)
2. **Client Library** (programmatic import) — typed wrappers around MCP tool/resource calls for use in applications

### Server Bridge (`src/server.ts`)

`NeemeeMcpServerBridge` is the CLI entrypoint. It does **no business logic** — it creates an MCP `Client` connected to the remote Neemee server via `StreamableHTTPClientTransport`, then exposes that same interface locally via `StdioServerTransport`. All `listTools`, `listResources`, `readResource`, and `callTool` requests are proxied through to the remote server.

Key details:
- Authentication: injects `Bearer` token via custom fetch wrapper
- Adds `Accept: application/json, text/event-stream` header to bypass Vercel bot protection
- Connection retry with exponential backoff (3 attempts)
- `NODE_ENV=development` defaults to `http://localhost:3000/mcp`, production defaults to `https://neemee.app/mcp`

### Client Library (`src/index.ts` → `src/client.ts`)

`NeemeeClient` wraps the MCP SDK `Client` and exposes:
- `client.tools` (`src/operations/tools.ts`) — typed methods for `create_note`, `update_note`, `delete_note`, `search_notes`, notebook CRUD, `search_notebooks`
- `client.resources` (`src/operations/resources.ts`) — typed methods for `listNotes`, `getNote`, `listNotebooks`, `getNotebook`, `getStats`, `getHealth`, `getRecentActivity`

### Legacy Support (`src/legacy.ts`)

`LegacyNeemeeClient` wraps `NeemeeClient` with the v1.x API surface for backward compatibility. Deprecated.

### Error Hierarchy (`src/errors.ts`)

`NeemeeClientError` base class with subtypes: `AuthenticationError`, `ConnectionError`, `NotFoundError`, `ValidationError`, `ServerError`. All wrap MCP SDK errors with HTTP-style status codes.

## Environment Variables

- `NEEMEE_API_KEY` (required) — API key for authentication
- `NEEMEE_API_BASE_URL` (optional) — overrides the remote MCP server URL
- `NODE_ENV` — set to `development` to use localhost defaults

## Project Configuration

- ESM package (`"type": "module"`) — all imports use `.js` extensions
- TypeScript strict mode, target ES2022, `moduleResolution: "bundler"`
- Source in `src/`, compiled output in `dist/`
- Tests are plain `.js` files in `test/` that run against the built `dist/` output (must build first)
