import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadModule(sourcePath, moduleMocks) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (moduleName) => {
      if (Object.prototype.hasOwnProperty.call(moduleMocks, moduleName)) {
        return moduleMocks[moduleName];
      }
      return require(moduleName);
    },
    URL,
    Request,
    Response,
    Date,
    console,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    crypto,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const SERVICE_PATH = path.resolve("apps/passport-web/lib/server/certificate-batch-issuance.ts");

function buildSeed(overrides = {}) {
  return {
    definitions: [
      {
        id: "def-1",
        name: "Climate Course",
        nameEn: "Climate Course",
        templateId: "tpl-1",
        template: { id: "tpl-1", renderConfigJson: {}, version: 1, isActive: true },
        category: { name: "Course", nameEn: "Course", isActive: true },
        isActive: true,
      },
    ],
    users: [
      { id: "user-1", email: "alice@example.com", name: "Alice" },
      { id: "user-2", email: "bob@example.com", name: "Bob" },
      { id: "user-3", email: "carol@example.com", name: "Carol" },
    ],
    issues: [],
    activities: [
      { id: "act-1", title: "Climate Workshop", titleEn: "Climate Workshop" },
    ],
    participations: [],
    batches: [],
    items: [],
    ...overrides,
  };
}

function createFakePrisma(seed) {
  const state = {
    ...seed,
    notifications: [],
    auditLogs: [],
  };
  let batchSeq = 0;
  let itemSeq = 0;

  function resolveDefinition(id) {
    const found = state.definitions.find((definition) => definition.id === id);
    if (!found) return null;
    return {
      id: found.id,
      name: found.name,
      nameEn: found.nameEn,
      templateId: found.templateId,
      category: { name: found.category.name, nameEn: found.category.nameEn },
    };
  }

  function resolveTemplate(id) {
    const found = state.definitions.find((definition) => definition.templateId === id);
    return found ? { id: found.template.id, renderConfigJson: found.template.renderConfigJson, version: found.template.version } : null;
  }

  function withBatchRelations(batch) {
    if (!batch) return null;
    return {
      ...batch,
      definition: resolveDefinition(batch.definitionId),
      template: resolveTemplate(batch.templateId),
      activity: batch.activityId ? state.activities.find((activity) => activity.id === batch.activityId) ?? null : null,
      createdBy: state.users.find((user) => user.id === batch.createdByUserId) ?? null,
    };
  }

  function matchesItem(item, where = {}) {
    if (where.id && Array.isArray(where.id.in)) {
      if (!where.id.in.includes(item.id)) return false;
    } else if (where.id && item.id !== where.id) {
      return false;
    }
    if (where.batchId && item.batchId !== where.batchId) return false;
    if (where.status && item.status !== where.status) return false;
    if (where.leaseExpiresAt?.lt && !(item.leaseExpiresAt && item.leaseExpiresAt < where.leaseExpiresAt.lt)) return false;
    if (where.OR && !where.OR.some((sub) => matchesItem(item, sub))) return false;
    return true;
  }

  function applyItemData(item, data) {
    if (data.status !== undefined) item.status = data.status;
    if (data.leaseExpiresAt !== undefined) item.leaseExpiresAt = data.leaseExpiresAt;
    if (data.certificateIssueId !== undefined) item.certificateIssueId = data.certificateIssueId;
    if (data.error !== undefined) item.error = data.error;
    if (data.attempts?.increment) item.attempts += data.attempts.increment;
    item.updatedAt = new Date();
  }

  const fake = {
    $transaction: async (callback) => callback(fake),
    certificateBatch: {
      findUnique: async ({ where }) => {
        const batch = where.idempotencyKey
          ? state.batches.find((entry) => entry.idempotencyKey === where.idempotencyKey)
          : state.batches.find((entry) => entry.id === where.id);
        return withBatchRelations(batch);
      },
      findMany: async ({ orderBy, take } = {}) => {
        const sorted = [...state.batches].sort((a, b) => {
          const left = a[orderBy?.createdAt ? "createdAt" : "createdAt"];
          const right = b[orderBy?.createdAt ? "createdAt" : "createdAt"];
          return orderBy?.createdAt === "asc" ? left - right : right - left;
        });
        return sorted.slice(0, take ?? sorted.length).map(withBatchRelations);
      },
      create: async ({ data }) => {
        const id = `batch-${++batchSeq}`;
        const { items: nestedItems, ...batchData } = data;
        state.batches.push({
          ...batchData,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        });
        for (const itemData of nestedItems?.create ?? []) {
          state.items.push({
            ...itemData,
            id: `item-${++itemSeq}`,
            batchId: id,
            status: "PENDING",
            attempts: 0,
            leaseExpiresAt: null,
            certificateIssueId: null,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return { id };
      },
      update: async ({ where, data }) => {
        const batch = state.batches.find((entry) => entry.id === where.id);
        if (!batch) return null;
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) batch[key] = value;
        }
        batch.updatedAt = new Date();
        return batch;
      },
    },
    certificateBatchItem: {
      findMany: async ({ where, orderBy, take } = {}) => {
        const filtered = state.items.filter((item) => matchesItem(item, where));
        if (orderBy?.rowIndex) filtered.sort((a, b) => a.rowIndex - b.rowIndex);
        const sliced = take ? filtered.slice(0, take) : filtered;
        return sliced.map((item) => ({
          ...item,
          certificateIssue: item.certificateIssueId
            ? state.issues.find((issue) => issue.id === item.certificateIssueId) ?? null
            : null,
        }));
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const item of state.items) {
          if (matchesItem(item, where)) {
            applyItemData(item, data);
            count += 1;
          }
        }
        return { count };
      },
      groupBy: async ({ by, where }) => {
        assert.deepEqual([...by], ["status"]);
        const groups = new Map();
        for (const item of state.items.filter((entry) => entry.batchId === where.batchId)) {
          groups.set(item.status, (groups.get(item.status) ?? 0) + 1);
        }
        return [...groups.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
      },
    },
    certificateIssue: {
      findMany: async ({ where }) => state.issues.filter((issue) => {
        if (where.definitionId && issue.definitionId !== where.definitionId) return false;
        if (where.userId?.in && !where.userId.in.includes(issue.userId)) return false;
        return true;
      }),
      findFirst: async ({ where }) => state.issues.find((issue) => {
        if (where.sourceType !== undefined && issue.sourceType !== where.sourceType) return false;
        if (where.sourceId !== undefined && issue.sourceId !== where.sourceId) return false;
        return true;
      }) ?? null,
    },
    certificateDefinition: {
      findFirst: async ({ where }) => {
        const found = state.definitions.find((definition) => definition.templateId === where.templateId);
        return found && found.isActive ? { ...found, template: found.template, category: found.category } : null;
      },
    },
    activity: {
      findUnique: async ({ where }) => state.activities.find((activity) => activity.id === where.id) ?? null,
    },
    activityParticipation: {
      findMany: async ({ where }) => state.participations.filter((participation) => {
        if (participation.activityId !== where.activityId) return false;
        if (where.status?.in && !where.status.in.includes(participation.status)) return false;
        return true;
      }),
    },
    user: {
      findMany: async ({ where }) => state.users.filter((user) => {
        if (where.email?.in) return where.email.in.includes(user.email);
        if (where.id?.in) return where.id.in.includes(user.id);
        return true;
      }),
    },
    notification: {
      create: async ({ data }) => {
        state.notifications.push({ ...data, id: `notification-${state.notifications.length + 1}` });
        return state.notifications[state.notifications.length - 1];
      },
    },
    coreAuditLog: {
      create: async ({ data }) => {
        state.auditLogs.push({ ...data, id: `audit-${state.auditLogs.length + 1}` });
        return state.auditLogs[state.auditLogs.length - 1];
      },
    },
  };

  return { prisma: fake, state };
}

function buildServiceMocks(overrides = {}) {
  const calls = { issuance: [], achievements: [] };
  const failEmails = new Set(overrides.failEmails ?? []);
  const duplicateEmails = new Set(overrides.duplicateEmails ?? []);
  const mocks = {
    "@/lib/server/auth": {
      normalizeUserEmail: (value) => value.trim().toLowerCase(),
    },
    "@/lib/server/achievement-badge": {
      createAchievementRecord: async (input) => {
        calls.achievements.push(input);
        return { id: "achievement-1" };
      },
    },
    "@/lib/server/certificate-issuance": {
      normalizeManualVariableValues: (values) => values ?? {},
      issueCertificateToRecipient: async (_prisma, input) => {
        calls.issuance.push(input);
        const email = input.email.trim().toLowerCase();
        if (failEmails.has(email)) {
          return { ok: false, email, status: 500, error: `Certificate artifact generation failed: render failed for ${email}` };
        }
        if (duplicateEmails.has(email)) {
          return { ok: false, email, status: 409, error: "Duplicate issuance is not allowed for this user and certificate definition.", issueId: "issue-existing", verificationCode: "CV-EXISTING" };
        }
        const userId = `user-${email.split("@")[0]}`;
        return {
          ok: true,
          email,
          issueId: `issue-${email}`,
          verificationCode: "CV-MOCK-1",
          verificationUrl: `${input.verificationUrlBase}/verify/certificate/CV-MOCK-1`,
          fileName: `Course-Climate Course-${email}-CV-MOCK-1.pdf`,
          reissued: false,
          recipient: { id: userId, name: email, normalizedEmail: email, created: false, climatePassportId: null },
          certificateName: "Climate Course",
          categoryName: "Course",
        };
      },
    },
  };

  return { mocks, calls, controls: { failEmails, duplicateEmails } };
}

test("parseCertificateBatchRecipients flags malformed rows and in-list duplicates", async () => {
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const rows = service.parseCertificateBatchRecipients("alice@example.com\nnot-an-email\nALICE@example.com\nbob@example.com, alice@example.com;");

  assert.equal(rows.length, 5);
  assert.deepEqual([...rows.map((row) => row.state)], ["ok", "malformed", "duplicate", "ok", "duplicate"]);
  assert.equal(rows[0].email, "alice@example.com");
  assert.equal(rows[2].email, "alice@example.com");
  assert.equal(rows[3].email, "bob@example.com");
  assert.equal(rows[4].email, "alice@example.com");
});

test("preflight reports duplicates and existing issues for manual lists", async () => {
  const { prisma } = createFakePrisma(buildSeed({
    issues: [
      { id: "issue-existing", definitionId: "def-1", userId: "user-1", verificationCode: "CV-EXISTING", sourceType: "MANUAL", sourceId: null },
    ],
  }));
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const report = await service.preflightCertificateBatch(prisma, {
    templateId: "tpl-1",
    source: "MANUAL_LIST",
    recipients: "alice@example.com\nbad-email\nalice@example.com\nbob@example.com\ncarol@example.com",
  });

  assert.equal(report.ok, true);
  assert.deepEqual([...report.rows.map((row) => row.state)], ["existing_issue", "malformed", "duplicate", "ok", "ok"]);
  assert.equal(report.summary.valid, 2);
  assert.equal(report.summary.malformed, 1);
  assert.equal(report.summary.duplicates, 1);
  assert.equal(report.summary.existingIssues, 1);
  assert.equal(report.recipients.length, 2);
  assert.equal(report.rows[0].issueId, "issue-existing");
});

test("preflight derives the activity eligible list server-side and flags existing issues", async () => {
  const { prisma } = createFakePrisma(buildSeed({
    participations: [
      { activityId: "act-1", userId: "user-1", status: "COMPLETED" },
      { activityId: "act-1", userId: "user-2", status: "CERTIFIED" },
      { activityId: "act-1", userId: "user-3", status: "REGISTERED" },
    ],
    issues: [
      { id: "issue-bob", definitionId: "def-1", userId: "user-2", verificationCode: "CV-BOB", sourceType: "MANUAL", sourceId: null },
    ],
  }));
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const report = await service.preflightCertificateBatch(prisma, {
    templateId: "tpl-1",
    source: "ACTIVITY_ELIGIBLE_LIST",
    activityId: "act-1",
  });

  assert.equal(report.ok, true);
  assert.equal(report.activity.eligibleCount, 2);
  assert.equal(report.activity.alreadyIssuedCount, 1);
  assert.deepEqual(report.activity.users.map((user) => user.state), ["ok", "existing_issue"]);
  assert.equal(report.recipients.length, 1);
  assert.equal(report.recipients[0].email, "alice@example.com");
});

test("createCertificateBatch persists items transactionally and replays idempotently", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-1",
    source: "CSV",
    templateId: "tpl-1",
    recipients: "alice@example.com\nbad\nalice@example.com \nbob@example.com",
    issueDate: "2026-09-18",
    variableValues: { certificateName: "Batch Title" },
    notify: true,
    createdByUserId: "user-1",
  });

  assert.equal(created.ok, true);
  assert.equal(created.status, 201);
  assert.equal(created.replayed, false);
  assert.equal(created.batch.totalCount, 2);
  assert.equal(created.batch.status, "PENDING");
  assert.equal(state.items.length, 2);
  assert.deepEqual(state.items.map((item) => item.normalizedEmail), ["alice@example.com", "bob@example.com"]);
  assert.deepEqual(state.items.map((item) => item.rowIndex), [1, 2]);
  assert.equal(state.notifications.length, 0);

  const replayed = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-1",
    source: "CSV",
    templateId: "tpl-1",
    recipients: "alice@example.com\nbob@example.com",
    createdByUserId: "user-1",
  });

  assert.equal(replayed.ok, true);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.batch.id, created.batch.id);
  assert.equal(state.batches.length, 1, "idempotent replay must not create a second batch");
  assert.equal(state.items.length, 2);
});

