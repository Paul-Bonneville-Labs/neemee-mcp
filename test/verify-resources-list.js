#!/usr/bin/env node

/**
 * Test script to verify what the frontend MCP server returns for listResources()
 * This helps confirm we're not listing individual notes but using proper resource patterns
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testResourceListing() {
  console.log('Testing MCP Resource Listing Implementation\n');
  console.log('='.repeat(60));

  const apiKey = process.env.NEEMEE_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: NEEMEE_API_KEY environment variable not set');
    process.exit(1);
  }

  // Start the MCP server as a subprocess
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      NEEMEE_API_KEY: apiKey,
      NEEMEE_API_BASE_URL: process.env.NEEMEE_API_BASE_URL || 'https://neemee.app/mcp'
    }
  });

  const client = new Client({
    name: 'resource-list-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    console.log('📡 Connecting to MCP server...\n');
    await client.connect(transport);

    console.log('✅ Connected successfully\n');
    console.log('='.repeat(60));
    console.log('Listing Resources...\n');

    const response = await client.listResources();

    console.log(`📊 Total resources returned: ${response.resources?.length || 0}\n`);

    if (!response.resources || response.resources.length === 0) {
      console.log('⚠️  No resources returned');
    } else {
      console.log('Resources:');
      console.log('-'.repeat(60));

      response.resources.forEach((resource, index) => {
        console.log(`\n${index + 1}. URI: ${resource.uri}`);
        console.log(`   Name: ${resource.name || 'N/A'}`);
        console.log(`   Description: ${resource.description || 'N/A'}`);
        console.log(`   MimeType: ${resource.mimeType || 'N/A'}`);
      });
    }

    // Check for resource templates
    if (response.resourceTemplates && response.resourceTemplates.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`\n📋 Resource Templates found: ${response.resourceTemplates.length}\n`);
      console.log('Templates:');
      console.log('-'.repeat(60));

      response.resourceTemplates.forEach((template, index) => {
        console.log(`\n${index + 1}. URI Template: ${template.uriTemplate}`);
        console.log(`   Name: ${template.name || 'N/A'}`);
        console.log(`   Description: ${template.description || 'N/A'}`);
        console.log(`   MimeType: ${template.mimeType || 'N/A'}`);
      });
    }

    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 Analysis:\n');

    const individualNoteResources = response.resources?.filter(r =>
      r.uri.match(/^notes:\/\/[a-zA-Z0-9-]+$/) && !r.uri.endsWith('/list')
    ) || [];

    if (individualNoteResources.length > 10) {
      console.log(`❌ PROBLEM DETECTED: ${individualNoteResources.length} individual note resources listed`);
      console.log('   This causes excessive requests during resource inspection.');
      console.log('   Individual notes should be accessed via URI templates, not listed.');
    } else if (individualNoteResources.length > 0) {
      console.log(`⚠️  Warning: ${individualNoteResources.length} individual note resource(s) found`);
      console.log('   Small number might be intentional, but verify this is correct.');
    } else {
      console.log('✅ GOOD: No individual notes listed as separate resources');
    }

    const hasListResources = response.resources?.some(r =>
      r.uri === 'notes://list' || r.uri === 'notebooks://list'
    ) || false;

    if (hasListResources) {
      console.log('✅ GOOD: Using list-based resource endpoints');
    } else {
      console.log('⚠️  No list-based resources found (might use templates instead)');
    }

    const hasTemplates = response.resourceTemplates && response.resourceTemplates.length > 0;
    if (hasTemplates) {
      console.log('✅ GOOD: Using resource templates for dynamic access');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await client.close();
      console.log('\n✅ Connection closed\n');
    } catch (closeError) {
      console.error('Error closing connection:', closeError.message);
    }
  }
}

testResourceListing().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
