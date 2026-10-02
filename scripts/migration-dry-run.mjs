/**
 * CP-TODO-259 / CP-FR-073：迁移 dry-run。
 *
 * 在一次性 scratch 数据库上从空库应用全部迁移，验证：
 * - 全部迁移按顺序干净应用（含回滚失败检测）；
 * - 应用后 prisma validate 通过；
 * - scratch 库事后删除（不留残留）。
 *
 * 连接取 .env.test(.local) 的 DIRECT_URL（管理员连接），scratch 库名带时间戳；
 * 仅本地/隔离环境使用（CP_TEST_ENV_ID 校验），绝不触碰开发与生产库。
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIsolatedTestEnvironment } from "./test-environment.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadIsolatedTestEnvironment(rootDir);

const directUrl = env.DIRECT_URL;
if (!directUrl) throw new Error("DIRECT_URL is required for the migration dry-run.");

const scratchName = `cp_migration_dry_run_${Date.now()}`;
const url = new URL(directUrl);

function runSql(sql) {
  const result = spawnSync("psql", [directUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`psql failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

function scratchUrl() {
  const scratch = new URL(directUrl);
  scratch.pathname = `/${scratchName}`;
  return scratch.toString();
}

async function main() {
  console.log(`[dry-run] creating scratch database ${scratchName} on ${url.host}`);
  runSql(`CREATE DATABASE ${scratchName}`);

  try {
    console.log("[dry-run] applying all migrations from empty");
    const deploy = spawnSync(
      "npx",
      ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
      {
        cwd: rootDir,
        encoding: "utf8",
        env: { ...process.env, ...env, DATABASE_URL: scratchUrl(), DIRECT_URL: scratchUrl() },
      }
    );
    process.stdout.write(deploy.stdout || "");
    process.stderr.write(deploy.stderr || "");
    if (deploy.status !== 0) throw new Error("prisma migrate deploy failed on scratch database");

    const tables = runSql(`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name != '_prisma_migrations'`);
    console.log(`[dry-run] applied; public tables = ${tables}`);

    const validate = spawnSync("npx", ["prisma", "validate", "--schema", "prisma/schema.prisma"], {
      cwd: rootDir,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    if (validate.status !== 0) {
      process.stderr.write(validate.stderr || "");
      throw new Error("prisma validate failed after dry-run");
    }
    console.log("[dry-run] prisma validate passed");
    console.log("[dry-run] OK");
  } finally {
    console.log(`[dry-run] dropping scratch database ${scratchName}`);
    runSql(`DROP DATABASE IF EXISTS ${scratchName} WITH (FORCE)`);
  }
}

main().catch((error) => {
  console.error(`[dry-run] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  try {
    runSql(`DROP DATABASE IF EXISTS ${scratchName} WITH (FORCE)`);
  } catch {
    // best effort cleanup
  }
  process.exit(1);
});