test("createCertificateBatch for an activity source derives recipients server-side", async () => {
  const { prisma, state } = createFakePrisma(buildSeed({
    participations: [
      { activityId: "act-1", userId: "user-1", status: "COMPLETED" },
      { activityId: "act-1", userId: "user-2", status: "CERTIFIED" },
    ],
    issues: [
      { id: "issue-bob", definitionId: "def-1", userId: "user-2", verificationCode: "CV-BOB", sourceType: "MANUAL", sourceId: null },
    ],
  }));
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-act",
    source: "ACTIVITY_ELIGIBLE_LIST",
    templateId: "tpl-1",
    // Client-provided recipients must be ignored for this source.
    recipients: "mallory@example.com",
    activityId: "act-1",
    createdByUserId: "user-1",
  });

  assert.equal(created.ok, true);
  assert.equal(created.batch.activityId, "act-1");
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].normalizedEmail, "alice@example.com");
});

test("processCertificateBatchChunk claims a bounded chunk and issues with notifications", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks, calls } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-chunk",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com\nbob@example.com\ncarol@example.com",
    notify: true,
    createdByUserId: "user-1",
  });

  const first = await service.processCertificateBatchChunk(prisma, {
    batchId: created.batch.id,
    limit: 2,
    actorUserId: "user-1",
    verificationUrlBase: "https://passport.example",
  });

  assert.equal(first.ok, true);
  assert.equal(first.processedItems.length, 2);
  assert.equal(first.batch.succeededCount, 2);
  assert.equal(first.batch.status, "PROCESSING");
  assert.equal(calls.issuance.length, 2);
  assert.equal(state.notifications.length, 2, "one in-app notification per newly issued certificate");
  assert.equal(state.items.filter((item) => item.status === "SUCCEEDED").length, 2);

  const second = await service.processCertificateBatchChunk(prisma, {
    batchId: created.batch.id,
    actorUserId: "user-1",
    verificationUrlBase: "https://passport.example",
  });

  assert.equal(second.batch.status, "COMPLETED");
  assert.equal(second.batch.succeededCount, 3);
  assert.equal(second.batch.failedCount, 0);
  assert.equal(state.notifications.length, 3);
  assert.ok(state.auditLogs.some((entry) => entry.action === "certificate.batch_completed"));
});

