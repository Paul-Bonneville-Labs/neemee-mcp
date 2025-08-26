# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
- `npm run build` - Build TypeScript to dist/ directory
- `npm run dev` - Run development server with tsx (hot reload)
- `npm start` - Start production server from dist/
- `npm run prepublishOnly` - Build before publishing (runs automatically)

### Package Management
- `npm install` - Install all dependencies
- `npx @paul-bonneville-labs/neemee-mcp-server` - Run published version

## Architecture Overview

This is a **Model Context Protocol (MCP) server** for the Neemee personal knowledge management system. It provides Claude Code and other MCP clients with access to notes, notebooks, and collections through a standardized interface.

### Core Components

**Server Architecture:**
- **Main Server** (`src/server.ts`): Central MCP server implementation with resource/tool handlers
- **Authentication** (`src/lib/mcp-auth.ts`): API key-based authentication with scoped permissions and caching
- **Database Layer**: Prisma ORM with PostgreSQL for data persistence
- **Utilities** (`src/lib/domainUtils.ts`): URL/domain extraction and manipulation

**Data Models (Prisma):**
- **User**: Authentication with OAuth support
- **Note**: Core content with markdown, frontmatter, and URL associations  
- **Notebook**: Organizational containers for grouping notes
- **UserApiKey**: Scoped API keys for MCP access (`read`, `write`, `admin`)
- **Account/Session**: OAuth authentication state
- **UserProfile**: Extended user preferences and metadata

### Key Features

**Resources (Read Access):**
- `notes://list` - Paginated note listing with search/filtering
- `notes://{id}` - Individual note access
- `notebooks://list` - Notebook listing with note counts
- `notebooks://{id}` - Individual notebook details
- `stats://overview` - Usage statistics and insights
- `collections://recent` - Recently created/updated content

**Tools (Write Operations):**
- `create_note`, `update_note`, `delete_note` - Note CRUD operations
- `search_notes` - Advanced search with notebook filtering  
- `create_notebook`, `update_notebook`, `delete_notebook` - Notebook management
- `search_notebooks` - Notebook search functionality

### Authentication & Permissions

**API Key Scopes:**
- `read`: Access to resources and search operations
- `write`: Create and update operations
- `admin`: Delete operations

**Environment Variables:**
- `NEEMEE_API_KEY` (required): API key for authentication
- `DATABASE_URL`: PostgreSQL connection string
- `NEEMEE_API_BASE_URL`: Base URL for Neemee API (optional)

### Database Schema

The Prisma schema supports:
- Multi-user tenancy with user isolation
- Dynamic JSONB frontmatter for extensible metadata
- Hierarchical organization through notebooks
- OAuth authentication flow
- API key management with expiration and usage tracking

### Performance Optimizations

- **API Key Caching**: 5-minute in-memory cache to reduce database/bcrypt operations
- **Efficient Queries**: Optimized Prisma queries with selective field loading
- **Fuzzy Search**: Fallback normalized text matching for better search results
- **Async Operations**: Non-blocking API key usage timestamp updates

## Testing & Validation

No specific test framework is configured. Use the MCP protocol directly or through Claude Desktop for integration testing.

## Database

Uses PostgreSQL with Prisma ORM. The schema is designed to sync with a frontend Neemee application and includes comprehensive user management, content organization, and API access control.