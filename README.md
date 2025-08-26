# Neemee MCP Server

A Model Context Protocol (MCP) server for the Neemee personal knowledge management system.

## Overview

This MCP server provides Claude Code and other MCP clients with access to your Neemee notes, notebooks, and collections. It supports both reading and writing operations with proper authentication and scoping.

## Features

### Resources
- **Notes List** - Paginated listing of notes with search and filtering
- **Notes Search** - Advanced search across note content and metadata
- **Notebooks List** - List of notebooks with note counts
- **Collections List** - User's note collections
- **Statistics Overview** - Insights about note usage and activity

### Tools
- **create_note** - Create new notes with content and metadata
- **update_note** - Update existing notes
- **delete_note** - Delete notes (admin scope required)
- **search_notes** - Advanced search with notebook filtering
- **search_notebooks** - Search notebooks by name and description

## Installation

### From npm (Recommended)
```bash
npx neemee-mcp-server
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "neemee": {
      "command": "npx",
      "args": ["-y", "neemee-mcp-server"],
      "env": {
        "NEEMEE_API_BASE_URL": "https://your-neemee-instance.com/api",
        "NEEMEE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Configuration

### Environment Variables

- `NEEMEE_API_KEY` (required) - Your Neemee API key
- `NEEMEE_API_BASE_URL` (optional) - Base URL for Neemee API (defaults to http://localhost:3000/api)

### Authentication

The server supports API key authentication with scoped permissions:
- `read` - Access to resources and search tools
- `write` - Create and update operations
- `admin` - Delete operations

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Reference

### Resources

#### Notes List
- URI: `notes://list?page=1&limit=20&search=query&notebook=name`
- Lists notes with pagination and filtering

#### Notes Search  
- URI: `notes://search?query=search_term&notebook=name&limit=20`
- Advanced search across note content

#### Individual Note
- URI: `notes://[note-id]`
- Get specific note by ID

#### Notebooks List
- URI: `notebooks://list?page=1&limit=20&search=query`
- Lists notebooks with search support

#### Collections List
- URI: `collections://list`
- Lists all user collections

#### Statistics
- URI: `stats://overview`
- Overview of note statistics and insights

## License

MIT