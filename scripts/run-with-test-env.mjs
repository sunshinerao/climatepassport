import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearTestMailOutbox, loadIsolatedTestEnvironment } from "./test-environment.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/run-with-test-env.mjs <command> [args...]");
  process.exit(1);
}

let env;
try {
  env = loadIsolatedTestEnvironment(rootDir);
  clearTestMailOutbox(rootDir, env);
} catch (error) {
  console.error(`[test-env] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
  env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`[test-env] Failed to start ${command}: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  clearTestMailOutbox(rootDir, env);
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
