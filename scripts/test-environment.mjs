import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const projectEnvironmentKeys = [
  "DATABASE_URL", "DIRECT_URL", "CLIMATE_PASSPORT_DATABASE_URL", "SHCW_DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "APP_URL", "CP_TEST_BASE_URL", "CP_TEST_ENV_ID",
  "RATE_LIMIT_MODE", "RATE_LIMIT_TRUST_PROXY", "RATE_LIMIT_REST_URL", "RATE_LIMIT_REST_TOKEN", "RATE_LIMIT_REST_TIMEOUT_MS",
  "CERTIFICATE_ARTIFACT_STORAGE", "CERTIFICATE_ARTIFACT_LOCAL_ROOT", "CERTIFICATE_ARTIFACT_HTTP_BASE_URL", "CERTIFICATE_ARTIFACT_HTTP_AUTHORIZATION",
  "CHANNEL_SHCW_ENABLED", "CHANNEL_SHCW_TARGET_PATH_PREFIXES", "CHANNEL_BRIDGE_TARGET_PATH_PREFIXES",
  "AI_CONTENT_ASSIST_ENABLED", "AI_CONTENT_ASSIST_PROVIDER", "AI_CONTENT_ASSIST_MODEL", "AI_CONTENT_ASSIST_OPENAI_API_KEY",
  "RESEND_API_KEY", "MAIL_FROM", "MAIL_TRANSPORT", "MAIL_TEST_OUTBOX_PATH", "EXTERNAL_LEARNING_WEBHOOK_SECRET", "NODE_ENV",
];

function readEnvironmentFile(filePath) {
  return existsSync(filePath) ? parse(readFileSync(filePath)) : {};
}

function databaseIdentity(values) {
  return values.DATABASE_URL || values.CLIMATE_PASSPORT_DATABASE_URL || null;
}

export function loadIsolatedTestEnvironment(rootDir, options = {}) {
  const requireDatabase = options.requireDatabase ?? true;
  const defaults = readEnvironmentFile(path.join(rootDir, ".env.test"));
  const local = readEnvironmentFile(path.join(rootDir, ".env.test.local"));
  const testValues = { ...defaults, ...local };
  const env = { ...process.env };
  for (const key of projectEnvironmentKeys) delete env[key];
  Object.assign(env, testValues);

  if (env.CP_TEST_ENV_ID !== "climate-passport-isolated-test") {
    throw new Error("CP_TEST_ENV_ID must identify the isolated Climate Passport test environment.");
  }
  if (env.NODE_ENV !== "test") {
    throw new Error("The isolated test environment must set NODE_ENV=test.");
  }

  const baseUrl = new URL(env.CP_TEST_BASE_URL || "");
  if (!["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname)) {
    throw new Error("CP_TEST_BASE_URL must target a local test server.");
  }

  if (requireDatabase) {
    const testDatabase = databaseIdentity(testValues);
    if (!testDatabase || !testValues.DIRECT_URL) {
      throw new Error("DATABASE_URL and DIRECT_URL must be configured in .env.test.local before integration tests run.");
    }
    const developmentValues = readEnvironmentFile(path.join(rootDir, ".env"));
    const developmentDatabase = databaseIdentity(developmentValues);
    if (developmentDatabase && developmentDatabase === testDatabase) {
      throw new Error("The test database must not be the same database configured in .env.");
    }
  }

  return env;
}

export function clearTestMailOutbox(rootDir, env) {
  if (env.CP_TEST_ENV_ID !== "climate-passport-isolated-test" || env.MAIL_TRANSPORT !== "test-outbox") return;
  if (!env.MAIL_TEST_OUTBOX_PATH) return;
  rmSync(path.resolve(rootDir, env.MAIL_TEST_OUTBOX_PATH), { force: true });
}
