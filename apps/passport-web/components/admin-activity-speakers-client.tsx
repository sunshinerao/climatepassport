"use client";

import { useState, useCallback, useEffect } from "react";
import type { Locale } from "@/lib/site-content";

type Speaker = {
  id: string;
  name: string;
  nameEn: string | null;
  title: string | null;
  titleEn: string | null;
  organization: string | null;
  organizationEn: string | null;
  avatar: string | null;
};

type ActivitySpeakerLink = {
  id: string;
  speakerId: string;
  activityId: string;
  role: string | null;
  roleEn: string | null;
  order: number;
  speaker: Speaker;
};

export function AdminActivitySpeakersClient({
  locale,
  activityId,
  initialSpeakers,
  allSpeakers,
}: {
  locale: Locale;
  activityId: string;
  initialSpeakers: ActivitySpeakerLink[];
  allSpeakers: Speaker[];
}) {
  const [links, setLinks] = useState<ActivitySpeakerLink[]>(initialSpeakers);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ speakerId: "", role: "", roleEn: "", order: "0" });
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ role: "", roleEn: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const zh = locale === "zh";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/speakers`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.speakers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setF(key: string, value: string) {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    if (!addForm.speakerId) {
      setError(zh ? "请选择嘉宾" : "Select a speaker");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: addForm.speakerId,
          role: addForm.role || undefined,
          roleEn: addForm.roleEn || undefined,
          order: parseInt(addForm.order) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (zh ? "添加失败" : "Failed"));

      setLinks((prev) => {
        const idx = prev.findIndex((l) => l.speakerId === addForm.speakerId);
        if (idx >= 0) return prev.map((l) => (l.speakerId === addForm.speakerId ? data.speaker : l));
        return [...prev, data.speaker];
      });
      setShowAdd(false);
      setAddForm({ speakerId: "", role: "", roleEn: "", order: "0" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(speakerId: string) {
    if (!confirm(zh ? "确认移除该嘉宾？" : "Remove this speaker?")) return;
    const res = await fetch(`/api/activities/${activityId}/speakers?speakerId=${speakerId}`, {
      method: "DELETE",
    });
    if (res.ok) setLinks((prev) => prev.filter((l) => l.speakerId !== speakerId));
  }

  function startEdit(link: ActivitySpeakerLink) {
    setEditLinkId(link.id);
    setEditForm({ role: link.role ?? "", roleEn: link.roleEn ?? "" });
    setError(null);
  }

  async function handleSaveEdit(link: ActivitySpeakerLink) {
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: link.speakerId,
          role: editForm.role || undefined,
          roleEn: editForm.roleEn || undefined,
          order: link.order,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (zh ? "保存失败" : "Save failed"));
      setLinks((prev) => prev.map((l) => (l.id === link.id ? data.speaker : l)));
      setEditLinkId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(link: ActivitySpeakerLink, direction: -1 | 1) {
    const sorted = [...links].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((l) => l.id === link.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/activities/${activityId}/speakers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speakerId: link.speakerId, order: swap.order }),
        }),
        fetch(`/api/activities/${activityId}/speakers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speakerId: swap.speakerId, order: link.order }),
        }),
      ]);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const linkedIds = new Set(links.map((l) => l.speakerId));
  const availableSpeakers = allSpeakers.filter((s) => !linkedIds.has(s.id));
  const sortedLinks = [...links].sort((a, b) => a.order - b.order);

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
        <h2>{zh ? "嘉宾管理" : "Speakers Management"}</h2>
        <button
          className="button button button"
          onClick={() => {
            setShowAdd(true);
            setError(null);
          }}
        >
          {zh ? "+ 添加嘉宾" : "+ Add Speaker"}
        </button>
      </div>

      {error && !showAdd && editLinkId === null && (
        <div className="form-error form-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {showAdd && (
        <div className="data-card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>{zh ? "添加嘉宾" : "Add Speaker"}</h3>
          {error && <div className="form-error form-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{zh ? "选择嘉宾 *" : "Select Speaker *"}</label>
              <select className="field" value={addForm.speakerId} onChange={(e) => setF("speakerId", e.target.value)}>
                <option value="">{zh ? "请选择…" : "Choose…"}</option>
                {availableSpeakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.nameEn ? ` / ${s.nameEn}` : ""}
                    {s.organization ? ` — ${s.organization}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">{zh ? "角色（中文）" : "Role (CN)"}</label>
              <input
                className="field"
                placeholder={zh ? "如：主旨演讲嘉宾" : "e.g. Keynote Speaker"}
                type="text"
                value={addForm.role}
                onChange={(e) => setF("role", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">{zh ? "角色（英文）" : "Role (EN)"}</label>
              <input
                className="field"
                placeholder="e.g. Keynote Speaker"
                type="text"
                value={addForm.roleEn}
                onChange={(e) => setF("roleEn", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">{zh ? "顺序" : "Order"}</label>
              <input className="field" min={0} type="number" value={addForm.order} onChange={(e) => setF("order", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="button button button" disabled={saving} onClick={handleAdd}>
              {saving ? (zh ? "添加中…" : "Adding…") : zh ? "确认添加" : "Add"}
            </button>
            <button className="button button-secondary button" disabled={saving} onClick={() => setShowAdd(false)}>
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {sortedLinks.length === 0 && !loading && (
        <div className="proto-admin-empty">
          {zh ? "暂无嘉宾，点击上方添加。" : "No speakers yet. Click above to add one."}
        </div>
      )}

      {sortedLinks.length > 0 && (
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>{zh ? "嘉宾" : "Speaker"}</th>
                <th>{zh ? "角色" : "Role"}</th>
                <th style={{ width: "120px" }}>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {sortedLinks.map((link) => (
                <tr key={link.id}>
                  <td style={{ color: "#9ca3af", fontSize: "var(--cp-text-small)" }}>{link.order}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {link.speaker.avatar && (
                        <img
                          alt=""
                          src={link.speaker.avatar}
                          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 500 }}>{link.speaker.name}</div>
                        {link.speaker.nameEn && <div style={{ color: "#6b7280", fontSize: "var(--cp-text-small)" }}>{link.speaker.nameEn}</div>}
                        {(link.speaker.title || link.speaker.organization) && (
                          <div style={{ color: "#9ca3af", fontSize: "var(--cp-text-small)" }}>
                            {[link.speaker.title, link.speaker.organization].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {editLinkId === link.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <input
                          className="field field"
                          placeholder={zh ? "角色（中文）" : "Role (CN)"}
                          value={editForm.role}
                          onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        />
                        <input
                          className="field field"
                          placeholder={zh ? "角色（英文）" : "Role (EN)"}
                          value={editForm.roleEn}
                          onChange={(e) => setEditForm((p) => ({ ...p, roleEn: e.target.value }))}
                        />
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button
                            className="button button button"
                            disabled={saving}
                            onClick={() => handleSaveEdit(link)}
                          >
                            {zh ? "保存" : "Save"}
                          </button>
                          <button className="button button-secondary button" onClick={() => setEditLinkId(null)}>
                            {zh ? "取消" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {link.role && <div style={{ fontSize: "var(--cp-text-small)" }}>{link.role}</div>}
                        {link.roleEn && <div style={{ color: "#6b7280", fontSize: "var(--cp-text-small)" }}>{link.roleEn}</div>}
                        {!link.role && !link.roleEn && "—"}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <button className="button button-secondary button" onClick={() => startEdit(link)}>
                        {zh ? "编辑" : "Edit"}
                      </button>
                      <button
                        className="button button"
                        style={{ color: "#dc2626" }}
                        onClick={() => handleRemove(link.speakerId)}
                      >
                        {zh ? "移除" : "Remove"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
                      <button
                        className="button button"
                        disabled={loading}
                        onClick={() => handleMove(link, -1)}
                        title={zh ? "上移" : "Move up"}
                      >
                        ↑
                      </button>
                      <button
                        className="button button"
                        disabled={loading}
                        onClick={() => handleMove(link, 1)}
                        title={zh ? "下移" : "Move down"}
                      >
                        ↓
                      </button>
                    </div>
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
