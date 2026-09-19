/**
 * Climate Passport 测试数据 fixtures
 *
 * 本文件集中管理测试用例中使用的通用测试数据，便于统一维护和替换。
 * 所有邮箱、用户名等标识符均带有时间戳或随机后缀，避免并行测试时产生冲突。
 */

export const locales = ["en", "zh"] as const;
export type TestLocale = (typeof locales)[number];

function generateUniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const testData = {
  locale: "en" as TestLocale,

  users: {
    attendee: {
      name: "Test Attendee",
      email: () => `test_attendee_${generateUniqueSuffix()}@example.com`,
      password: "TestPassword123!",
      phone: "+8613800000000",
      country: "China",
      organizationName: "Climate Passport Test Org",
    },
    admin: {
      name: "Test Admin",
      email: () => `test_admin_${generateUniqueSuffix()}@example.com`,
      password: "AdminPassword123!",
      phone: "+8613900000000",
      country: "China",
      organizationName: "Climate Passport Admin Org",
    },
  },

  /**
   * 预置种子用户（由 prisma/seed.mjs 创建到测试数据库）。
   * 这些账号已完成邮箱验证，可用于登录测试。
   */
  seededUsers: {
    attendee: {
      name: "Lin Qiao",
      email: "lin.qiao@climatepass.org",
      password: "seeded-password",
      role: "ATTENDEE",
    },
    admin: {
      name: "Avery Tan",
      email: "ops.admin@climatepass.org",
      password: "seeded-password",
      role: "ADMIN",
    },
    eventManager: {
      name: "Jordan Park",
      email: "events.manager@climatepass.org",
      password: "seeded-password",
      role: "EVENT_MANAGER",
    },
    verifier: {
      name: "Maya Chen",
      email: "verifier.field@climatepass.org",
      password: "seeded-password",
      role: "VERIFIER",
    },
  },

  activity: {
    title: () => `E2E Test Activity ${generateUniqueSuffix()}`,
    description: "This is an automated test activity created by the local flow test framework.",
    location: "Online",
  },

  certificate: {
    name: () => `E2E Test Certificate ${generateUniqueSuffix()}`,
    description: "Automated test certificate template.",
    categoryName: () => `Test Category ${generateUniqueSuffix()}`,
  },

  community: {
    title: () => `E2E Community Post ${generateUniqueSuffix()}`,
    content: "This post is created by the automated test framework.",
    comment: "This comment is created by the automated test framework.",
  },

  portfolio: {
    title: () => `E2E Portfolio ${generateUniqueSuffix()}`,
    bio: "Automated test portfolio biography.",
  },
};

/**
 * 测试注册/登录请求体构造器
 */
export function buildRegisterPayload(
  locale: TestLocale,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    phone: string;
    country: string;
    organizationName: string;
  }> = {},
) {
  return {
    locale,
    name: testData.users.attendee.name,
    email: testData.users.attendee.email(),
    password: testData.users.attendee.password,
    phone: testData.users.attendee.phone,
    country: testData.users.attendee.country,
    organizationName: testData.users.attendee.organizationName,
    ...overrides,
  };
}

export function buildLoginPayload(
  locale: TestLocale,
  email: string,
  password: string,
  overrides: Partial<{ next: string }> = {},
) {
  return {
    locale,
    email,
    password,
    ...overrides,
  };
}

/**
 * 证书申请请求体构造器
 */
export function buildCertificateApplicationPayload(definitionId: string, idempotencyKey?: string) {
  return {
    definitionId,
    statement: "Automated test certificate application statement.",
    sourceType: "TEST",
    sourceId: `test-${generateUniqueSuffix()}`,
    sourceLabel: "Local Test Framework",
    idempotencyKey: idempotencyKey || `idemp-${generateUniqueSuffix()}`,
    submit: true,
  };
}
