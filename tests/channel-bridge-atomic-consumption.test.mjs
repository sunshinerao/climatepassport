import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const authSource = fs.readFileSync(
  path.resolve("apps/passport-web/lib/server/auth.ts"),
  "utf8",
);

test("channel bridge exchange conditionally consumes one-time tokens", () => {
  assert.match(authSource, /channelSessionBridge\.updateMany\(/);
  assert.match(authSource, /consumedAt:\s*null/);
  assert.match(authSource, /expiresAt:\s*\{\s*gt:\s*new Date\(\)\s*\}/);
  assert.match(authSource, /if \(consumed\.count !== 1\)/);
});

test("channel bridge exchange audits successful and rejected replay attempts", () => {
  assert.match(authSource, /result: "REPLAY_REJECTED"/);
  assert.match(authSource, /result: "SUCCESS"/);
  assert.match(authSource, /action: "CHANNEL_BRIDGE_EXCHANGE"/);
});
