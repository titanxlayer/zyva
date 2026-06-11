// Test Cerebras streaming mode (same as route.ts)
// Run with: node --env-file=.env.local scripts/test-cerebras-stream.mjs
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || '';
if (!CEREBRAS_API_KEY) { console.error('Set CEREBRAS_API_KEY (e.g. node --env-file=.env.local ...)'); process.exit(1); }

(async () => {
  try {
    console.log('Testing Cerebras API with streaming...');
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`
      },
      body: JSON.stringify({
        model: 'zai-glm-4.7',
        messages: [
          { role: 'system', content: `You are ZYVA Agent, an AI coding assistant. 
When you create files, use this format:
[ZYVA_FILE: src/App.tsx]
\`\`\`tsx
// full code here
\`\`\`
[/ZYVA_FILE]` },
          { role: 'user', content: 'Create a simple Hello World React component in src/App.tsx' }
        ],
        temperature: 0.3,
        max_tokens: 4096,
        stream: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    console.log('Status:', res.status);

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) fullContent += delta.content;
          } catch {}
        }
      }

      console.log('\n=== FULL AI RESPONSE ===\n');
      console.log(fullContent);
      console.log('\n=== END ===');
      
      // Check if it contains ZYVA_FILE format
      if (fullContent.includes('[ZYVA_FILE:')) {
        console.log('\n✓ Response contains [ZYVA_FILE] tags - will be parsed correctly');
      } else {
        console.log('\n✗ Response does NOT contain [ZYVA_FILE] tags - rescue format will be attempted');
      }
    } else {
      const errText = await res.text();
      console.log('Error:', errText.substring(0, 500));
    }
  } catch (err) {
    console.error('FAILED:', err.message);
  }
})();
