import { NeemeeClient } from '../dist/index.js';

async function testClient() {
  console.log('Testing NeemeeClient...');
  
  try {
    const client = new NeemeeClient({
      transport: 'http',
      baseUrl: 'http://localhost:3000/mcp',
      apiKey: 'test-key'
    });

    console.log('✓ Client created successfully');
    
    console.log('Available methods:');
    console.log('- tools:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.tools)));
    console.log('- resources:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.resources)));
    
    console.log('✓ All tests passed');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testClient();