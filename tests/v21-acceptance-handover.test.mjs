/**
 * 源码级测试：CP-TODO-259 联合验收/交接文档与迁移 dry-run（CP-FR-073）
 *
 * 覆盖（文件级断言）：
 * - 能力-测试溯源矩阵：覆盖全部已交付 CP-TODO（240~258）、三层证据列、
 *   scope 反例/撤回并发/故障恢复三节、235 边界声明
 * - 运营/恢复交接手册：环境分层表、责任矩阵六事项、备份恢复 runbook
 *   （先重放标记再开放读取）、监控点、升级边界、密钥、迁移管理
 * - 分 Programme 发布建议：总体判断、发布门禁七项、SHCW/FS/Convener 分述、
 *   不触发部署声明、235 前置
 * - 迁移 dry-run 脚本：隔离环境强制（loadIsolatedTestEnvironment）、scratch 库
 *   强制清理（DROP ... WITH (FORCE)）、migrate deploy + validate
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const traceability = fs.readFileSync("docs/V21_CAPABILITY_TEST_TRACEABILITY.md", "utf8");
const handover = fs.readFileSync("docs/OPERATIONS_RECOVERY_HANDOVER.md", "utf8");
const release = fs.readFileSync("docs/PER_PROGRAMME_RELEASE_RECOMMENDATION.md", "utf8");
const dryRun = fs.readFileSync("scripts/migration-dry-run.mjs", "utf8");

test("traceability matrix covers every delivered CP-TODO with three evidence layers", () => {
  for (const item of ["240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "257", "258"]) {
    assert.ok(traceability.includes(item), `matrix row CP-TODO-${item}`);
  }
  for (const column of ["源码级断言", "真实数据库 API", "浏览器 e2e"]) {
    assert.ok(traceability.includes(column), `evidence column: ${column}`);
  }
  for (const section of ["scope 反例", "撤回并发", "故障恢复", "CP-TODO-235"]) {
    assert.ok(traceability.includes(section), `section: ${section}`);
  }
});

test("operations handover documents environments, responsibilities and recovery runbook", () => {
  for (const section of ["环境分层", "责任矩阵", "备份恢复 runbook", "监控", "支持升级边界", "密钥", "迁移管理"]) {
    assert.ok(handover.includes(section), `handover section: ${section}`);
  }
  for (const duty of ["环境/可用性", "接口契约", "数据责任", "支持升级", "监控", "备份演练"]) {
    assert.ok(handover.includes(duty), `responsibility row: ${duty}`);
  }
  assert.match(handover, /先重放撤回\/删除标记，再开放读取/, "恢复先重放标记再开放读取");
  assert.match(handover, /replay-markers/, "回放端点");
  assert.match(handover, /CP_PRIVACY_REPORT_MIN_CELL/, "小样本阈值审批");
  assert.match(handover, /channel-clients\/\[id\]\/revoke/, "凭据吊销路径");
});

test("release recommendation gates per programme without deployment authorization", () => {
  for (const section of ["发布门禁清单", "SHCW", "Future Stewards", "Convener"]) {
    assert.ok(release.includes(section), `release section: ${section}`);
  }
  for (const gate of ["零 skip", "dry-run", "隐私标记重放", "轮换", "回滚", "保持关闭"]) {
    assert.ok(release.includes(gate), `release gate: ${gate}`);
  }
  assert.match(release, /不触发任何部署|不触发部署/, "no deployment authorization");
  assert.match(release, /CP-TODO-235/, "real-environment acceptance prerequisite");
  assert.match(release, /字节级不变|兼容回归/, "SHCW frozen control");
  assert.match(release, /真实未成年人/, "youth policy gate");
});

test("migration dry-run enforces isolated environment and scratch cleanup", () => {
  assert.match(dryRun, /loadIsolatedTestEnvironment/, "isolated env guard");
  assert.match(dryRun, /migrate", "deploy"/, "full migrate deploy on scratch");
  assert.match(dryRun, /DROP DATABASE IF EXISTS \$\{?scratchName\}? WITH \(FORCE\)/, "scratch database force-dropped");
  assert.match(dryRun, /prisma", "validate"/, "validate after dry-run");
});
