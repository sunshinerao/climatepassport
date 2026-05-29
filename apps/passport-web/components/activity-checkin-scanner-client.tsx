"use client";

import { useState, useRef, useEffect } from "react";

interface CheckinResult {
  ok: boolean;
  result: string;
  message?: string;
  user?: { id: string; name: string | null; email: string; climatePassportId: string | null };
  activity?: { id: string; title: string; type: string };
  taskId?: string | null;
}

export default function ActivityCheckinScannerClient({ locale }: { locale: string }) {
  const zh = locale === "zh";
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount for barcode scanner input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleVerify(rawToken: string) {
    if (!rawToken.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/checkin/activity-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken.trim() }),
      });
      const data: CheckinResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, result: "ERROR", message: zh ? "网络错误" : "Network error" });
    } finally {
      setLoading(false);
      setToken("");
      // Re-focus for next scan
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleVerify(token);
  }

  const resultColor =
    result?.result === "VALID" ? "var(--color-success, #16a34a)"
    : result?.result === "DUPLICATE" ? "var(--color-warning, #d97706)"
    : "var(--color-error, #dc2626)";

  const resultLabel: Record<string, { zh: string; en: string }> = {
    VALID: { zh: "✓ 签到成功", en: "✓ Check-in Successful" },
    DUPLICATE: { zh: "⚠ 重复签到", en: "⚠ Duplicate Check-in" },
    EXPIRED: { zh: "✗ 二维码已过期", en: "✗ QR Code Expired" },
    CONSUMED: { zh: "✗ 二维码已使用", en: "✗ QR Already Used" },
    INVALID: { zh: "✗ 无效二维码", en: "✗ Invalid QR Code" },
    ERROR: { zh: "✗ 系统错误", en: "✗ System Error" },
  };

  return (
    <div >
      <form  onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          autoComplete="off"
          className="field "
          disabled={loading}
          placeholder={zh ? "扫描二维码或手动输入 Token..." : "Scan QR or enter token..."}
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleVerify(token);
          }}
        />
        <button className="button button" disabled={loading || !token.trim()} type="submit">
          {loading ? (zh ? "核验中..." : "Verifying...") : (zh ? "核验" : "Verify")}
        </button>
      </form>

      {result && (
        <div
         
          style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            border: `2px solid ${resultColor}`,
            backgroundColor: `${resultColor}11`,
          }}
        >
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: resultColor,
              marginBottom: "0.75rem",
            }}
          >
            {resultLabel[result.result]?.[zh ? "zh" : "en"] ?? result.result}
          </div>

          {result.user && (
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{result.user.name ?? result.user.email}</div>
              {result.user.climatePassportId && (
                <div style={{ fontSize: "0.85em", color: "var(--color-text-muted)" }}>ID: {result.user.climatePassportId}</div>
              )}
            </div>
          )}

          {result.activity && (
            <div style={{ fontSize: "0.9em", marginTop: "0.25rem" }}>
              {zh ? "活动" : "Activity"}: {result.activity.title}
            </div>
          )}

          {result.message && result.result !== "VALID" && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.9em", color: resultColor }}>
              {result.message}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "2rem", fontSize: "0.85em", color: "var(--color-text-muted)" }}>
        {zh
          ? "将扫码枪对准参与者的二维码，系统将自动完成签到"
          : "Point the scanner at the participant's QR code. The system will check in automatically."}
      </div>
    </div>
  );
}
