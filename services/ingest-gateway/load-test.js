const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

// Helper to make POST request
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Generate 100 dummy signals matching the schema
function generateSignalsBatch() {
  const signals = [];
  const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  
  for (let i = 0; i < 100; i++) {
    const type = i % 3 === 0 ? 'LOG' : (i % 3 === 1 ? 'METRIC' : 'TRACE');
    const timestamp = new Date().toISOString();
    const streamId = 'load-test-stream';

    if (type === 'LOG') {
      signals.push({
        type,
        streamId,
        timestamp,
        level: levels[i % levels.length],
        message: `Structured log message number ${i}`,
        attributes: { client: 'load-tester', index: i }
      });
    } else if (type === 'METRIC') {
      signals.push({
        type,
        streamId,
        timestamp,
        name: 'system.cpu.usage',
        value: Math.random() * 100,
        unit: '%',
        tags: { core: String(i % 8) }
      });
    } else {
      signals.push({
        type,
        streamId,
        timestamp,
        traceId: `t-${i}-abc123xyz`,
        spanId: `s-${i}-987`,
        operationName: 'HTTP GET /api/v1/resource',
        durationMs: Math.floor(Math.random() * 200),
        status: i % 10 === 0 ? 'ERROR' : 'OK',
        attributes: { path: '/api/v1/resource' }
      });
    }
  }
  return { signals };
}

async function run() {
  console.log('--- PULSEAI LOAD TEST BOOTSTRAP ---');
  
  try {
    // 1. Create Project
    console.log('Creating load test project...');
    const projectRes = await post('/projects', { name: 'Load Test Project' });
    if (!projectRes.success || !projectRes.data) {
      throw new Error(`Failed to create project: ${JSON.stringify(projectRes)}`);
    }
    const projectId = projectRes.data.id;
    console.log(`Created Project ID: ${projectId}`);

    // 2. Generate API Key
    console.log('Generating load test API Key...');
    const keyRes = await post(`/projects/${projectId}/keys`, {});
    if (!keyRes.success || !keyRes.data) {
      throw new Error(`Failed to generate API Key: ${JSON.stringify(keyRes)}`);
    }
    const apiKey = keyRes.data.key;
    console.log(`Generated API Key: ${apiKey}`);

    // 3. Run Autocannon Load Test
    console.log('\nStarting Autocannon Load Test (500 req/s, 100 signals/batch, 10s dur)...');
    
    const bodyStr = JSON.stringify(generateSignalsBatch());
    
    // Command line args: npx autocannon -c 10 -d 10 -r 500 -m POST -H "X-API-Key=..." -H "Content-Type=application/json" -b "..." http://localhost:3000/ingest
    const args = [
      'autocannon',
      '-c', '10',          // 10 concurrent connections
      '-d', '10',          // 10 seconds duration
      '-r', '500',         // Rate: 500 requests per second
      '-m', 'POST',
      '-H', `X-API-Key=${apiKey}`,
      '-H', 'Content-Type: application/json',
      '-b', bodyStr,
      `http://${HOST}:${PORT}/ingest`
    ];

    const autocannon = spawn('npx', args);

    autocannon.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    autocannon.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    autocannon.on('close', (code) => {
      console.log(`\nAutocannon finished with exit code ${code}`);
      process.exit(code);
    });

  } catch (err) {
    console.error('Load test run failed:', err.message);
    process.exit(1);
  }
}

// Delay startup slightly to let services wake up
setTimeout(run, 1000);
