"use client";

import { useState, useCallback, useEffect } from "react";
import type { Locale } from "@/lib/site-content";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type ActivityVerifier = {
  id: string;
  userId: string;
  activityId: string;
  createdAt: string;
  user: User;
};

export function AdminActivityVerifiersClient({
  locale,
  activityId,
  initialVerifiers,
  availableVerifiers,
}: {
  locale: Locale;
  activityId: string;
  initialVerifiers: ActivityVerifier[];
  availableVerifiers: User[];
}) {
  const [verifiers, setVerifiers] = useState<ActivityVerifier[]>(initialVerifiers);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const zh = locale === "zh";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/verifiers`);
      if (res.ok) {
        const data = await res.json();
        setVerifiers(data.verifiers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const assignedUserIds = new Set(verifiers.map((v) => v.userId));
  const candidates = availableVerifiers.filter((u) => !assignedUserIds.has(u.id));

  async function handleAdd() {
    if (!selectedUserId) {
      setError(zh ? "请选择验证员" : "Select a verifier");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/verifiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (zh ? "分配失败" : "Failed"));
      setVerifiers((prev) => [data.verifier, ...prev]);
      setSelectedUserId("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm(zh ? "确认移除该验证员？" : "Remove this verifier?")) return;
    const res = await fetch(`/api/activities/${activityId}/verifiers?userId=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) setVerifiers((prev) => prev.filter((v) => v.userId !== userId));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2>{zh ? "验证员分配" : "Verifier Assignment"}</h2>
      </div>

      {error && (
        <div className="form-error form-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="data-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: "280px", flex: 1 }}>
            <label className="label">{zh ? "分配验证员" : "Assign Verifier"}</label>
            <select
              className="field"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">{zh ? "请选择…" : "Choose…"}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                  {u.name ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="button button button" disabled={saving || !selectedUserId} onClick={handleAdd}>
            {saving ? (zh ? "分配中…" : "Assigning…") : zh ? "分配" : "Assign"}
          </button>
        </div>
        {candidates.length === 0 && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {zh ? "暂无可分配的验证员。" : "No available verifiers to assign."}
          </div>
        )}
      </div>

      {verifiers.length === 0 && !loading && (
        <div className="proto-admin-empty">
          {zh ? "尚未分配验证员。" : "No verifiers assigned yet."}
        </div>
      )}

      {verifiers.length > 0 && (
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "姓名" : "Name"}</th>
                <th>{zh ? "邮箱" : "Email"}</th>
                <th>{zh ? "角色" : "Role"}</th>
                <th style={{ width: "100px" }}>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {verifiers.map((v) => (
                <tr key={v.id}>
                  <td>{v.user.name ?? "—"}</td>
                  <td>{v.user.email}</td>
                  <td>
                    <span className="chip chip">{v.user.role}</span>
                  </td>
                  <td>
                    <button
                      className="button button"
                      style={{ color: "#dc2626" }}
                      onClick={() => handleRemove(v.userId)}
                    >
                      {zh ? "移除" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
