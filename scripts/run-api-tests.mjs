import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { clearTestMailOutbox, loadIsolatedTestEnvironment } from "./test-environment.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadIsolatedTestEnvironment(rootDir);
clearTestMailOutbox(rootDir, env);
const baseURL = env.CP_TEST_BASE_URL;
const serverUrl = new URL(baseURL);

/** 隔离测试库 outbound_dispatch 历次运行只增不减；分发池超批次会淹没 forceDue 行，前置清空以保证可重复。 */
async function clearOutboundDispatches() {
  const client = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    await client.outboundDispatch.deleteMany();
  } finally {
    await client.$disconnect();
  }
}

async function isServerReady() {
  try {
    const response = await fetch(`${baseURL}/api/auth/session`);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 180_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function testFiles() {
  const requested = process.argv.slice(2);
  if (requested.length) {
    if (requested.some((value) => /[*?{}[\]]/.test(value))) {
      throw new Error("Pass explicit API test file paths; shell globs are intentionally disabled.");
    }
    return requested;
  }
  return readdirSync(path.join(rootDir, "tests/api"))
    .filter((name) => name.endsWith(".test.ts"))
    .sort()
    .map((name) => path.join("tests/api", name));
}

async function main() {
  if (await isServerReady()) {
    throw new Error(`Refusing to reuse an existing server at ${baseURL}. Choose an unused CP_TEST_BASE_URL port.`);
  }

  const nextCli = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  await clearOutboundDispatches();
  const serverProcess = spawn(process.execPath, [nextCli, "dev", "apps/passport-web", "--hostname", serverUrl.hostname, "--port", serverUrl.port], {
    cwd: rootDir,
    stdio: "inherit",
    env,
  });

  try {
    if (!(await waitForServer())) throw new Error("The isolated API test server did not become ready in time.");
    // 限制并行文件数：全部文件共享同一 dev 服务器与数据库连接池，过度并行会触发
    // 瞬时 Prisma/连接超时并被服务的 catch-all 放大成随机 500（真实缺陷会稳定复现）。
    const concurrency = Math.max(1, Math.min(6, Number.parseInt(process.env.CP_API_TEST_CONCURRENCY ?? "4", 10) || 4));
    const testProcess = spawn(process.execPath, ["--test", `--test-concurrency=${concurrency}`, "--import=tsx", ...testFiles()], {
      cwd: rootDir,
      stdio: "inherit",
      env,
    });
    const exitCode = await new Promise((resolve, reject) => {
      testProcess.on("error", reject);
      testProcess.on("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
  } finally {
    serverProcess.kill("SIGTERM");
    clearTestMailOutbox(rootDir, env);
  }
}

main().catch((error) => {
  console.error(`[api-tests] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
