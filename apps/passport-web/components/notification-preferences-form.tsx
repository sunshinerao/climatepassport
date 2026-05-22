"use client";

import { useState, type FormEvent } from "react";

type NotificationChannelState = {
  title: string;
  description: string;
  status: string;
};

function statusToEnabled(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "enabled" || normalized === "已开启";
}

export function NotificationPreferencesForm({
  locale,
  channels,
}: {
  locale: import("@/lib/site-content").Locale;
  channels: NotificationChannelState[];
}) {
  const [inAppEnabled, setInAppEnabled] = useState(statusToEnabled(channels[0]?.status ?? ""));
  const [emailEnabled, setEmailEnabled] = useState(statusToEnabled(channels[1]?.status ?? ""));
  const [smsEnabled, setSmsEnabled] = useState(statusToEnabled(channels[2]?.status ?? ""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/dashboard/notifications/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inAppEnabled,
          emailEnabled,
          smsEnabled,
          marketingEnabled: false,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? (locale === "zh" ? "保存失败。" : "Failed to save preferences."));
        return;
      }

      setStatus(locale === "zh" ? "通知偏好已更新。" : "Notification preferences updated.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="toggle-field">
        <input checked={inAppEnabled} onChange={(event) => setInAppEnabled(event.target.checked)} type="checkbox" />
        <span>{channels[0]?.title ?? "In-app notifications"}</span>
      </label>
      <label className="toggle-field">
        <input checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} type="checkbox" />
        <span>{channels[1]?.title ?? "Email notifications"}</span>
      </label>
      <label className="toggle-field">
        <input checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} type="checkbox" />
        <span>{channels[2]?.title ?? "SMS alerts"}</span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {status ? <p className="form-success">{status}</p> : null}
      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "..." : locale === "zh" ? "保存偏好" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
