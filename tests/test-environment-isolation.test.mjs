import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadIsolatedTestEnvironment } from "../scripts/test-environment.mjs";

const baseline = [
  "CP_TEST_ENV_ID=climate-passport-isolated-test",
  "CP_TEST_BASE_URL=http://127.0.0.1:3100",
  "NODE_ENV=test",
  "MAIL_TRANSPORT=test-outbox",
  "MAIL_TEST_OUTBOX_PATH=test-results/mail-outbox.jsonl",
].join("\n");

test("test environment never falls back to the development database or inherited project secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cp-test-env-"));
  const previousResend = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "inherited-production-secret";
  try {
    await writeFile(path.join(root, ".env"), "DATABASE_URL=postgresql://dev.example/dev\nDIRECT_URL=postgresql://dev.example/dev\n");
    await writeFile(path.join(root, ".env.test"), `${baseline}\n`);
    assert.throws(() => loadIsolatedTestEnvironment(root), /DATABASE_URL and DIRECT_URL/);

    await writeFile(path.join(root, ".env.test"), `${baseline}\nDATABASE_URL=postgresql://test.example/test\nDIRECT_URL=postgresql://test.example/test\nRESEND_API_KEY=\n`);
    const env = loadIsolatedTestEnvironment(root);
    assert.equal(env.DATABASE_URL, "postgresql://test.example/test");
    assert.equal(env.RESEND_API_KEY, "");
    assert.equal(env.CP_TEST_BASE_URL, "http://127.0.0.1:3100");

    await writeFile(path.join(root, ".env.test"), `${baseline}\nDATABASE_URL=postgresql://dev.example/dev\nDIRECT_URL=postgresql://dev.example/dev\n`);
    assert.throws(() => loadIsolatedTestEnvironment(root), /must not be the same database/);
  } finally {
    if (previousResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousResend;
    await rm(root, { recursive: true, force: true });
  }
});
