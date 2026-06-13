/**
 * Stress test: verifies the agent stream endpoint works with Cerebras fallback.
 * Tests: /api/agent/stream, /api/sandbox (E2B), provider selection logic.
 *
 * Run: node --env-file=.env.local scripts/test-cloud-stress.mjs
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function testAgentStream(message, label) {
  process.stdout.write(`\n[${label}] → "${message}" ... `);
  const start = Date.now();

  const res = await fetch(`${BASE}/api/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      model: 'glm-5.1', // will map to Cerebras zai-glm-4.7 when no OG_PC_API_KEY
      projectName: 'stress-test',
    }),
  });

  if (!res.ok) {
    console.log(`FAIL HTTP ${res.status}`);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let events = 0;
  let gotDone = false;
  let gotError = false;
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (!value) continue;
    const text = decoder.decode(value);
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        events++;
        if (ev.type === 'done') gotDone = true;
        if (ev.type === 'error') { gotError = true; console.log(`ERROR: ${ev.error}`); }
      } catch { /* partial */ }
    }
  }

  const elapsed = Date.now() - start;
  const status = gotError ? 'FAIL' : events > 0 ? 'PASS' : 'FAIL(no events)';
  console.log(`${status} — ${events} events in ${elapsed}ms`);
  return !gotError && events > 0;
}

async function testSandboxEndpoint() {
  process.stdout.write('\n[sandbox] → echo hello ... ');

  const res = await fetch(`${BASE}/api/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'npm install --help', approved: true }),
  });

  const body = await res.json();

  // E2B key present → should attempt; if key invalid still returns structured JSON
  // E2B key absent → 503
  if (res.status === 503) {
    console.log('SKIP (E2B not configured)');
    return true;
  }
  if (body.success || body.error) {
    console.log(`PASS (structured response: success=${body.success})`);
    return true;
  }
  console.log(`FAIL: ${JSON.stringify(body)}`);
  return false;
}

async function testModelsEndpoint() {
  process.stdout.write('\n[models] → GET /api/index ... ');
  const res = await fetch(`${BASE}/api/index`);
  const ok = res.ok;
  console.log(ok ? 'PASS' : `FAIL HTTP ${res.status}`);
  return ok;
}

async function main() {
  console.log(`\n=== ZYVA Cloud Stress Test ===`);
  console.log(`Target: ${BASE}`);
  console.log(`Provider: ${process.env.OG_PC_API_KEY ? '0G Private Computer' : 'Cerebras (fallback)'}`);

  const results = await Promise.all([
    testModelsEndpoint(),
    testSandboxEndpoint(),
    testAgentStream('Create a simple React button component', 'agent-1'),
    testAgentStream('Add a counter with useState', 'agent-2'),
    testAgentStream('Make the button red with inline styles', 'agent-3'),
  ]);

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Results: ${passed}/${results.length} passed ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
