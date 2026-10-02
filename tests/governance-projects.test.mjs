import assert from "node:assert/strict";
import { test } from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const { listGovernanceProjects } = loadService("apps/passport-web/lib/server/governance-projects.ts", {
  matchesWhere,
});

const now = new Date();
const programme = { id: "programme-a", isActive: true };
const projects = [
  {
    id: "project-a",
    code: "CPU-001",
    programmeId: programme.id,
    institutionId: "institution-a",
    activityId: null,
    kind: "learning_unit",
    title: "Authorized project",
    status: "DRAFT",
    createdAt: now,
    programme: { name: "Programme A" },
    institution: { name: "Institution A" },
  },
  {
    id: "project-b",
    code: "CPU-002",
    programmeId: "programme-b",
    institutionId: "institution-b",
    activityId: null,
    kind: "activity",
    title: "Other project",
    status: "PUBLISHED",
    createdAt: now,
    programme: { name: "Programme B" },
    institution: { name: "Institution B" },
  },
];

function prismaFor(memberships) {
  const programmeRows = [programme, { id: "programme-b", isActive: true }];
  return {
    accessMembership: {
      findMany: async ({ where }) => memberships.filter((row) => matchesWhere(row, where)),
    },
    governanceProject: {
      findMany: async ({ where }) => projects.filter((row) => matchesWhere(row, where)),
    },
    programme: {
      findFirst: async ({ where }) => programmeRows.find((row) => matchesWhere(row, where)) ?? null,
    },
    edition: { findFirst: async () => null },
    objectAuthorization: { findFirst: async () => null },
    institutionRepresentation: { findFirst: async () => null },
    sourceObjectMapping: { findFirst: async () => null },
  };
}

test("lists only whole-Programme projects readable through current scoped membership", async () => {
  const memberships = [
    { userId: "viewer", programmeId: programme.id, editionId: null, role: "PROGRAMME_VIEWER", ...window() },
    { userId: "viewer", programmeId: "programme-b", editionId: null, role: "PROGRAMME_VIEWER", ...window(), revokedAt: new Date() },
    { userId: "viewer", programmeId: "programme-b", editionId: "edition-b", role: "PROGRAMME_ADMIN", ...window() },
    { userId: "manager", programmeId: programme.id, editionId: null, role: "PROGRAMME_ADMIN", ...window() },
  ];

  const viewer = await listGovernanceProjects(prismaFor(memberships), "viewer");
  assert.deepEqual(viewer.projects.map((project) => project.id), ["project-a"]);
  assert.equal(viewer.projects[0].canManage, false);
  assert.equal(viewer.projects[0].accessRole, "PROGRAMME_VIEWER");

  const manager = await listGovernanceProjects(prismaFor(memberships), "manager");
  assert.deepEqual(manager.projects.map((project) => project.id), ["project-a"]);
  assert.equal(manager.projects[0].canManage, true);
});

test("global ADMIN identity alone does not expose Programme governance projects", async () => {
  const result = await listGovernanceProjects(prismaFor([]), "global-admin");
  assert.equal(result.projects.length, 0);
});

function window() {
  return { isActive: true, revokedAt: null, validFrom: null, validUntil: null };
}