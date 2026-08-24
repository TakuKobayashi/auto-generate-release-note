import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import { requestOllamaChat } from '../src/ollama-request.js';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
  );
});

async function listen(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address');
  return `http://127.0.0.1:${address.port}`;
}

describe('requestOllamaChat', () => {
  it('does not treat a long, healthy prompt evaluation as stream inactivity', async () => {
    const host = await listen((request, response) => {
      if (request.url === '/api/tags') {
        response.end('{"models":[]}');
        return;
      }
      setTimeout(() => response.end('{"message":{"content":"done"},"done":true}\n'), 120);
    });

    const response = await requestOllamaChat({
      ollamaHost: host,
      requestBody: { model: 'test' },
      inactivityTimeoutMs: 50,
      healthCheckIntervalMs: 20,
      healthCheckTimeoutMs: 20,
      log: () => {},
    });

    let body = '';
    for await (const chunk of response) body += chunk;
    assert.match(body, /done/);
  });

  it('aborts prompt evaluation when Ollama repeatedly fails health checks', async () => {
    const host = await listen((request, response) => {
      if (request.url === '/api/tags') {
        response.writeHead(503).end();
      }
    });

    await assert.rejects(
      requestOllamaChat({
        ollamaHost: host,
        requestBody: { model: 'test' },
        inactivityTimeoutMs: 1000,
        healthCheckIntervalMs: 10,
        healthCheckTimeoutMs: 20,
        maxHealthCheckFailures: 2,
        log: () => {},
      }),
      /became unreachable during prompt evaluation/
    );
  });

  it('times out when a response stream stops making progress', async () => {
    const host = await listen((request, response) => {
      if (request.url === '/api/chat') {
        response.write('{"message":{"content":"partial"}}\n');
      }
    });

    const response = await requestOllamaChat({
      ollamaHost: host,
      requestBody: { model: 'test' },
      inactivityTimeoutMs: 50,
      log: () => {},
    });

    await assert.rejects(async () => {
      for await (const _chunk of response) {
        // Consume the stream until its inactivity timeout aborts it.
      }
    });
  });
});
