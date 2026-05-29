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

type AgendaItemSpeaker = { id: string; order: number; speaker: Speaker };

type AgendaItem = {
  id: string;
  activityId: string;
  agendaDate: string;
  startTime: string;
  endTime: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  type: string;
  venue: string | null;
  venueEn: string | null;
  moderator: Speaker | null;
  speakers: AgendaItemSpeaker[];
  order: number;
};

const ITEM_TYPES = ["session", "keynote", "panel", "workshop", "break", "networking", "other"] as const;

const TYPE_LABELS_ZH: Record<string, string> = {
  session: "议题",
  keynote: "主旨演讲",
  panel: "圆桌讨论",
  workshop: "工作坊",
  break: "休息",
  networking: "交流",
  other: "其他",
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  session: "chip cpca-badge cpca-badge-blue",
  keynote: "chip cpca-badge cpca-badge-blue",
  panel: "chip cpca-badge cpca-badge-blue",
  workshop: "chip cpca-badge cpca-badge-amber",
  break: "chip cpca-badge cpca-badge-gray",
  networking: "chip cpca-badge cpca-badge-green",
  other: "chip chip",
};

const EMPTY_FORM = {
  agendaDate: "",
  startTime: "09:00",
  endTime: "10:00",
  title: "",
  titleEn: "",
  description: "",
  descriptionEn: "",
  type: "session",
  venue: "",
  venueEn: "",
  moderatorId: "",
  speakerIds: "",
  order: "0",
};

