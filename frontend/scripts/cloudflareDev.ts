import { extractTryCloudflareUrl } from "./cloudflareTunnel";

type TunnelProcess = {
  name: string;
  process: ReturnType<typeof Bun.spawn>;
  url: Promise<string>;
};

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? "3000");
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? "8000");
const URL_TIMEOUT_MS = 60_000;

async function forwardLines(
  stream: ReadableStream<Uint8Array> | null,
  prefix: string,
  onLine: (line: string) => void
): Promise<void> {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        console.log(`${prefix} ${line}`);
      }
      onLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    console.log(`${prefix} ${buffer}`);
  }
  if (buffer) {
    onLine(buffer);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function startTunnel(name: string, port: number): TunnelProcess {
  let resolveUrl!: (value: string) => void;
  let rejectUrl!: (reason?: unknown) => void;
  let foundUrl = false;

  const url = new Promise<string>((resolve, reject) => {
    resolveUrl = resolve;
    rejectUrl = reject;
  });

  const tunnelProcess = Bun.spawn({
    cmd: ["cloudflared", "tunnel", "--url", `http://localhost:${port}`],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: process.env,
  });

  const onLine = (line: string) => {
    if (foundUrl) return;
    const maybeUrl = extractTryCloudflareUrl(line);
    if (maybeUrl) {
      foundUrl = true;
      resolveUrl(maybeUrl);
    }
  };

  void forwardLines(tunnelProcess.stdout, `[${name}]`, onLine);
  void forwardLines(tunnelProcess.stderr, `[${name}]`, onLine);

  void tunnelProcess.exited.then((exitCode) => {
    if (!foundUrl) {
      rejectUrl(new Error(`${name} exited before exposing a trycloudflare URL (code ${exitCode}).`));
    }
  });

  return { name, process: tunnelProcess, url };
}

function killProcess(proc: ReturnType<typeof Bun.spawn>): void {
  if (proc.killed) return;
  try {
    proc.kill("SIGTERM");
  } catch {
    // Ignore cleanup errors.
  }
}

function ensureCloudflaredInstalled(): void {
  const result = Bun.spawnSync({
    cmd: ["cloudflared", "--version"],
    stdout: "ignore",
    stderr: "ignore",
  });

  if (result.exitCode !== 0) {
    throw new Error("cloudflared is not installed or not on PATH.");
  }
}

async function main(): Promise<number> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: bun run dev:cloudflare");
    console.log("");
    console.log("Environment overrides:");
    console.log("  FRONTEND_PORT   Local frontend port (default: 3000)");
    console.log("  BACKEND_PORT    Local backend port (default: 8000)");
    return 0;
  }

  ensureCloudflaredInstalled();

  console.log(`[cloudflare-dev] Starting frontend tunnel on http://localhost:${FRONTEND_PORT}`);
  console.log(`[cloudflare-dev] Starting backend tunnel on http://localhost:${BACKEND_PORT}`);

  const frontendTunnel = startTunnel("frontend-tunnel", FRONTEND_PORT);
  const backendTunnel = startTunnel("backend-tunnel", BACKEND_PORT);

  let devProcess: ReturnType<typeof Bun.spawn> | null = null;
  let cleaningUp = false;

  const cleanup = () => {
    if (cleaningUp) return;
    cleaningUp = true;
    killProcess(frontendTunnel.process);
    killProcess(backendTunnel.process);
    if (devProcess) {
      killProcess(devProcess);
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  try {
    const [frontendUrl, backendUrl] = await Promise.all([
      withTimeout(
        frontendTunnel.url,
        URL_TIMEOUT_MS,
        `Timed out waiting for frontend tunnel URL after ${URL_TIMEOUT_MS / 1000}s.`
      ),
      withTimeout(
        backendTunnel.url,
        URL_TIMEOUT_MS,
        `Timed out waiting for backend tunnel URL after ${URL_TIMEOUT_MS / 1000}s.`
      ),
    ]);

    const hmrHost = new URL(frontendUrl).host;

    console.log(`[cloudflare-dev] Frontend tunnel: ${frontendUrl}`);
    console.log(`[cloudflare-dev] Backend tunnel: ${backendUrl}`);
    console.log(`[cloudflare-dev] Launching frontend dev server with tunnel env vars...`);

    devProcess = Bun.spawn({
      cmd: ["bun", "run", "dev"],
      cwd: process.cwd(),
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: {
        ...process.env,
        HMR_HOST: hmrHost,
        VITE_API_URL: backendUrl,
      },
    });

    const exitCode = await devProcess.exited;
    cleanup();
    return exitCode;
  } catch (error) {
    cleanup();
    const message = error instanceof Error ? error.message : "Unknown error while starting cloudflare dev workflow.";
    console.error(`[cloudflare-dev] ${message}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