test("concurrent process calls cannot issue the same item twice", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks, calls } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-race",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com\nbob@example.com",
    notify: false,
    createdByUserId: "user-1",
  });

  const [left, right] = await Promise.all([
    service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" }),
    service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" }),
  ]);

  const processed = [...left.processedItems, ...right.processedItems];
  assert.equal(processed.length, 2, "each item is claimed by exactly one caller");
  assert.equal(calls.issuance.length, 2);
  assert.equal(state.items.filter((item) => item.status === "SUCCEEDED").length, 2);
  assert.equal(new Set(processed.map((item) => item.id)).size, processed.length);

  const detail = await service.getCertificateBatchDetail(prisma, created.batch.id);
  assert.equal(detail.batch.status, "COMPLETED");
});

test("partial failure keeps truthful per-item and aggregate states and retry only reclaims failed items", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks, calls, controls } = buildServiceMocks({ failEmails: ["bob@example.com"] });
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-partial",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com\nbob@example.com",
    notify: true,
    createdByUserId: "user-1",
  });

  const first = await service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" });
  assert.equal(first.batch.status, "COMPLETED_WITH_FAILURES");
  assert.equal(first.batch.succeededCount, 1);
  assert.equal(first.batch.failedCount, 1);
  assert.equal(state.notifications.length, 1);

  const failedItem = state.items.find((item) => item.status === "FAILED");
  assert.ok(failedItem.error.includes("render failed"));

  // A duplicate failure stays failed and retrying it does not touch the succeeded item.
  const succeededBefore = state.items.find((item) => item.status === "SUCCEEDED");
  calls.issuance.length = 0;
  controls.failEmails.clear();
  const retry = await service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, onlyFailed: true, actorUserId: "user-1", verificationUrlBase: "https://passport.example" });

  assert.equal(retry.processedItems.length, 1);
  assert.equal(retry.processedItems[0].id, failedItem.id);
  assert.equal(calls.issuance.length, 1, "retry must not reissue the already succeeded recipient");
  const succeededAfter = state.items.find((item) => item.id === succeededBefore.id);
  assert.equal(succeededAfter.certificateIssueId, succeededBefore.certificateIssueId);
  assert.equal(retry.batch.status, "COMPLETED");
  assert.equal(state.notifications.length, 2);
});

