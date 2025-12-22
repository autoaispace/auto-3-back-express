// 测试所有 API 端点
const BASE_URL = 'https://inkgeniusapi.digworldai.com';

const endpoints = [
  '/',
  '/health',
  '/api/auth/google',
  '/api/subscribe'
];

async function testEndpoint(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.text();
    
    console.log(`✅ ${endpoint}: ${response.status} ${response.statusText}`);
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const json = JSON.parse(data);
        console.log(`   Response: ${JSON.stringify(json, null, 2).substring(0, 200)}...`);
      } catch (e) {
        console.log(`   Response: ${data.substring(0, 100)}...`);
      }
    } else {
      console.log(`   Response: ${data.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`❌ ${endpoint}: Error - ${error.message}`);
  }
  console.log('');
}

async function testAllEndpoints() {
  console.log(`🧪 Testing API endpoints for ${BASE_URL}\n`);
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('🎉 Testing completed!');
}

testAllEndpoints();