/**
 * 源码级测试：正式活动来源映射执行层（CP-TODO-245 / CP-FR-053）
 *
 * 覆盖（vm/transpile + 内存 Prisma mock；./reliable-dispatch 与
 * ./publication-gateway 在 sandbox require 中 stub，enqueue 调用被收集以断言扇出）：
 * - compareSourceVersions：数字段感知（"2.10" > "2.9"）、缺段、相等
 * - hashBindContent：键序无关的规范序列化
 * - bindSourceActivity：成功+审计；幂等键同内容去重/异内容 409；三元组重复
 *   dedup；同活动第二个来源对象 409；同三元组绑别的活动 409；CP 受控字段/未知
 *   字段 400；programme/activity/edition 校验；并发 P2002 重读 winner 去重
 * - applySourceRevision：白名单字段落库（startTime 转 Date）+审计；同版同内容
 *   幂等；同版异内容 409；旧版本 409 STALE；受控字段/白名单外/未知列 400；
 *   CAS 竞争 409 STALE
 * - publishSourceActivity：正整数字符串校验；dedup/conflict；旧版本 STALE；
 *   撤回版本 PUBLICATION_RESTORE_FORBIDDEN；扇出 payload 只含定位字段无正文
 * - cancelSourceActivity：撤回全部已发布版本 + 活动 CANCELLED + 扇出 + 审计；
 *   幂等（再 cancel cancelled:false、withdrawnVersions:[]）
 * - assertActivityOpenForPublic / listSourceOwnedFieldConflicts /
 *   resolveActivitySourceMapping / listActivityMappings 门与列表语义
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

/** 与 lib/server/publication-gateway.ts 的 canonicalize 语义一致（键序无关哈希）。 */
function canonicalizeForStub(value) {
  if (Array.isArray(value)) return value.map(canonicalizeForStub);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalizeForStub(entry)]),
    );
  }
  return value;
}

function hashProjectionJsonForStub(projectionJson) {
  return createHash("sha256").update(JSON.stringify(canonicalizeForStub(projectionJson))).digest("hex");
}

const enqueueCalls = [];
const dispatchTargetScopes = [];
const dispatchTargets = [
  { id: "sub-1", key: "FSV1SUBA", callbackUrl: "https://sub-a.example/hook" },
  { id: "sub-2", key: "FSV1SUBB", callbackUrl: "https://sub-b.example/hook" },
];

function loadMappingModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/source-activity-mapping.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const stubs = {
    "./reliable-dispatch": {
      enqueueOutboundDispatch: async (_tx, input) => {
        enqueueCalls.push(input);
        return { ok: true, id: `out-${enqueueCalls.length}`, deduplicated: false };
      },
      findDispatchTargets: async (_prisma, scope) => {
        dispatchTargetScopes.push(scope);
        return dispatchTargets;
      },
    },
    "./publication-gateway": {
      hashProjectionJson: (projectionJson) => hashProjectionJsonForStub(projectionJson),
    },
  };
  const sandbox = {
    exports: {},
    module: { exports: {} },
    console,
    Date,
    require: (name) => {
      if (Object.prototype.hasOwnProperty.call(stubs, name)) return stubs[name];
      if (name.startsWith("node:")) return require(name);
      throw new Error(`unexpected import: ${name}`);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const mapping = loadMappingModule();

/** 模块在 vm 新 realm 中运行，其返回的 Object/Array 原型不同，deepStrictEqual 会失败；统一按 JSON 结构比较。 */
function sameJson(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matches(row, sub));
    if (key === "OR") return condition.some((sub) => matches(row, sub));
    if (condition !== null && typeof condition === "object") {
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gte" in condition) return row[key] != null && row[key] >= condition.gte;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
      if ("not" in condition) return row[key] !== condition.not;
    }
    return row[key] === condition;
  });
}

function p2002() {
  const error = new Error("unique violation");
  error.code = "P2002";
  return error;
}

