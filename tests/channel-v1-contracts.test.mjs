import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const contracts = fs.readFileSync(path.resolve("packages/passport-contracts/src/index.ts"), "utf8");
const config = fs.readFileSync(path.resolve("packages/passport-core/src/channel-config.ts"), "utf8");
const bridgeRoute = fs.readFileSync(path.resolve("apps/passport-web/app/api/v1/channel/session/bridge/route.ts"), "utf8");
const exchangeRoute = fs.readFileSync(path.resolve("apps/passport-web/app/api/v1/channel/session/exchange/route.ts"), "utf8");
const verifyRoute = fs.readFileSync(path.resolve("apps/passport-web/app/api/v1/channel/certificates/verify/[code]/route.ts"), "utf8");
const sdk = fs.readFileSync(path.resolve("packages/passport-sdk/src/index.ts"), "utf8");

test("v1 contracts enumerate stable errors and strict minimum-disclosure response", () => {
  for (const code of ["UNAUTHENTICATED", "INVALID_REQUEST", "INVALID_BRIDGE_TOKEN", "CHANNEL_DISABLED", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"]) assert.match(contracts, new RegExp(`"${code}"`));
  assert.match(contracts, /PublicCertificateStatusSchema/);
  assert.doesNotMatch(contracts, /holderEmail|queryCount|issueId|verificationCount/);
});

test("v1 channel configuration defaults disabled and rejects malformed prefixes", () => {
  assert.match(config, /enabledValue === "true"/);
  assert.match(config, /prefixesMalformed/);
  assert.match(config, /isLocalePrefix/);
});

test("v1 routes gate before service calls and leave legacy routes intact", () => {
  assert.match(bridgeRoute, /resolveChannelConfig\("SHCW"\)/);
  assert.match(bridgeRoute, /getCurrentUser\(\)/);
  assert.match(exchangeRoute, /INVALID_BRIDGE_TOKEN/);
  assert.match(verifyRoute, /SHCW_PUBLIC_API/);
  assert.match(fs.readFileSync(path.resolve("apps/passport-web/app/api/channel/session/bridge/route.ts"), "utf8"), /requireApiUser\(request\)/);
});

test("v1 SDK uses expected credential policies and typed not-found results", () => {
  assert.match(sdk, /issueV1ChannelBridge/);
  assert.match(sdk, /exchangeV1ChannelBridge/);
  assert.match(sdk, /verifyV1ChannelCertificate/);
  assert.match(sdk, /credentials: "include"/);
  assert.match(sdk, /credentials: "omit"/);
  assert.match(sdk, /NOT_FOUND is intentionally HTTP 404/);
});
