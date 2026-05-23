"use client";

import { useState } from "react";

export function CertificateDownloadButton({
  certificateId,
  label = "Download",
}: {
  certificateId: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/certificates/${certificateId}/download`, { method: "POST" });
      const payload = await response.json() as {
        error?: string;
        download?: { url?: string | null; fileName?: string | null; verificationCode?: string | null };
      };

      if (!response.ok) {
        setMessage(payload.error ?? "Download is unavailable.");
        return;
      }

      if (payload.download?.url) {
        window.open(payload.download.url, "_blank", "noopener,noreferrer");
      }

      setMessage(payload.download?.url ? "Download opened." : "Download counted. Rendered file is not available yet.");
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="certificate-action-stack">
      <button className="button" disabled={loading} onClick={handleDownload} type="button">
        {loading ? "Working..." : label}
      </button>
      {message ? <small className="certificate-action-note">{message}</small> : null}
    </span>
  );
}

export function CopyVerificationLinkButton({
  url,
  label = "Copy verification link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="button-outline" onClick={handleCopy} type="button">
      {copied ? "Copied" : label}
    </button>
  );
}

export function CertificateAdminStatusButton({
  certificateId,
  action,
  label,
}: {
  certificateId: string;
  action: "revoke" | "restore" | "regenerate";
  label: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/certificates/${certificateId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin action from Certificate records UI." }),
      });
      const payload = await response.json() as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return;
      }

      setMessage("Done. Refresh to see the latest state.");
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="certificate-action-stack">
      <button className="button-outline" disabled={loading} onClick={handleAction} type="button">
        {loading ? "Working..." : label}
      </button>
      {message ? <small className="certificate-action-note">{message}</small> : null}
    </span>
  );
}

export function CertificateVisibilityToggle({
  certificateId,
  initialVisible,
  label = "Show on public profile",
}: {
  certificateId: string;
  initialVisible: boolean;
  label?: string;
}) {
  const [visible, setVisible] = useState(initialVisible);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChange(nextVisible: boolean) {
    setVisible(nextVisible);
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/certificates/${certificateId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicVisible: nextVisible }),
      });
      const payload = await response.json() as { error?: string };

      if (!response.ok) {
        setVisible(!nextVisible);
        setMessage(payload.error ?? "Visibility update failed.");
        return;
      }

      setMessage(nextVisible ? "Visible on public profile." : "Hidden from public profile.");
    } catch {
      setVisible(!nextVisible);
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="certificate-action-stack">
      <label className="certificate-visibility-toggle">
        <input
          checked={visible}
          disabled={loading}
          onChange={(event) => void handleChange(event.target.checked)}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
      {message ? <small className="certificate-action-note">{message}</small> : null}
    </span>
  );
}