function groupByDate(items: AgendaItem[]) {
  const map: Record<string, AgendaItem[]> = {};
  for (const item of items) {
    const d = item.agendaDate.slice(0, 10);
    if (!map[d]) map[d] = [];
    map[d].push(item);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export function AdminActivityAgendaClient({
  locale,
  activityId,
  initialAgendaItems,
  speakers,
}: {
  locale: Locale;
  activityId: string;
  initialAgendaItems: AgendaItem[];
  speakers: Speaker[];
}) {
  const [items, setItems] = useState<AgendaItem[]>(initialAgendaItems);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const zh = locale === "zh";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/agenda`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.agendaItems ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(item: AgendaItem) {
    setForm({
      agendaDate: item.agendaDate.slice(0, 10),
      startTime: item.startTime,
      endTime: item.endTime,
      title: item.title,
      titleEn: item.titleEn ?? "",
      description: item.description ?? "",
      descriptionEn: item.descriptionEn ?? "",
      type: item.type,
      venue: item.venue ?? "",
      venueEn: item.venueEn ?? "",
      moderatorId: item.moderator?.id ?? "",
      speakerIds: item.speakers.map((s) => s.speaker.id).join(","),
      order: String(item.order),
    });
    setEditId(item.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        agendaDate: form.agendaDate,
        startTime: form.startTime,
        endTime: form.endTime,
        title: form.title,
        titleEn: form.titleEn || undefined,
        description: form.description || undefined,
        descriptionEn: form.descriptionEn || undefined,
        type: form.type,
        venue: form.venue || undefined,
        venueEn: form.venueEn || undefined,
        moderatorId: form.moderatorId || undefined,
        speakerIds: form.speakerIds ? form.speakerIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        order: parseInt(form.order) || 0,
      };

      const url = editId
        ? `/api/activities/${activityId}/agenda/${editId}`
        : `/api/activities/${activityId}/agenda`;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (zh ? "保存失败" : "Save failed"));

      setItems((prev) => {
        if (editId) return prev.map((it) => (it.id === editId ? data.agendaItem : it));
        return [...prev, data.agendaItem];
      });
      setShowForm(false);
      setEditId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(zh ? "确认删除此议程项目？" : "Delete this agenda item?")) return;
    const res = await fetch(`/api/activities/${activityId}/agenda/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleMove(item: AgendaItem, direction: -1 | 1) {
    const day = item.agendaDate.slice(0, 10);
    const dayItems = items
      .filter((it) => it.agendaDate.slice(0, 10) === day)
      .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
    const idx = dayItems.findIndex((it) => it.id === item.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= dayItems.length) return;
    const swap = dayItems[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/activities/${activityId}/agenda/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: swap.order }),
        }),
        fetch(`/api/activities/${activityId}/agenda/${swap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: item.order }),
        }),
      ]);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const groups = groupByDate(items);

  return (
    <div>
      <div
        className="section-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2>{zh ? "活动议程管理" : "Agenda Management"}</h2>
        <button className="button button button" onClick={openAdd}>
          {zh ? "+ 添加议程项" : "+ Add Item"}
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="proto-admin-empty">{zh ? "加载中…" : "Loading…"}</div>
      )}

      {showForm && (
        <div className="proto-admin-overlay">
          <div className="panel" style={{ maxWidth: "720px", width: "100%" }}>
            <div className="compact-header">
              <h3 className="label">
                {editId ? (zh ? "编辑议程项" : "Edit Item") : (zh ? "新建议程项" : "New Item")}
              </h3>
              <button className="button button-ghost" onClick={() => setShowForm(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div >
              {error && (
                <div className="form-error form-error" style={{ marginBottom: "0.75rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "日期 *" : "Date *"}</label>
                  <input
                    className="field"
                    type="date"
                    required
                    value={form.agendaDate}
                    onChange={(e) => set("agendaDate", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{zh ? "开始时间 *" : "Start *"}</label>
                  <input
                    className="field"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{zh ? "结束时间 *" : "End *"}</label>
                  <input
                    className="field"
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "标题（中文）*" : "Title (CN) *"}</label>
                  <input
                    className="field"
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "标题（英文）" : "Title (EN)"}</label>
                  <input
                    className="field"
                    type="text"
                    value={form.titleEn}
                    onChange={(e) => set("titleEn", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "描述（中文）" : "Description (CN)"}</label>
                  <textarea
                    className="field"
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "描述（英文）" : "Description (EN)"}</label>
                  <textarea
                    className="field"
                    rows={3}
                    value={form.descriptionEn}
                    onChange={(e) => set("descriptionEn", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{zh ? "类型" : "Type"}</label>
                  <select className="field" value={form.type} onChange={(e) => set("type", e.target.value)}>
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {zh ? TYPE_LABELS_ZH[t] : t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">{zh ? "顺序" : "Order"}</label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={form.order}
                    onChange={(e) => set("order", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{zh ? "场地（中文）" : "Venue (CN)"}</label>
                  <input
                    className="field"
                    type="text"
                    value={form.venue}
                    onChange={(e) => set("venue", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{zh ? "场地（英文）" : "Venue (EN)"}</label>
                  <input
                    className="field"
                    type="text"
                    value={form.venueEn}
                    onChange={(e) => set("venueEn", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{zh ? "主持人" : "Moderator"}</label>
                  <select
                    className="field"
                    value={form.moderatorId}
                    onChange={(e) => set("moderatorId", e.target.value)}
                  >
                    <option value="">{zh ? "（不设置）" : "(none)"}</option>
                    {speakers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.nameEn ? ` / ${s.nameEn}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    {zh ? "演讲嘉宾（按住 Ctrl/Cmd 多选）" : "Speakers (hold Ctrl/Cmd to multi-select)"}
                  </label>
                  <select
                    className="field"
                    multiple
                    size={Math.min(6, speakers.length + 1)}
                    value={
                      form.speakerIds ? form.speakerIds.split(",").map((s) => s.trim()).filter(Boolean) : []
                    }
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                      set("speakerIds", selected.join(","));
                    }}
                  >
                    {speakers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.nameEn ? ` / ${s.nameEn}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="button-row">
              <button className="button button button" disabled={saving} onClick={handleSave}>
                {saving ? (zh ? "保存中…" : "Saving…") : zh ? "保存" : "Save"}
              </button>
              <button
                className="button button-secondary button"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                {zh ? "取消" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 && !loading && (
        <div className="proto-admin-empty">
          {zh ? "暂无议程项目，点击上方按钮添加。" : "No agenda items yet. Click above to add one."}
        </div>
      )}

      {groups.map(([date, dayItems]) => (
        <div key={date} style={{ marginBottom: "2rem" }}>
          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
            {new Date(`${date}T12:00:00`).toLocaleDateString(
              zh ? "zh-CN" : "en-US",
              { weekday: "long", year: "numeric", month: "long", day: "numeric" }
            )}
          </h3>
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>{zh ? "时间" : "Time"}</th>
                  <th>{zh ? "议程标题" : "Title"}</th>
                  <th style={{ width: "80px" }}>{zh ? "类型" : "Type"}</th>
                  <th>{zh ? "场地" : "Venue"}</th>
                  <th>{zh ? "主持/嘉宾" : "Moderator/Speakers"}</th>
                  <th style={{ width: "120px" }}>{zh ? "操作" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {dayItems
                  .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order)
                  .map((item) => (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                        {item.startTime} – {item.endTime}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                        {item.titleEn && <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>{item.titleEn}</div>}
                      </td>
                      <td>
                        <span className={TYPE_BADGE_CLASS[item.type] ?? "chip chip"} style={{ fontSize: "0.75rem" }}>
                          {zh ? TYPE_LABELS_ZH[item.type] ?? item.type : item.type}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        {item.venue ?? "—"}
                        {item.venueEn ? <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{item.venueEn}</div> : null}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {item.moderator && (
                          <div style={{ marginBottom: "2px" }}>
                            🎤 {item.moderator.name}
                          </div>
                        )}
                        {item.speakers.map((sl) => (
                          <div key={sl.id}>{sl.speaker.name}</div>
                        ))}
                        {!item.moderator && item.speakers.length === 0 && "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          <button
                            className="button button-secondary button"
                            onClick={() => openEdit(item)}
                          >
                            {zh ? "编辑" : "Edit"}
                          </button>
                          <button
                            className="button button"
                            style={{ color: "#dc2626" }}
                            onClick={() => handleDelete(item.id)}
                          >
                            {zh ? "删除" : "Del"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
                          <button
                            className="button button"
                            disabled={loading}
                            onClick={() => handleMove(item, -1)}
                            title={zh ? "上移" : "Move up"}
                          >
                            ↑
                          </button>
                          <button
                            className="button button"
                            disabled={loading}
                            onClick={() => handleMove(item, 1)}
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
        </div>
      ))}
    </div>
  );
}
