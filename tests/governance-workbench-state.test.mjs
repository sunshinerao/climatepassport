import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { loadService } from "./_service-loader.mjs";

const { beginGovernanceProjectSwitch, canSubmitGovernanceCommand } = loadService(
  "apps/passport-web/lib/server/governance-workbench-state.ts",
);
const component = fs.readFileSync("apps/passport-web/components/governance-workbench.tsx", "utf8");

test("switching projects clears old detail before loading the selected project", () => {
  const nextProject = beginGovernanceProjectSwitch("project-b");
  assert.equal(nextProject.selectedProjectId, "project-b");
  assert.equal(nextProject.detail, null);
  assert.equal(nextProject.loadingDetail, true);
  const noProject = beginGovernanceProjectSwitch("");
  assert.equal(noProject.selectedProjectId, "");
  assert.equal(noProject.detail, null);
  assert.equal(noProject.loadingDetail, false);
  assert.match(component, /const next = beginGovernanceProjectSwitch\(projectId\)/);
  assert.match(component, /setDetail\(next\.detail\)/);
});

test("commands stay disabled during detail loading and reject stale project ids", () => {
  const command = { selectedProjectId: "project-b", requestedProjectId: "project-b", commandProjectId: "project-b", detailProjectId: "project-b", loadingDetail: false };
  assert.equal(canSubmitGovernanceCommand(command), true);
  assert.equal(canSubmitGovernanceCommand({ ...command, loadingDetail: true }), false);
  assert.equal(canSubmitGovernanceCommand({ ...command, requestedProjectId: "project-a" }), false);
  assert.equal(canSubmitGovernanceCommand({ ...command, commandProjectId: "project-a" }), false);
  assert.equal(canSubmitGovernanceCommand({ ...command, detailProjectId: "project-a" }), false);
  assert.match(component, /disabled=\{loadingDetail \|\| busyKey !== null\}/);
  assert.match(component, /selectedProjectId: selectedProjectIdRef\.current/);
});