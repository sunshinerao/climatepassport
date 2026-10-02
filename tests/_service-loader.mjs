/**
 * 服务源码级测试的加载器：把 apps/passport-web/lib/server 下的 TS 服务
 * 递归转译为 CommonJS 后在 vm 沙箱中执行，相对导入（./xxx）自动级联转译。
 * 沙箱只允许 node: 内置模块；服务不得依赖其他外部包（type-only 导入会被擦除）。
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

export function loadService(entryPath, globals = {}) {
  const cache = new Map();

  function load(resolved) {
    if (cache.has(resolved)) return cache.get(resolved);
    const source = fs.readFileSync(resolved, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    const moduleExports = {};
    const sandbox = {
      exports: moduleExports,
      module: { exports: moduleExports },
      require: (id) => {
        if (id.startsWith(".")) {
          const depPath = path.resolve(path.dirname(resolved), id);
          return load(depPath.endsWith(".ts") ? depPath : `${depPath}.ts`);
        }
        if (id.startsWith("node:")) return require(id);
        throw new Error(`unexpected import in service module: ${id} (from ${resolved})`);
      },
      console,
      Buffer,
      process,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      Date,
      ...globals,
    };
    sandbox.module.exports = sandbox.exports;
    vm.runInNewContext(compiled, sandbox, { filename: resolved });
    cache.set(resolved, sandbox.module.exports);
    return sandbox.module.exports;
  }

  return load(path.resolve(entryPath));
}

/** 极简 Prisma where 匹配器：支持等值（含 Date 按时刻比较）、in、lte/lt/gt/gte、not、AND/OR。 */
export function matchesWhere(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matchesWhere(row, sub));
    if (key === "OR") return condition.some((sub) => matchesWhere(row, sub));
    if (condition !== null && typeof condition === "object") {
      if (condition instanceof Date) {
        return row[key] instanceof Date ? row[key].getTime() === condition.getTime() : row[key] === condition;
      }
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gte" in condition) return row[key] != null && row[key] >= condition.gte;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
      if ("not" in condition) return row[key] !== condition.not;
      return matchesWhere(row[key] ?? {}, condition);
    }
    return row[key] === condition;
  });
}