function makeFake({ programmes = [], editions = [], activities = [], mappings = [], publications = [], audits = [] } = {}) {
  const fake = {
    programme: {
      rows: programmes,
      findFirst: async ({ where } = {}) => programmes.find((row) => matches(row, where)) ?? null,
    },
    edition: {
      rows: editions,
      findFirst: async ({ where } = {}) => editions.find((row) => matches(row, where)) ?? null,
    },
    activity: {
      rows: activities,
      findUnique: async ({ where }) => activities.find((row) => matches(row, where)) ?? null,
      update: async ({ where, data }) => {
        const row = activities.find((entry) => matches(entry, where));
        if (!row) throw new Error("activity not found");
        Object.assign(row, data);
        return row;
      },
    },
    sourceObjectMapping: {
      rows: mappings,
      /** 非空时 create 先写入该「并发 winner」行再抛 P2002（模拟唯一索引竞争失败）。 */
      raceWinner: null,
      create: async ({ data }) => {
        if (fake.sourceObjectMapping.raceWinner) {
          mappings.push(fake.sourceObjectMapping.raceWinner);
          fake.sourceObjectMapping.raceWinner = null;
          throw p2002();
        }
        if (mappings.some((row) => row.idempotencyKey && row.idempotencyKey === data.idempotencyKey)) throw p2002();
        if (
          mappings.some(
            (row) =>
              row.sourceSystem === data.sourceSystem &&
              (row.sourceEditionRef ?? "") === (data.sourceEditionRef ?? "") &&
              row.sourceObjectId === data.sourceObjectId,
          )
        ) {
          throw p2002();
        }
        if (
          data.applyStatus === "ACTIVE" &&
          mappings.some((row) => row.activityId === data.activityId && (row.applyStatus ?? "ACTIVE") === "ACTIVE")
        ) {
          throw p2002();
        }
        const row = { id: `map-${mappings.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        mappings.push(row);
        return row;
      },
      // Prisma 返回行快照而非活引用：find* 一律返回浅副本（CAS 依赖读取时的快照值）。
      findUnique: async ({ where }) => {
        const found = where.sourceSystem_sourceEditionRef_sourceObjectId
          ? mappings.find(
              (row) =>
                row.sourceSystem === where.sourceSystem_sourceEditionRef_sourceObjectId.sourceSystem &&
                (row.sourceEditionRef ?? "") === where.sourceSystem_sourceEditionRef_sourceObjectId.sourceEditionRef &&
                row.sourceObjectId === where.sourceSystem_sourceEditionRef_sourceObjectId.sourceObjectId,
            )
          : mappings.find((row) => matches(row, where));
        return found ? { ...found } : null;
      },
      findFirst: async ({ where } = {}) => {
        const found = mappings.find((row) => matches(row, where));
        return found ? { ...found } : null;
      },
      findMany: async ({ where, orderBy, take } = {}) => {
        const rows = mappings.filter((row) => matches(row, where)).map((row) => ({ ...row }));
        if (orderBy?.createdAt) {
          rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
          if (orderBy.createdAt === "desc") rows.reverse();
        }
        return typeof take === "number" ? rows.slice(0, take) : rows;
      },
      updateMany: async ({ where, data }) => {
        const targets = mappings.filter((row) => matches(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    publicationProjection: {
      rows: publications,
      create: async ({ data }) => {
        if (
          publications.some(
            (row) => row.objectType === data.objectType && row.objectId === data.objectId && row.version === data.version,
          )
        ) {
          throw p2002();
        }
        const row = { id: `pub-${publications.length + 1}`, publishedAt: new Date(), withdrawnAt: null, ...data };
        publications.push(row);
        return row;
      },
      findUnique: async ({ where }) => {
        const found = where.objectType_objectId_version
          ? publications.find(
              (row) =>
                row.objectType === where.objectType_objectId_version.objectType &&
                row.objectId === where.objectType_objectId_version.objectId &&
                row.version === where.objectType_objectId_version.version,
            )
          : publications.find((row) => matches(row, where));
        return found ? { ...found } : null;
      },
      findFirst: async ({ where } = {}) => {
        const found = publications.find((row) => matches(row, where));
        return found ? { ...found } : null;
      },
      findMany: async ({ where } = {}) => publications.filter((row) => matches(row, where)).map((row) => ({ ...row })),
      updateMany: async ({ where, data }) => {
        const targets = publications.filter((row) => matches(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    coreAuditLog: {
      rows: audits,
      create: async ({ data }) => {
        const row = { id: `audit-${audits.length + 1}`, createdAt: new Date(), ...data };
        audits.push(row);
        return row;
      },
      findMany: async ({ where } = {}) => audits.filter((row) => matches(row, where)),
    },
  };
  fake.$transaction = async (fn) => fn(fake);
  return fake;
}

function bindInput(overrides = {}) {
  return {
    clientKey: "FSV1CLIENTA",
    programmeId: "prog-1",
    sourceObjectId: "src-activity-1",
    activityId: "act-1",
    authoritativeFields: ["title", "startTime"],
    idempotencyKey: "bind-1",
    ...overrides,
  };
}

function seedBoundFake(overrides = {}) {
  const activities = [{ id: "act-1", title: "Legacy title", status: "PUBLISHED", coverImage: null }];
  const mappings = [
    {
      id: "map-1",
      programmeId: "prog-1",
      editionId: null,
      sourceSystem: "FSV1CLIENTA",
      sourceEditionRef: "",
      sourceObjectId: "src-activity-1",
      activityId: "act-1",
      sourceVersion: null,
      authoritativeFieldsJson: ["title", "startTime", "summary"],
      applyStatus: "ACTIVE",
      idempotencyKey: "bind-1",
      contentHash: "hash-1",
      receiptJson: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ];
  return makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    editions: [{ id: "ed-1", programmeId: "prog-1", isActive: true, archivedAt: null }],
    activities,
    mappings,
    ...overrides,
  });
}

test("compareSourceVersions 数字段感知比较", () => {
  assert.ok(mapping.compareSourceVersions("2.10", "2.9") > 0, '"2.10" 应大于 "2.9"');
  assert.ok(mapping.compareSourceVersions("2.9", "2.10") < 0);
  assert.equal(mapping.compareSourceVersions("2.1", "2.1"), 0);
  assert.equal(mapping.compareSourceVersions("2.09", "2.9"), 0, "前导零数字段按数值相等");
  assert.ok(mapping.compareSourceVersions("1", "1.0") < 0, "缺段视为更小（null 段）");
  assert.ok(mapping.compareSourceVersions("1.0", "1") > 0);
  assert.ok(mapping.compareSourceVersions("v3", "v2") > 0, "非数字段按字典序");
  assert.ok(mapping.compareSourceVersions("2-a", "2-1") > 0, "分隔符 - 与 . 等价且非数字段字典序");
});

test("hashBindContent 键序无关且内容敏感", () => {
  const left = mapping.hashBindContent({ a: 1, b: { c: [1, 2], d: "x" } });
  const right = mapping.hashBindContent({ b: { d: "x", c: [1, 2] }, a: 1 });
  assert.equal(left, right);
  assert.notEqual(left, mapping.hashBindContent({ a: 1, b: { c: [1, 2], d: "y" } }));
  assert.notEqual(left, mapping.hashBindContent({ a: 1, b: { c: [2, 1], d: "x" } }));
});

test("CP_CONTROLLED_ACTIVITY_FIELDS 覆盖 CP 入口/身份字段", () => {
  for (const field of ["status", "slug", "organizerUserId", "registrationOpenAt", "visibility", "type"]) {
    assert.equal(mapping.CP_CONTROLLED_ACTIVITY_FIELDS.has(field), true, `${field} 应受 CP 管控`);
  }
  assert.equal(mapping.CP_CONTROLLED_ACTIVITY_FIELDS.has("title"), false);
});

test("bindSourceActivity 成功落映射与审计", async () => {
  const audits = [];
  const fake = makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    activities: [{ id: "act-1", title: "Legacy title", status: "PUBLISHED" }],
    audits,
  });

  const result = await mapping.bindSourceActivity(fake, bindInput({ authoritativeFields: ["title", "title", "startTime"] }));
  sameJson(result, { mappingId: "map-1", deduplicated: false });

  const row = fake.sourceObjectMapping.rows[0];
  assert.equal(row.applyStatus, "ACTIVE");
  assert.equal(row.sourceSystem, "FSV1CLIENTA");
  assert.equal(row.sourceEditionRef, "");
  assert.equal(row.sourceObjectId, "src-activity-1");
  assert.equal(row.activityId, "act-1");
  sameJson(row.authoritativeFieldsJson, ["title", "startTime"], "白名单应去重");
  assert.equal(typeof row.contentHash, "string");

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "source_mapping.bind");
  assert.equal(audits[0].subjectType, "activity");
  assert.equal(audits[0].subjectId, "act-1");
  assert.equal(audits[0].result, "bound");
  assert.equal(audits[0].metadataJson.sourceObjectId, "src-activity-1");
});

test("bindSourceActivity 幂等键：同内容去重、异内容 409", async () => {
  const fake = makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    activities: [{ id: "act-1", title: "Legacy title", status: "PUBLISHED" }],
  });

  const first = await mapping.bindSourceActivity(fake, bindInput());
  sameJson(first, { mappingId: "map-1", deduplicated: false });

  const replay = await mapping.bindSourceActivity(fake, bindInput());
  sameJson(replay, { mappingId: "map-1", deduplicated: true });
  assert.equal(fake.sourceObjectMapping.rows.length, 1, "去重不得产生新行");

  const conflict = await mapping.bindSourceActivity(fake, bindInput({ sourceObjectId: "src-activity-2" }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, "SOURCE_MAPPING_CONFLICT");
  assert.match(conflict.error, /idempotencyKey/);
});

test("bindSourceActivity 三元组重复绑定同活动去重（不同幂等键）", async () => {
  const fake = makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    activities: [{ id: "act-1", title: "Legacy title", status: "PUBLISHED" }],
  });
  const first = await mapping.bindSourceActivity(fake, bindInput());
  const replay = await mapping.bindSourceActivity(fake, bindInput({ idempotencyKey: "bind-2" }));
  sameJson(replay, { mappingId: first.mappingId, deduplicated: true });
  assert.equal(fake.sourceObjectMapping.rows.length, 1);
});

test("bindSourceActivity 同活动第二个来源对象 409；同三元组绑别的活动 409", async () => {
  const fake = seedBoundFake();
  fake.activity.rows.push({ id: "act-2", title: "Other activity", status: "PUBLISHED" });

  const secondSource = await mapping.bindSourceActivity(fake, bindInput({ idempotencyKey: "bind-2", sourceObjectId: "src-activity-2" }));
  assert.equal(secondSource.status, 409);
  assert.equal(secondSource.code, "SOURCE_MAPPING_CONFLICT");
  assert.match(secondSource.error, /another source object/);

  const otherActivity = await mapping.bindSourceActivity(fake, bindInput({ idempotencyKey: "bind-3", activityId: "act-2" }));
  assert.equal(otherActivity.status, 409);
  assert.equal(otherActivity.code, "SOURCE_MAPPING_CONFLICT");
  assert.match(otherActivity.error, /another activity/);
});

test("bindSourceActivity 白名单校验：CP 受控字段与未知字段一律 400", async () => {
  const fake = seedBoundFake();

  const controlled = await mapping.bindSourceActivity(fake, bindInput({ authoritativeFields: ["title", "status"] }));
  assert.equal(controlled.status, 400);
  assert.equal(controlled.code, "INVALID_REQUEST");
  assert.match(controlled.error, /CP-controlled/);

  const unknown = await mapping.bindSourceActivity(fake, bindInput({ authoritativeFields: ["title", "notAColumn"] }));
  assert.equal(unknown.status, 400);
  assert.equal(unknown.code, "INVALID_REQUEST");
  assert.match(unknown.error, /Unknown activity fields/);
  assert.equal(fake.sourceObjectMapping.rows.length, 1, "400 不得写库");
});

test("bindSourceActivity programme/activity/edition 校验", async () => {
  const fake = seedBoundFake();

  const badProgramme = await mapping.bindSourceActivity(fake, bindInput({ programmeId: "prog-missing" }));
  assert.equal(badProgramme.status, 404);

  const badActivity = await mapping.bindSourceActivity(fake, bindInput({ activityId: "act-missing" }));
  assert.equal(badActivity.status, 404);

  fake.edition.rows.push({ id: "ed-2", programmeId: "prog-2", isActive: true, archivedAt: null });
  const wrongEdition = await mapping.bindSourceActivity(fake, bindInput({ editionId: "ed-2" }));
  assert.equal(wrongEdition.status, 409, "edition 不属于 programme 必须 409");
  assert.match(wrongEdition.error, /Edition/);

  fake.activity.rows.push({ id: "act-9", title: "Ninth activity", status: "PUBLISHED" });
  const okEdition = await mapping.bindSourceActivity(fake, bindInput({ idempotencyKey: "bind-2", sourceObjectId: "src-activity-9", activityId: "act-9", editionId: "ed-1" }));
  sameJson(okEdition, { mappingId: "map-2", deduplicated: false });
  assert.equal(fake.sourceObjectMapping.rows.at(-1).editionId, "ed-1");
});

test("bindSourceActivity 并发 P2002：重读 winner 按幂等语义去重", async () => {
  const input = bindInput();
  const winnerContentHash = mapping.hashBindContent({
    clientKey: input.clientKey,
    programmeId: input.programmeId,
    editionId: null,
    sourceEditionRef: "",
    sourceObjectId: input.sourceObjectId,
    activityId: input.activityId,
    authoritativeFields: [...input.authoritativeFields].sort(),
  });
  const audits = [];
  const fake = makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    activities: [{ id: "act-1", title: "Legacy title", status: "PUBLISHED" }],
    audits,
  });
  // 模拟并发：本请求预检查后、INSERT 前，另一请求以同三元组同内容先提交。
  fake.sourceObjectMapping.raceWinner = {
    id: "map-concurrent",
    programmeId: input.programmeId,
    editionId: null,
    sourceSystem: input.clientKey,
    sourceEditionRef: "",
    sourceObjectId: input.sourceObjectId,
    activityId: input.activityId,
    sourceVersion: null,
    authoritativeFieldsJson: input.authoritativeFields,
    applyStatus: "ACTIVE",
    idempotencyKey: "bind-concurrent",
    contentHash: winnerContentHash,
    receiptJson: null,
    createdAt: new Date(),
  };

  const result = await mapping.bindSourceActivity(fake, input);
  sameJson(result, { mappingId: "map-concurrent", deduplicated: true });
  assert.equal(fake.sourceObjectMapping.rows.length, 1);
  assert.equal(audits.length, 0, "并发失败方不得补写审计");

  // winner 内容不同（如绑到了别的活动/内容）→ 按未声明语义 500，不得静默成功。
  const audits2 = [];
  const fake2 = makeFake({
    programmes: [{ id: "prog-1", isActive: true }],
    activities: [{ id: "act-1", title: "Legacy title", status: "PUBLISHED" }],
    audits: audits2,
  });
  fake2.sourceObjectMapping.raceWinner = {
    ...fake.sourceObjectMapping.raceWinner,
    activityId: "act-other",
    contentHash: "different-hash",
  };
  const failed = await mapping.bindSourceActivity(fake2, input);
  assert.equal(failed.status, 500);
  assert.equal(failed.code, "INTERNAL_ERROR");
});

test("applySourceRevision 成功应用白名单字段（startTime 转 Date）+ 审计", async () => {
  const audits = [];
  const fake = seedBoundFake({ audits });

  const result = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { title: "Revised title", startTime: "2026-11-01T09:00:00.000Z" },
    idempotencyKey: "apply-1",
  });
  sameJson(result, { mappingId: "map-1", applied: true });

  const activity = fake.activity.rows[0];
  assert.equal(activity.title, "Revised title");
  assert.ok(activity.startTime instanceof Date, "startTime 必须转为 Date");
  assert.equal(activity.startTime.getTime(), Date.parse("2026-11-01T09:00:00.000Z"));

  const row = fake.sourceObjectMapping.rows[0];
  assert.equal(row.sourceVersion, "1");
  assert.equal(typeof row.receiptJson.revisionHash, "string");

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "source_mapping.apply");
  assert.equal(audits[0].subjectId, "act-1");
  sameJson(audits[0].metadataJson.fields, ["title", "startTime"]);
});

test("applySourceRevision 同版同内容幂等、同版异内容 409", async () => {
  const audits = [];
  const fake = seedBoundFake({ audits });
  const applyV1 = (title) => ({
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { title, startTime: "2026-11-01T09:00:00.000Z" },
    idempotencyKey: "apply-1",
  });

  const first = await mapping.applySourceRevision(fake, applyV1("Revised title"));
  assert.equal(first.applied, true);

  const replay = await mapping.applySourceRevision(fake, applyV1("Revised title"));
  sameJson(replay, { mappingId: "map-1", applied: false });
  assert.equal(audits.length, 1, "幂等重放不得重复审计");
  assert.equal(fake.activity.rows[0].title, "Revised title");

  const conflict = await mapping.applySourceRevision(fake, applyV1("Tampered title"));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, "SOURCE_MAPPING_CONFLICT");
  assert.equal(fake.activity.rows[0].title, "Revised title", "409 不得落库");
});

test("applySourceRevision 旧版本一律 409 STALE（不覆盖）", async () => {
  const fake = seedBoundFake();
  const apply = (sourceVersion, title) => ({
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion,
    fields: { title },
    idempotencyKey: `apply-${sourceVersion}`,
  });

  const v2 = await mapping.applySourceRevision(fake, apply("2", "Version 2 title"));
  assert.equal(v2.applied, true);
  const v3 = await mapping.applySourceRevision(fake, apply("3", "Version 3 title"));
  assert.equal(v3.applied, true);

  const stale = await mapping.applySourceRevision(fake, apply("2", "Rollback attempt"));
  assert.equal(stale.status, 409);
  assert.equal(stale.code, "SOURCE_MAPPING_STALE");
  assert.equal(fake.activity.rows[0].title, "Version 3 title", "旧版本不得覆盖新状态");
});

test("applySourceRevision 受控字段/白名单外/未知列一律 400", async () => {
  const fake = seedBoundFake();

  const controlled = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { status: "DRAFT" },
    idempotencyKey: "apply-c",
  });
  assert.equal(controlled.status, 400);
  assert.match(controlled.error, /CP-controlled/);

  const offWhitelist = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { capacity: 10 },
    idempotencyKey: "apply-o",
  });
  assert.equal(offWhitelist.status, 400);
  assert.match(offWhitelist.error, /not in the mapping's authoritative whitelist/);

  // 白名单内即使含受控字段也拒（双保险）。
  fake.sourceObjectMapping.rows[0].authoritativeFieldsJson = ["title", "status"];
  const controlledWhitelisted = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { status: "DRAFT" },
    idempotencyKey: "apply-cw",
  });
  assert.equal(controlledWhitelisted.status, 400);
  assert.match(controlledWhitelisted.error, /CP-controlled/);

  // 未知列（历史脏数据出现在白名单）→ 400。
  fake.sourceObjectMapping.rows[0].authoritativeFieldsJson = ["title", "bogusColumn"];
  const unknown = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { bogusColumn: "x" },
    idempotencyKey: "apply-u",
  });
  assert.equal(unknown.status, 400);
  assert.match(unknown.error, /Unknown activity fields/);

  assert.equal(fake.activity.rows[0].status, "PUBLISHED", "400 不得改动活动");
  assert.equal(fake.sourceObjectMapping.rows[0].sourceVersion, null, "400 不得推进版本");
});

test("applySourceRevision CAS 竞争 409 STALE", async () => {
  const fake = seedBoundFake();
  const row = fake.sourceObjectMapping.rows[0];
  row.sourceVersion = "2";
  row.receiptJson = {
    revisionHash: mapping.hashBindContent({ mappingId: row.id, sourceVersion: "2", fields: { title: "Version 2 title" } }),
  };

  const originalTx = fake.$transaction;
  fake.$transaction = async (fn) => {
    // 模拟并发：CAS 前另一请求已把来源版本推进到 "3"。
    row.sourceVersion = "3";
    return fn(fake);
  };
  const stale = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "3",
    fields: { title: "Concurrent advance" },
    idempotencyKey: "apply-cas",
  });
  fake.$transaction = originalTx;

  assert.equal(stale.status, 409);
  assert.equal(stale.code, "SOURCE_MAPPING_STALE");
  assert.match(stale.error, /Concurrent/);
  assert.equal(fake.activity.rows[0].title, "Legacy title", "CAS 失败不得落库");
});

test("applySourceRevision 跨 clientKey 寻址 404", async () => {
  const fake = seedBoundFake();
  const result = await mapping.applySourceRevision(fake, {
    clientKey: "FSV1CLIENTB",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    fields: { title: "Cross tenant write" },
    idempotencyKey: "apply-x",
  });
  assert.equal(result.status, 404);
  assert.equal(result.code, "SOURCE_MAPPING_NOT_FOUND");
});

test("publishSourceActivity 成功发布 + 扇出定位事件 + 审计", async () => {
  enqueueCalls.length = 0;
  dispatchTargetScopes.length = 0;
  const audits = [];
  const fake = seedBoundFake({ audits });
  fake.sourceObjectMapping.rows[0].sourceVersion = "2";

  const marker = "PROJECTION_MARKER_SECRET";
  const result = await mapping.publishSourceActivity(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "2",
    projectionJson: { title: "Public v2", marker },
    channel: "fs-web",
    idempotencyKey: "pub-1",
  });
  assert.equal(result.deduplicated, false);
  assert.equal(typeof result.publicationId, "string");

  const publication = fake.publicationProjection.rows[0];
  assert.equal(publication.objectType, "activity");
  assert.equal(publication.objectId, "act-1");
  assert.equal(publication.version, 2);
  assert.equal(publication.status, "PUBLISHED");
  assert.equal(publication.projectionJson.marker, marker);

  assert.deepEqual(dispatchTargetScopes, ["dispatch:publications"]);
  assert.equal(enqueueCalls.length, 2, "每个订阅者各一条 published 事件");
  for (const call of enqueueCalls) {
    assert.equal(call.eventType, "publication.published");
    assert.equal(call.channelClientId.startsWith("sub-"), true);
    assert.equal(call.revision, 2);
    const payload = call.payload;
    assert.equal(payload.objectType, "activity");
    assert.equal(payload.objectId, "act-1");
    assert.equal(payload.version, 2);
    assert.equal(payload.channel, "fs-web");
    assert.equal(typeof payload.projectionHash, "string");
    assert.equal("projectionJson" in payload, false, "payload 不得含投影正文");
    assert.equal(JSON.stringify(payload).includes(marker), false, "payload 不得泄漏投影正文");
  }

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "source_mapping.publish");
  assert.equal(audits[0].metadataJson.publicationId, result.publicationId);
});

test("publishSourceActivity 同版同内容去重、同版异内容 409", async () => {
  enqueueCalls.length = 0;
  const fake = seedBoundFake();
  const publish = (projectionJson) => ({
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    projectionJson,
    idempotencyKey: "pub-1",
  });

  const first = await mapping.publishSourceActivity(fake, publish({ title: "Public v1", marker: "M1" }));
  assert.equal(first.deduplicated, false);
  assert.equal(enqueueCalls.length, 2);

  const replay = await mapping.publishSourceActivity(fake, publish({ marker: "M1", title: "Public v1" }));
  sameJson(replay, { publicationId: first.publicationId, deduplicated: true });
  assert.equal(fake.publicationProjection.rows.length, 1, "去重不得产生新投影");
  assert.equal(enqueueCalls.length, 2, "去重不得重复扇出");

  const conflict = await mapping.publishSourceActivity(fake, publish({ title: "Tampered projection" }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, "PUBLICATION_CONFLICT");
});

test("publishSourceActivity 版本校验：非正整数字符串 400，旧版本 409 STALE", async () => {
  const fake = seedBoundFake();
  const publish = (sourceVersion) => ({
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion,
    projectionJson: { title: "Public" },
    idempotencyKey: `pub-${sourceVersion}`,
  });

  for (const bad of ["v2", "1.5", "0", "01", "-1", ""]) {
    const result = await mapping.publishSourceActivity(fake, publish(bad));
    assert.equal(result.status, 400, `sourceVersion=${JSON.stringify(bad)} 必须 400`);
    assert.equal(result.code, "INVALID_REQUEST");
  }

  fake.sourceObjectMapping.rows[0].sourceVersion = "3";
  const stale = await mapping.publishSourceActivity(fake, publish("2"));
  assert.equal(stale.status, 409);
  assert.equal(stale.code, "SOURCE_MAPPING_STALE");
});

test("publishSourceActivity 已撤回版本禁止复活（404 寻址与 restore-forbidden）", async () => {
  const fake = seedBoundFake();
  fake.publicationProjection.rows.push({
    id: "pub-withdrawn",
    objectType: "activity",
    objectId: "act-1",
    version: 1,
    projectionJson: { title: "Withdrawn v1" },
    status: "WITHDRAWN",
    publishedAt: new Date(),
    withdrawnAt: new Date(),
  });

  const restore = await mapping.publishSourceActivity(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    projectionJson: { title: "Withdrawn v1" },
    idempotencyKey: "pub-restore",
  });
  assert.equal(restore.status, 409);
  assert.equal(restore.code, "PUBLICATION_RESTORE_FORBIDDEN");

  const notFound = await mapping.publishSourceActivity(fake, {
    clientKey: "FSV1CLIENTB",
    sourceObjectId: "src-activity-1",
    sourceVersion: "1",
    projectionJson: { title: "x" },
    idempotencyKey: "pub-x",
  });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.code, "SOURCE_MAPPING_NOT_FOUND");
});

test("cancelSourceActivity 撤回全部已发布版本 + 取消活动 + 扇出 + 审计", async () => {
  enqueueCalls.length = 0;
  const audits = [];
  const withdrawnAtOriginal = new Date("2026-09-01T00:00:00.000Z");
  const fake = seedBoundFake({ audits });
  fake.publicationProjection.rows.push(
    { id: "pub-1", objectType: "activity", objectId: "act-1", version: 1, projectionJson: { v: 1 }, status: "PUBLISHED", publishedAt: new Date(), withdrawnAt: null },
    { id: "pub-2", objectType: "activity", objectId: "act-1", version: 2, projectionJson: { v: 2 }, status: "PUBLISHED", publishedAt: new Date(), withdrawnAt: null },
    { id: "pub-3", objectType: "activity", objectId: "act-1", version: 3, projectionJson: { v: 3 }, status: "WITHDRAWN", publishedAt: new Date(), withdrawnAt: withdrawnAtOriginal },
  );

  const result = await mapping.cancelSourceActivity(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    reason: "storm cancellation",
    idempotencyKey: "cancel-1",
  });
  assert.equal(result.activityId, "act-1");
  assert.equal(result.cancelled, true);
  assert.deepEqual([...result.withdrawnVersions].sort(), [1, 2]);

  assert.equal(fake.activity.rows[0].status, "CANCELLED");
  const v1 = fake.publicationProjection.rows.find((row) => row.id === "pub-1");
  const v2 = fake.publicationProjection.rows.find((row) => row.id === "pub-2");
  const v3 = fake.publicationProjection.rows.find((row) => row.id === "pub-3");
  assert.equal(v1.status, "WITHDRAWN");
  assert.equal(v2.status, "WITHDRAWN");
  assert.equal(v3.status, "WITHDRAWN");
  assert.equal(v3.withdrawnAt.getTime(), withdrawnAtOriginal.getTime(), "已撤回版本不得被二次撤回");

  const withdrawnEvents = enqueueCalls.filter((call) => call.eventType === "publication.withdrawn");
  const cancelledEvents = enqueueCalls.filter((call) => call.eventType === "activity.cancelled");
  assert.equal(withdrawnEvents.length, 4, "两个版本 × 两个订阅者");
  assert.deepEqual([...new Set(withdrawnEvents.map((call) => call.payload.version))].sort(), [1, 2]);
  for (const call of withdrawnEvents) {
    assert.equal(call.payload.objectType, "activity");
    assert.equal(call.payload.objectId, "act-1");
    assert.equal(call.payload.status, "WITHDRAWN");
    assert.equal("projectionJson" in call.payload, false);
  }
  assert.equal(cancelledEvents.length, 2);
  for (const call of cancelledEvents) {
    assert.equal(call.payload.status, "CANCELLED");
    assert.equal(call.payload.reason, "storm cancellation");
    assert.equal("projectionJson" in call.payload, false);
  }

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "source_mapping.cancel");
  assert.equal(audits[0].subjectId, "act-1");
  assert.deepEqual([...audits[0].metadataJson.withdrawnVersions].sort(), [1, 2]);
});

test("cancelSourceActivity 幂等：已取消活动再 cancel 返回 cancelled:false", async () => {
  enqueueCalls.length = 0;
  const fake = seedBoundFake();
  fake.activity.rows[0].status = "CANCELLED";

  const result = await mapping.cancelSourceActivity(fake, {
    clientKey: "FSV1CLIENTA",
    sourceObjectId: "src-activity-1",
    idempotencyKey: "cancel-2",
  });
  assert.equal(result.cancelled, false);
  sameJson(result.withdrawnVersions, []);
  assert.equal(enqueueCalls.length, 0, "无撤回/无新取消不得扇出");

  const notFound = await mapping.cancelSourceActivity(fake, {
    clientKey: "FSV1CLIENTB",
    sourceObjectId: "src-activity-1",
    idempotencyKey: "cancel-x",
  });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.code, "SOURCE_MAPPING_NOT_FOUND");
});

test("assertActivityOpenForPublic 门矩阵", async () => {
  // 活动不存在 → 404。
  const empty = makeFake({ activities: [] });
  const missing = await mapping.assertActivityOpenForPublic(empty, "act-missing");
  sameJson(missing, { open: false, status: 404, error: "Activity not found.", code: "INVALID_REQUEST" });

  // 未映射活动放行（行为不变）。
  const unmapped = makeFake({ activities: [{ id: "act-0", status: "DRAFT" }] });
  sameJson(await mapping.assertActivityOpenForPublic(unmapped, "act-0"), { open: true });

  const mapped = seedBoundFake();
  mapped.publicationProjection.rows.push({
    id: "pub-1",
    objectType: "activity",
    objectId: "act-1",
    version: 1,
    projectionJson: { title: "Public" },
    status: "PUBLISHED",
    publishedAt: new Date(),
    withdrawnAt: null,
  });
  sameJson(await mapping.assertActivityOpenForPublic(mapped, "act-1"), { open: true });

  mapped.publicationProjection.rows[0].status = "WITHDRAWN";
  const unpublished = await mapping.assertActivityOpenForPublic(mapped, "act-1");
  assert.equal(unpublished.open, false);
  assert.equal(unpublished.status, 409);
  assert.equal(unpublished.code, "ACTIVITY_SOURCE_NOT_PUBLISHED");

  mapped.activity.rows[0].status = "CANCELLED";
  mapped.publicationProjection.rows[0].status = "PUBLISHED";
  const cancelled = await mapping.assertActivityOpenForPublic(mapped, "act-1");
  assert.equal(cancelled.open, false);
  assert.equal(cancelled.code, "ACTIVITY_SOURCE_CANCELLED", "取消优先于已发布投影");
});

test("listSourceOwnedFieldConflicts 与 resolveActivitySourceMapping", async () => {
  const fake = seedBoundFake();

  const unmappedConflicts = await mapping.listSourceOwnedFieldConflicts(fake, "act-0", ["title"]);
  assert.equal(JSON.stringify(unmappedConflicts), "[]");

  const resolvedConflicts = await mapping.resolveActivitySourceMapping(fake, "act-1");
  assert.equal(resolvedConflicts.id, "map-1");
  assert.equal(resolvedConflicts.programmeId, "prog-1");
  assert.equal(JSON.stringify(resolvedConflicts.authoritativeFields), JSON.stringify(["title", "startTime", "summary"]));
  assert.equal(resolvedConflicts.sourceVersion, null);

  assert.equal(JSON.stringify(await mapping.listSourceOwnedFieldConflicts(fake, "act-1", ["title", "capacity"])), JSON.stringify(["title"]));
  assert.equal(JSON.stringify(await mapping.listSourceOwnedFieldConflicts(fake, "act-1", ["capacity", "summary"])), JSON.stringify(["summary"]));
  assert.equal(JSON.stringify(await mapping.listSourceOwnedFieldConflicts(fake, "act-1", ["  ", "capacity"])), "[]");
});

test("listActivityMappings 过滤与倒序", async () => {
  const fake = seedBoundFake();
  fake.sourceObjectMapping.rows.push({
    id: "map-2",
    programmeId: "prog-1",
    editionId: null,
    sourceSystem: "FSV1CLIENTA",
    sourceEditionRef: "",
    sourceObjectId: "src-activity-2",
    activityId: "act-2",
    sourceVersion: null,
    authoritativeFieldsJson: ["title"],
    applyStatus: "ACTIVE",
    idempotencyKey: "bind-2",
    contentHash: "hash-2",
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
  });

  const all = await mapping.listActivityMappings(fake, {});
  assert.equal(JSON.stringify(all.mappings.map((row) => row.id)), JSON.stringify(["map-2", "map-1"]), "默认按 createdAt 倒序");

  const byActivity = await mapping.listActivityMappings(fake, { activityId: "act-1" });
  assert.equal(JSON.stringify(byActivity.mappings.map((row) => row.id)), JSON.stringify(["map-1"]));

  const byProgramme = await mapping.listActivityMappings(fake, { programmeId: "prog-1", take: 1 });
  assert.equal(byProgramme.mappings.length, 1);
});
