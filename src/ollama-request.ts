import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

type OllamaRequestOptions = {
  ollamaHost: string;
  requestBody: unknown;
  inactivityTimeoutMs: number;
  healthCheckIntervalMs?: number;
  healthCheckTimeoutMs?: number;
  maxHealthCheckFailures?: number;
  log?: (message: string) => void;
};

function inferenceTimeoutError(message: string) {
  return Object.assign(new Error(message), { code: 'OLLAMA_INFERENCE_TIMEOUT' });
}

async function checkOllamaHealth(host: string, timeoutMs: number) {
  const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Ollama health check returned HTTP ${response.status}`);
}

export function requestOllamaChat({
  ollamaHost,
  requestBody,
  inactivityTimeoutMs,
  healthCheckIntervalMs = 15000,
  healthCheckTimeoutMs = 5000,
  maxHealthCheckFailures = 3,
  log = console.log,
}: OllamaRequestOptions) {
  const url = new URL(`${ollamaHost}/api/chat`);
  const requestImpl = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const body = JSON.stringify(requestBody);

  return new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
    const startedAt = Date.now();
    let consecutiveHealthCheckFailures = 0;
    let healthCheckRunning = false;
    let settled = false;

    const finish = (
      callback: (value: any) => void,
      value: import('node:http').IncomingMessage | Error
    ) => {
      if (settled) return;
      settled = true;
      clearInterval(waitingTimer);
      callback(value);
    };

    const request = requestImpl(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        log(`Ollama started responding after ${Math.floor((Date.now() - startedAt) / 1000)}s`);
        // A large prompt can legitimately take a long time to evaluate before
        // Ollama sends response headers. Only apply the inactivity timeout once
        // streaming has actually started.
        request.setTimeout(inactivityTimeoutMs, () => {
          request.destroy(
            inferenceTimeoutError(
              `Ollama response stream produced no network activity for ${Math.floor(inactivityTimeoutMs / 1000)} seconds`
            )
          );
        });
        finish(resolve, response);
      }
    );

    const waitingTimer = setInterval(async () => {
      log(
        `Waiting for Ollama to finish prompt evaluation: elapsed=${Math.floor((Date.now() - startedAt) / 1000)}s request-chars=${body.length}`
      );
      if (healthCheckRunning) return;
      healthCheckRunning = true;
      try {
        await checkOllamaHealth(ollamaHost, healthCheckTimeoutMs);
        consecutiveHealthCheckFailures = 0;
      } catch {
        consecutiveHealthCheckFailures += 1;
        if (consecutiveHealthCheckFailures >= maxHealthCheckFailures) {
          request.destroy(
            inferenceTimeoutError(
              `Ollama became unreachable during prompt evaluation after ${maxHealthCheckFailures} consecutive health-check failures`
            )
          );
        }
      } finally {
        healthCheckRunning = false;
      }
    }, healthCheckIntervalMs);

    request.on('error', (error) => finish(reject, error));
    request.end(body);
  });
}
