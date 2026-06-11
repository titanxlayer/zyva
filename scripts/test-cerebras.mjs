// Quick test to verify Cerebras API is responding
// Run with: node --env-file=.env.local scripts/test-cerebras.mjs
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || '';
if (!CEREBRAS_API_KEY) { console.error('Set CEREBRAS_API_KEY (e.g. node --env-file=.env.local ...)'); process.exit(1); }

(async () => {
  try {
    console.log('Testing Cerebras API...');
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`
      },
      body: JSON.stringify({
        model: 'zai-glm-4.7',
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: 'Say hello in one line' }
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(15000),
    });

    console.log('Status:', res.status);
    
    if (res.ok) {
      const data = await res.json();
      console.log('Response:', JSON.stringify(data.choices?.[0]?.message?.content || data, null, 2));
    } else {
      const errText = await res.text();
      console.log('Error body:', errText.substring(0, 500));
    }
  } catch (err) {
    console.error('FAILED:', err.message);
  }
})();
