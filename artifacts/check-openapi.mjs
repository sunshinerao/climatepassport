import { readFileSync, readdirSync, statSync } from "node:fs";
import yaml from "js-yaml";

const doc = yaml.load(readFileSync("docs/openapi/v1.yaml", "utf8"));
const problems = [];

const refs = [];
(function walk(node, path) {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" && typeof v === "string") refs.push({ from: path, ref: v });
      walk(v, `${path}.${k}`);
    }
  }
})(doc, "$");

for (const { from, ref } of refs) {
  const target = ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((acc, seg) => (acc ? acc[seg] : undefined), doc);
  if (target === undefined) problems.push(`dangling $ref ${ref} at ${from}`);
}

const seenOperationIds = new Map();
for (const [p, item] of Object.entries(doc.paths)) {
  for (const [method, op] of Object.entries(item)) {
    if (!["get", "post", "patch", "delete", "options"].includes(method)) {
      problems.push(`${p}: unexpected path-item key "${method}"`);
    }
    if (op?.security && method !== "options" && !Array.isArray(op.security)) {
      problems.push(`${p} ${method}: security must be an array`);
    }
    for (const tag of op?.tags ?? []) {
      if (!doc.tags.some((t) => t.name === tag)) problems.push(`${p} ${method}: undeclared tag "${tag}"`);
    }
    if (op?.operationId) {
      if (seenOperationIds.has(op.operationId)) problems.push(`duplicate operationId ${op.operationId}`);
      seenOperationIds.set(op.operationId, p);
    }
  }
}

const declaredSchemas = Object.keys(doc.components.schemas);
const usedSchemas = refs.filter((r) => r.ref.startsWith("#/components/schemas/")).map((r) => r.ref.split("/").pop());
const unused = declaredSchemas.filter((s) => !usedSchemas.includes(s));

/** 契约与真实路由是否一一对应（路径前缀 /api/external 必须已无残留）。 */
function checkRouteParity() {
  const root = "apps/passport-web/app";
  const routes = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") routes.push(full.slice(root.length).replace(/\/route\.ts$/, ""));
    }
  })("apps/passport-web/app/api/v1/open");
  const routeSet = new Set(routes.map((r) => r.replace(/\[[^\]]+\]/g, "{}")));
  const specSet = new Set(Object.keys(doc.paths).map((p) => p.replace(/\{[^}]+\}/g, "{}")));
  for (const s of specSet) if (!routeSet.has(s)) problems.push(`契约有、路由无：${s}`);
  for (const r of routeSet) if (!specSet.has(r)) problems.push(`路由有、契约无：${r}`);
  console.log(`path parity: spec ${specSet.size} / routes ${routeSet.size}`);
}
checkRouteParity();

console.log(`paths: ${Object.keys(doc.paths).length}`);
console.log(`operations: ${Object.values(doc.paths).reduce((n, i) => n + Object.keys(i).length, 0)}`);
console.log(`schemas: ${declaredSchemas.length} (${unused.length ? `unused: ${unused.join(", ")}` : "all referenced"})`);
console.log(`refs: ${refs.length}`);
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "OK: parse + $ref + tag/operationId checks passed");