test("reconcile links an existing batch issue instead of issuing a duplicate certificate", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks, calls } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-reconcile",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com",
    notify: true,
    createdByUserId: "user-1",
  });

  const itemId = state.items[0].id;
  // Simulate the failure window: the certificate issue exists, the item is still PENDING.
  state.issues.push({
    id: "issue-crashed",
    definitionId: "def-1",
    userId: "user-1",
    verificationCode: "CV-CRASHED",
    sourceType: "CERTIFICATE_BATCH",
    sourceId: `certificate-batch-item:${itemId}`,
  });

  const result = await service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" });

  assert.equal(result.batch.status, "COMPLETED");
  assert.equal(result.processedItems[0].certificateIssueId, "issue-crashed");
  assert.equal(calls.issuance.length, 0, "reconcile must not run a second issuance");
  assert.equal(state.items[0].certificateIssueId, "issue-crashed");
  assert.equal(state.notifications.length, 1, "reconciled success still notifies exactly once");
  assert.equal(state.issues.length, 1, "no duplicate certificate issue is created");
  assert.ok(state.auditLogs.some((entry) => entry.action === "certificate.batch_item_issued" && entry.metadataJson.reconciled === true));
});

test("notify=false creates zero notifications for issued items", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-quiet",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com",
    notify: false,
    createdByUserId: "user-1",
  });

  const result = await service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" });
  assert.equal(result.batch.status, "COMPLETED");
  assert.equal(state.notifications.length, 0);
});

