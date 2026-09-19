/**
 * API 集成测试通用 HTTP 客户端
 *
 * 使用 Node.js 原生 fetch 实现，自动维护会话 cookie，
 * 便于在登录后调用需要认证的 API。
 *
 * 约定：
 * - CP_TEST_BASE_URL 控制目标服务器地址，默认 http://localhost:3000
 * - 测试运行前需要目标服务器已启动并连接测试数据库
 */

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
  cookies: string[];
}

export class ApiClient {
  private baseURL: string;
  private cookieJar: string[] = [];

  constructor(baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3000") {
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  getCookieString(): string {
    return this.cookieJar.join("; ");
  }

  setCookies(cookies: string[]): void {
    this.cookieJar = cookies;
  }

  private extractCookies(response: Response): string[] {
    const setCookie = response.headers.getSetCookie?.() || [];
    return setCookie.map((c) => c.split(";")[0]).filter(Boolean);
  }

  private mergeCookies(newCookies: string[]): void {
    const map = new Map<string, string>();
    for (const c of this.cookieJar) {
      const key = c.split("=")[0];
      map.set(key, c);
    }
    for (const c of newCookies) {
      const key = c.split("=")[0];
      map.set(key, c);
    }
    this.cookieJar = Array.from(map.values());
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { body?: Record<string, unknown>; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`;
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: this.getCookieString(),
        ...options.headers,
      },
    };
    if (options.body) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const cookies = this.extractCookies(response);
    this.mergeCookies(cookies);

    let data: T = {} as T;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        data = (await response.json()) as T;
      } catch {
        data = {} as T;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      data,
      cookies,
    };
  }

  async get<T = unknown>(path: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, { headers });
  }

  async post<T = unknown>(
    path: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, { body, headers });
  }

  async patch<T = unknown>(
    path: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, { body, headers });
  }

  async delete<T = unknown>(path: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, { headers });
  }

  /**
   * 通过注册接口创建一个测试用户。
   * 注意：注册后需要邮箱验证才能真正登录；本函数主要用于验证注册接口可用性。
   */
  async register(payload: Record<string, unknown>): Promise<ApiResponse<{ ok?: boolean; redirectTo?: string; error?: string }>> {
    return this.post("/api/auth/register", payload);
  }

  /**
   * 通过登录接口建立会话。
   * 若账号未验证邮箱，会返回 requiresVerification 标志。
   */
  async login(payload: { locale: string; email: string; password: string; next?: string }): Promise<
    ApiResponse<{ ok?: boolean; redirectTo?: string; requiresVerification?: boolean; error?: string }>
  > {
    return this.post("/api/auth/login", payload);
  }

  async logout(): Promise<ApiResponse<{ ok: boolean }>> {
    return this.post("/api/auth/logout", {});
  }
}

/**
 * 等待服务器就绪的简单轮询辅助函数。
 */
export async function waitForServer(baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3000", timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseURL.replace(/\/$/, "")}/api/auth/session`);
      if (response.status < 500) return true;
    } catch {
      // 服务器尚未启动，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}
