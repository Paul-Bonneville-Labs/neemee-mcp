import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';

/**
 * MCP-specific authentication without NextAuth dependencies
 * Only supports API key authentication for the MCP server
 */

// Simple in-memory cache for recently validated keys (5 minute TTL)
const keyCache = new Map<string, {
  userId: string;
  scopes: string[];
  keyId: string;
  expiresAt: number;
}>();

/**
 * Validate API key and return user context
 * Optimized with caching and limited database queries
 */
async function validateApiKey(apiKey: string): Promise<{
  userId: string;
  scopes: string[];
  keyId: string;
} | null> {
  try {
    // Check cache first (significant performance improvement for repeated requests)
    const cachedResult = keyCache.get(apiKey);
    if (cachedResult && cachedResult.expiresAt > Date.now()) {
      return {
        userId: cachedResult.userId,
        scopes: cachedResult.scopes,
        keyId: cachedResult.keyId
      };
    }

    // Get active API keys from database
    const apiKeys = await prisma.userApiKey.findMany({
      where: {
        // Only get non-expired keys
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: {
        id: true,
        userId: true,
        keyHash: true,
        scopes: true,
        expiresAt: true,
      }
    });

    // Check each key hash until we find a match
    for (const key of apiKeys) {
      const isMatch = await bcrypt.compare(apiKey, key.keyHash);
      if (isMatch) {
        // Cache the result for 5 minutes to avoid repeated database/bcrypt operations
        keyCache.set(apiKey, {
          userId: key.userId,
          scopes: key.scopes,
          keyId: key.id,
          expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
        });

        // Update last used timestamp (do this async to not block response)
        prisma.userApiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() }
        }).catch(error => {
          console.error('Error updating API key last used timestamp:', error);
        });

        return {
          userId: key.userId,
          scopes: key.scopes,
          keyId: key.id
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Get authentication context from API key (MCP server only)
 */
export async function getMcpAuthContext(apiKey: string): Promise<{
  userId: string; 
  authType: 'api-key';
  scopes: string[];
  keyId: string;
} | null> {
  const apiKeyAuth = await validateApiKey(apiKey);
  if (apiKeyAuth) {
    return {
      userId: apiKeyAuth.userId,
      authType: 'api-key',
      scopes: apiKeyAuth.scopes,
      keyId: apiKeyAuth.keyId
    };
  }
  
  return null;
}

/**
 * Check if user has required scope for API key authentication
 */
export function hasRequiredScope(authContext: { authType: string; scopes?: string[] }, requiredScope: string): boolean {
  // API key auth requires specific scopes
  if (authContext.authType === 'api-key' && authContext.scopes) {
    return authContext.scopes.includes(requiredScope) || authContext.scopes.includes('admin');
  }

  return false;
}

/**
 * Resolve notebook query to notebook ID(s)
 * Supports searching by exact ID, name, or description
 */
export async function resolveNotebook(params: {
  userId: string;
  notebookQuery: string;
}): Promise<string[]> {
  const { userId, notebookQuery } = params;
  
  // Check if the query looks like a CUID (starts with 'cm' and is 25 chars)
  const isCuidFormat = /^cm[a-z0-9]{23}$/.test(notebookQuery);
  
  if (isCuidFormat) {
    // Try to find notebook by exact ID first
    const notebookById = await prisma.notebook.findFirst({
      where: {
        id: notebookQuery,
        userId
      },
      select: { id: true }
    });
    
    if (notebookById) {
      return [notebookById.id];
    }
  }
  
  // Search by name and description (case-insensitive)
  const notebooks = await prisma.notebook.findMany({
    where: {
      userId,
      OR: [
        { name: { contains: notebookQuery, mode: 'insensitive' } },
        { description: { contains: notebookQuery, mode: 'insensitive' } }
      ]
    },
    select: { 
      id: true, 
      name: true,
      description: true 
    },
    orderBy: [
      // Prioritize exact name matches
      { name: 'asc' }
    ]
  });

  // Prioritize exact matches (case-insensitive)
  const exactMatches = notebooks.filter(nb => 
    nb.name.toLowerCase() === notebookQuery.toLowerCase()
  );
  
  if (exactMatches.length > 0) {
    return exactMatches.map(nb => nb.id);
  }
  
  // Return all partial matches
  return notebooks.map(nb => nb.id);
}

/**
 * Build search filters for Prisma note queries with enhanced notebook support
 */
export function buildNoteSearchFilters(params: {
  userId: string;
  search?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
  notebookId?: string;
  notebookIds?: string[];
}): { [key: string]: unknown } {
  const { userId, search, domain, startDate, endDate, notebookId, notebookIds } = params;
  
  const where: { [key: string]: unknown } = {
    userId
  };

  // Add search filter
  if (search) {
    where.OR = [
      { content: { contains: search, mode: 'insensitive' } },
      { noteTitle: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Add domain filter
  if (domain) {
    where.pageUrl = { contains: domain };
  }

  // Add notebook filters
  if (notebookId) {
    where.notebookId = notebookId;
  } else if (notebookIds && notebookIds.length > 0) {
    where.notebookId = { in: notebookIds };
  }

  // Add date filters
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as { [key: string]: unknown }).gte = new Date(startDate);
    }
    if (endDate) {
      (where.createdAt as { [key: string]: unknown }).lte = new Date(endDate);
    }
  }

  return where;
}

/**
 * Build search filters for Prisma notebook queries
 */
export function buildNotebookSearchFilters(params: {
  userId: string;
  search?: string;
}): { [key: string]: unknown } {
  const { userId, search } = params;
  
  const where: { [key: string]: unknown } = {
    userId
  };

  // Add search filter for notebook name and description
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  return where;
}