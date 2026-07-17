import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import test from "node:test";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));

async function reservePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(port: number): Promise<{ statusCode: number; body: string }> {
  const url = `http://127.0.0.1:${port}/api/health`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      return { statusCode: response.status, body: await response.text() };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

async function stop(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function startApi(env: Record<string, string | undefined>): Promise<{
  child: ChildProcessWithoutNullStreams;
  output: () => string;
}> {
  let output = "";
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
  child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  return { child, output: () => output };
}

test("Railway PORT takes precedence, binds all interfaces, and leaves health public", { concurrency: false }, async () => {
  const railwayPort = await reservePort();
  const fallbackPort = await reservePort();
  const api = await startApi({ PORT: String(railwayPort), API_PORT: String(fallbackPort) });
  try {
    const health = await waitForHealth(railwayPort);
    assert.equal(health.statusCode, 200);
    assert.match(health.body, /"ok":true/);
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    assert.match(serverSource, /app\.listen\(\{ port, host: "0\.0\.0\.0" \}\)/);
  } finally {
    await stop(api.child);
  }
});

test("API_PORT is used when Railway PORT is absent", { concurrency: false }, async () => {
  const apiPort = await reservePort();
  const api = await startApi({ PORT: undefined, API_PORT: String(apiPort) });
  try {
    const health = await waitForHealth(apiPort);
    assert.equal(health.statusCode, 200);
  } finally {
    await stop(api.child);
  }
});

test("4000 is the local fallback when neither port variable is provided", { concurrency: false }, async () => {
  const api = await startApi({ PORT: undefined, API_PORT: undefined });
  try {
    const health = await waitForHealth(4000);
    assert.equal(health.statusCode, 200);
  } finally {
    await stop(api.child);
  }
});
