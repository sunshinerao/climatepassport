"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type DiagnosticsResult = {
  timestamp: string;
  dbLatencyMs: number | null;
  dbError: string | null;
  appProcessingMs: number;
  serverRegion: string;
  dbHost: string | null;
  client: {
    country: string | null;
    city: string | null;
    region: string | null;
  };
  clientRoundTripMs?: number;
  networkMs?: number;
};

type Badge = { label: string; cls: string };

function statusBadge(ms: number | null, fastThreshold: number, slowThreshold: number, isZh: boolean): Badge {
  if (ms === null) return { label: isZh ? "不可用" : "N/A", cls: "diag-badge diag-badge--na" };
  if (ms < fastThreshold) return { label: isZh ? "快" : "Fast", cls: "diag-badge diag-badge--fast" };
  if (ms < slowThreshold) return { label: isZh ? "一般" : "Normal", cls: "diag-badge diag-badge--normal" };
  return { label: isZh ? "慢" : "Slow", cls: "diag-badge diag-badge--slow" };
}

export function AdminSystemDiagnosticsClient({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [error, setError] = useState("");

  async function runDiagnostics() {
    setIsRunning(true);
    setError("");
    setResult(null);

    const fetchStart = performance.now();
    try {
      const response = await fetch("/api/admin/system/diagnostics");
      const clientRoundTripMs = Math.round(performance.now() - fetchStart);

      if (!response.ok) {
        setError(isZh ? "诊断请求失败，请确认登录状态。" : "Diagnostics request failed. Check your session.");
        return;
      }

      const data = (await response.json()) as DiagnosticsResult;
      data.clientRoundTripMs = clientRoundTripMs;
      data.networkMs = Math.max(0, clientRoundTripMs - data.appProcessingMs);
      setResult(data);
    } catch {
      setError(isZh ? "网络异常，无法完成诊断。" : "Network error. Could not complete diagnostics.");
    } finally {
      setIsRunning(false);
    }
  }

  const ttfbBadge = result ? statusBadge(result.clientRoundTripMs ?? null, 200, 800, isZh) : null;
  const networkBadge = result ? statusBadge(result.networkMs ?? null, 150, 600, isZh) : null;
  const appBadge = result ? statusBadge(result.appProcessingMs, 50, 300, isZh) : null;
  const dbBadge = result ? statusBadge(result.dbLatencyMs, 20, 100, isZh) : null;

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "性能诊断" : "Performance diagnostics"}</span>
          <h2 style={{ fontSize: "1.25rem", marginTop: "0.25rem", marginBottom: "0.25rem" }}>
            {isZh ? "系统响应与数据库连接速度检测" : "Response & database latency check"}
          </h2>
        </div>
        <p>
          {isZh
            ? "点击开始检测，实时测量当前访问的网络延迟、应用服务器处理速度和数据库连接延迟，帮助判断访问慢的根因。"
            : "Run a one-shot check to measure network latency, app server processing time, and database connection speed from your current location."}
        </p>
      </div>

      <div className="panel">
        <div className="diag-run-row">
          <button className="button" disabled={isRunning} onClick={() => void runDiagnostics()} type="button">
            {isRunning ? (isZh ? "检测中..." : "Running...") : (isZh ? "开始检测" : "Run diagnostics")}
          </button>
          {result ? (
            <span className="diag-timestamp">
              {isZh ? "检测时间：" : "Tested at: "}
              {new Date(result.timestamp).toLocaleString(isZh ? "zh-CN" : "en-US")}
            </span>
          ) : null}
        </div>

        {error ? <p className="form-error" style={{ marginTop: "0.75rem" }}>{error}</p> : null}

        {result ? (
          <div className="diag-results">
            <div className="diag-meta">
              {result.client.city || result.client.country ? (
                <span>
                  {isZh ? "访问位置：" : "Client location: "}
                  {[result.client.city, result.client.country].filter(Boolean).join(", ")}
                </span>
              ) : (
                <span>{isZh ? "访问位置：未知（本地/代理访问时不可用）" : "Client location: N/A (not available locally or behind proxy)"}</span>
              )}
              <span>
                {isZh ? "应用服务器节点：" : "App server: "}
                {result.serverRegion === "local" ? (isZh ? "本地开发" : "Local dev") : result.serverRegion}
              </span>
              {result.dbHost ? (
                <span>{isZh ? "数据库主机：" : "DB host: "}{result.dbHost}</span>
              ) : null}
            </div>

            <div className="diag-grid">
              <div className="diag-card">
                <div className="diag-card-label">{isZh ? "总往返时间 (TTFB)" : "Total round-trip (TTFB)"}</div>
                <div className="diag-card-value">{result.clientRoundTripMs} ms</div>
                <span className={ttfbBadge!.cls}>{ttfbBadge!.label}</span>
                <div className="diag-card-hint">
                  {isZh ? "从发出请求到收到完整响应的时间" : "From request sent to full response received"}
                </div>
              </div>

              <div className="diag-card">
                <div className="diag-card-label">{isZh ? "网络传输（估算）" : "Network latency (est.)"}</div>
                <div className="diag-card-value">{result.networkMs} ms</div>
                <span className={networkBadge!.cls}>{networkBadge!.label}</span>
                <div className="diag-card-hint">
                  {isZh ? "TTFB 减去服务器处理时间，反映用户到服务器的网络层" : "TTFB minus server processing — reflects network between client and server"}
                </div>
              </div>

              <div className="diag-card">
                <div className="diag-card-label">{isZh ? "应用服务器处理" : "App server processing"}</div>
                <div className="diag-card-value">{result.appProcessingMs} ms</div>
                <span className={appBadge!.cls}>{appBadge!.label}</span>
                <div className="diag-card-hint">
                  {isZh ? "服务器从收到请求到发出响应（含 DB 查询）的总时间" : "From receiving request to sending response (includes DB call)"}
                </div>
              </div>

              <div className="diag-card">
                <div className="diag-card-label">{isZh ? "数据库连接延迟" : "Database query latency"}</div>
                <div className="diag-card-value">
                  {result.dbError ? (isZh ? "不可用" : "N/A") : `${result.dbLatencyMs} ms`}
                </div>
                <span className={dbBadge!.cls}>{dbBadge!.label}</span>
                <div className="diag-card-hint">
                  {result.dbError
                    ? result.dbError
                    : (isZh ? "应用服务器执行 SELECT 1 的往返时间" : "Round-trip for SELECT 1 from app server to DB")}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
