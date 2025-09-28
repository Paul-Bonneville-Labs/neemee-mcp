import { LegacyNeemeeClient } from '../dist/index.js';

async function testLegacyClient() {
  console.log('Testing LegacyNeemeeClient...');
  
  try {
    const legacyClient = new LegacyNeemeeClient({
      useStdio: false,
      serverUrl: 'http://localhost:3000/mcp',
      apiKey: 'test-key'
    });

    console.log('✓ Legacy client created successfully');
    
    console.log('Available legacy methods:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(legacyClient));
    console.log('- methods:', methods.filter(m => m !== 'constructor'));
    
    console.log('✓ Legacy compatibility tests passed');
    
  } catch (error) {
    console.error('✗ Legacy test failed:', error.message);
    process.exit(1);
  }
}

testLegacyClient();