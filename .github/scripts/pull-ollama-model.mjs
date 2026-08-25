const host = process.env.OLLAMA_HOST_URL?.replace(/\/$/, '');
const model = process.env.OLLAMA_MODEL;

if (!host || !model) {
  throw new Error('OLLAMA_HOST_URL and OLLAMA_MODEL are required');
}

const pullResponse = await fetch(`${host}/api/pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, stream: false }),
});
const pullBody = await pullResponse.text();
let pullResult;
try {
  pullResult = JSON.parse(pullBody);
} catch {
  throw new Error(`Ollama returned invalid model-pull JSON (${pullResponse.status}): ${pullBody}`);
}
if (!pullResponse.ok || pullResult.error || pullResult.status !== 'success') {
  throw new Error(
    `Ollama model pull failed (${pullResponse.status}): ${pullResult.error || pullResult.status || pullBody}`
  );
}
console.log(`Ollama model pull completed: ${pullResult.status}`);

let lastShowBody = '';
for (let attempt = 1; attempt <= 15; attempt += 1) {
  const showResponse = await fetch(`${host}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  lastShowBody = await showResponse.text();
  if (showResponse.ok) {
    try {
      const showResult = JSON.parse(lastShowBody);
      if (!showResult.error) {
        console.log(`Ollama model is ready: ${model}`);
        process.exit(0);
      }
    } catch {}
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

throw new Error(`Ollama model did not become available: ${model}. Last response: ${lastShowBody}`);