test("duplicate at processing time marks the item failed with the duplicate message", async () => {
  const { prisma, state } = createFakePrisma(buildSeed());
  const { mocks } = buildServiceMocks({ duplicateEmails: ["alice@example.com"] });
  const service = loadModule(SERVICE_PATH, mocks);

  const created = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-dup",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com",
    notify: true,
    createdByUserId: "user-1",
  });

  const result = await service.processCertificateBatchChunk(prisma, { batchId: created.batch.id, actorUserId: "user-1", verificationUrlBase: "https://passport.example" });
  assert.equal(result.batch.status, "FAILED");
  assert.equal(result.batch.failedCount, 1);
  assert.equal(state.items[0].status, "FAILED");
  assert.ok(state.items[0].error.includes("Duplicate issuance is not allowed"));
  assert.equal(state.notifications.length, 0);
  assert.equal(state.issues.length, 0);
});

test("createCertificateBatch rejects unknown templates, bad dates and empty recipient sets", async () => {
  const { prisma } = createFakePrisma(buildSeed());
  const { mocks } = buildServiceMocks();
  const service = loadModule(SERVICE_PATH, mocks);

  const unknownTemplate = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-bad-tpl",
    source: "MANUAL_LIST",
    templateId: "00000000-0000-0000-0000-000000000000",
    recipients: "alice@example.com",
    createdByUserId: "user-1",
  });
  assert.equal(unknownTemplate.ok, false);
  assert.equal(unknownTemplate.status, 404);

  const badDate = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-bad-date",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "alice@example.com",
    issueDate: "not-a-date",
    createdByUserId: "user-1",
  });
  assert.equal(badDate.ok, false);
  assert.equal(badDate.status, 400);

  const empty = await service.createCertificateBatch(prisma, {
    idempotencyKey: "key-empty",
    source: "MANUAL_LIST",
    templateId: "tpl-1",
    recipients: "bad-email",
    createdByUserId: "user-1",
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.status, 400);
});
