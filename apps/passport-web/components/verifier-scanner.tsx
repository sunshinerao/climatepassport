"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/site-content";

export type VerifierEventOption = {
  id: string;
  title: string;
  titleEn: string | null;
  startDate: string;
};

type ScanRecord = {
  id: string;
  scannedAt: string;
  token: string;
  result: string;
  message: string;
  detail?: string | null;
  status: "ok" | "warn" | "error";
};

type ApiResponse = {
  result?: string;
  type?: string;
  identity?: { name: string | null; climatePassportId: string | null; status: string | null };
  user?: { name: string | null; climatePassportId: string | null };
  event?: { id: string; title: string; titleEn: string | null };
  error?: string;
};

type ScannerStatus = "idle" | "starting" | "running" | "stopped" | "denied" | "unsupported";

const MAX_HISTORY = 20;

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function statusFromResult(result: string): "ok" | "warn" | "error" {
  if (["valid", "checked_in"].includes(result)) return "ok";
  if (["already_checked_in"].includes(result)) return "warn";
  return "error";
}

function describeResult(locale: Locale, payload: ApiResponse): { message: string; detail: string | null } {
  const result = payload.result ?? "unknown";
  switch (result) {
    case "valid":
      return {
        message: t(locale, "身份验证通过", "Identity verified"),
        detail: payload.identity?.climatePassportId ?? null,
      };
    case "checked_in":
      return {
        message: t(locale, "签到成功", "Checked in successfully"),
        detail: payload.user?.climatePassportId ?? null,
      };
    case "already_checked_in":
      return { message: t(locale, "已签到", "Already checked in"), detail: null };
    case "expired":
      return { message: t(locale, "二维码已过期", "QR token expired"), detail: null };
    case "invalid":
      return { message: t(locale, "无效或未识别的二维码", "Invalid or unrecognized QR"), detail: null };
    case "wrong_event":
      return { message: t(locale, "活动不匹配", "QR belongs to another event"), detail: null };
    case "permission_denied":
      return { message: t(locale, "没有权限验证该活动", "No permission for this event"), detail: null };
    case "not_registered":
      return { message: t(locale, "用户未报名该活动", "User is not registered for this event"), detail: null };
    case "not_approved":
      return { message: t(locale, "报名未通过审核", "Registration is not approved"), detail: null };
    case "unsupported":
      return { message: t(locale, "不支持的二维码类型", "Unsupported QR type"), detail: null };
    default:
      return { message: payload.error ?? t(locale, "扫描失败", "Scan failed"), detail: result };
  }
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

export function VerifierScanner({
  locale,
  events,
  verifierName,
}: {
  locale: Locale;
  events: VerifierEventOption[];
  verifierName: string;
}) {
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? "");
  const [manualToken, setManualToken] = useState("");
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<ReturnType<NonNullable<Window["BarcodeDetector"]>["prototype"]["detect"]> extends infer _ ? InstanceType<NonNullable<Window["BarcodeDetector"]>> | null : null>(null);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);

  const submitToken = useCallback(
    async (token: string, source: "camera" | "manual") => {
      const trimmed = token.trim();
      if (!trimmed) return;
      if (submitting) return;

      // Debounce duplicate camera detections within 4s.
      const now = Date.now();
      if (source === "camera" && lastTokenRef.current && lastTokenRef.current.token === trimmed && now - lastTokenRef.current.at < 4000) {
        return;
      }
      lastTokenRef.current = { token: trimmed, at: now };

      setSubmitting(true);
      try {
        const response = await fetch("/api/verifier/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed, eventId: eventId || undefined }),
        });
        const payload = (await response.json().catch(() => ({}))) as ApiResponse;
        const result = payload.result ?? (response.ok ? "valid" : "invalid");
        const summary = describeResult(locale, { ...payload, result });
        const record: ScanRecord = {
          id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
          scannedAt: new Date().toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US"),
          token: trimmed.length > 14 ? `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}` : trimmed,
          result,
          message: summary.message,
          detail: summary.detail,
          status: statusFromResult(result),
        };
        setHistory((current) => [record, ...current].slice(0, MAX_HISTORY));
        if (source === "manual" && record.status === "ok") {
          setManualToken("");
        }
      } catch {
        const record: ScanRecord = {
          id: `${now}-network`,
          scannedAt: new Date().toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US"),
          token: trimmed.slice(0, 8),
          result: "network_error",
          message: t(locale, "网络错误，请重试", "Network error, retry"),
          detail: null,
          status: "error",
        };
        setHistory((current) => [record, ...current].slice(0, MAX_HISTORY));
      } finally {
        setSubmitting(false);
      }
    },
    [eventId, locale, submitting],
  );

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.BarcodeDetector) {
      setScannerStatus("unsupported");
      setScannerError(t(locale, "当前浏览器不支持扫码，请粘贴 token。", "Camera scanning is not supported in this browser. Paste token manually."));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus("unsupported");
      setScannerError(t(locale, "摄像头不可用。", "Camera is not available."));
      return;
    }

    setScannerStatus("starting");
    setScannerError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      setScannerStatus("running");

      const loop = async () => {
        if (!detectorRef.current || !videoRef.current || !streamRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes && codes.length > 0) {
            void submitToken(codes[0].rawValue, "camera");
          }
        } catch {
          /* swallow detection errors – next frame may succeed */
        }
        rafRef.current = window.requestAnimationFrame(() => {
          void loop();
        });
      };
      rafRef.current = window.requestAnimationFrame(() => {
        void loop();
      });
    } catch (error) {
      setScannerStatus("denied");
      setScannerError(
        error instanceof Error && error.name === "NotAllowedError"
          ? t(locale, "摄像头权限被拒绝。", "Camera permission denied.")
          : t(locale, "无法启动摄像头。", "Unable to start the camera."),
      );
      stopCamera();
    }
  }, [locale, stopCamera, submitToken]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const eventLabel = useMemo(() => {
    if (!eventId) return t(locale, "未选择活动 · 仅身份验证可用", "No event selected · identity-only scans");
    const event = events.find((item) => item.id === eventId);
    if (!event) return t(locale, "活动信息缺失", "Event missing");
    const label = locale === "zh" ? event.title : event.titleEn ?? event.title;
    return `${label}`;
  }, [eventId, events, locale]);

  return (
    <div className="proto-verifier-shell">
      <header className="proto-verifier-head">
        <div>
          <span>{t(locale, "Climate Passport · 验证员控制台", "Climate Passport · Verifier console")}</span>
          <h1>{t(locale, "扫码与签到", "Scan & Check-In")}</h1>
          <p>
            {t(
              locale,
              `验证员：${verifierName}。所有扫码结果由服务端校验并写入审计日志。`,
              `Verifier: ${verifierName}. Every scan is server-validated and written to the Core audit log.`,
            )}
          </p>
        </div>
        <div className="proto-verifier-status">
          <span data-status={scannerStatus}>{describeScannerStatus(locale, scannerStatus)}</span>
          <small>{eventLabel}</small>
        </div>
      </header>

      <section className="proto-verifier-grid">
        <article className="proto-verifier-card">
          <h2>{t(locale, "活动选择", "Event scope")}</h2>
          <p className="proto-verifier-muted">
            {t(
              locale,
              "签到型扫码必须选择对应活动。仅做身份核对时可保持留空。",
              "Pick the event for check-in scans. Leave blank for identity-only verification.",
            )}
          </p>
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">{t(locale, "不选择活动（身份验证）", "No event (identity-only)")}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {(locale === "zh" ? event.title : event.titleEn ?? event.title) || event.id}
              </option>
            ))}
          </select>
          {events.length === 0 ? (
            <p className="proto-verifier-warn">
              {t(
                locale,
                "尚未分配到活动。身份扫码仍可使用，请联系管理员开通签到权限。",
                "No events assigned yet. Identity scans still work; ask an admin to grant event check-in access.",
              )}
            </p>
          ) : null}
        </article>

        <article className="proto-verifier-card">
          <h2>{t(locale, "摄像头扫码", "Camera scanner")}</h2>
          <div className="proto-verifier-video">
            <video ref={videoRef} muted playsInline />
            {scannerStatus !== "running" ? (
              <div className="proto-verifier-video-overlay">
                <strong>{describeScannerStatus(locale, scannerStatus)}</strong>
                {scannerError ? <span>{scannerError}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="proto-verifier-actions">
            {scannerStatus === "running" ? (
              <button type="button" className="proto-verifier-btn ghost" onClick={stopCamera}>
                {t(locale, "停止摄像头", "Stop camera")}
              </button>
            ) : (
              <button type="button" className="proto-verifier-btn primary" onClick={() => void startCamera()}>
                {t(locale, "启动摄像头", "Start camera")}
              </button>
            )}
          </div>
        </article>

        <article className="proto-verifier-card">
          <h2>{t(locale, "手动输入 Token", "Manual token entry")}</h2>
          <p className="proto-verifier-muted">
            {t(
              locale,
              "在摄像头不可用时，可直接粘贴 QR 解码后的 token 进行验证。",
              "Paste the decoded QR token to verify when the camera is unavailable.",
            )}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitToken(manualToken, "manual");
            }}
          >
            <input
              autoComplete="off"
              spellCheck={false}
              type="text"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder={t(locale, "粘贴 QR token", "Paste QR token")}
            />
            <button type="submit" className="proto-verifier-btn primary" disabled={submitting || !manualToken.trim()}>
              {submitting ? t(locale, "验证中…", "Verifying…") : t(locale, "提交验证", "Verify token")}
            </button>
          </form>
        </article>
      </section>

      <section className="proto-verifier-card proto-verifier-history">
        <h2>{t(locale, "最近扫码", "Recent scans")}</h2>
        {history.length === 0 ? (
          <p className="proto-verifier-muted">{t(locale, "尚无扫码记录。", "No scans yet.")}</p>
        ) : (
          <ul>
            {history.map((record) => (
              <li key={record.id} data-status={record.status}>
                <div>
                  <strong>{record.message}</strong>
                  <small>
                    {record.scannedAt} · {record.token}
                    {record.detail ? ` · ${record.detail}` : ""}
                  </small>
                </div>
                <span>{record.result}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function describeScannerStatus(locale: Locale, status: ScannerStatus) {
  switch (status) {
    case "idle":
      return t(locale, "摄像头空闲", "Camera idle");
    case "starting":
      return t(locale, "正在启动摄像头…", "Starting camera…");
    case "running":
      return t(locale, "正在扫描", "Scanning");
    case "stopped":
      return t(locale, "摄像头已停止", "Camera stopped");
    case "denied":
      return t(locale, "权限被拒绝", "Permission denied");
    case "unsupported":
      return t(locale, "不支持扫码 API", "Scanner API unsupported");
    default:
      return status;
  }
}
