"use client";

import { useState } from "react";
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
  type: string;
  venue: string | null;
  venueEn: string | null;
  moderator: Speaker | null;
  speakers: AgendaItemSpeaker[];
  order: number;
};

const ITEM_TYPES = ["session", "keynote", "panel", "workshop", "break", "networking", "other"] as const;
const TYPE_LABELS_ZH: Record<string, string> = {
  session: "议题", keynote: "主旨演讲", panel: "圆桌讨论", workshop: "工作坊",
  break: "休息", networking: "交流", other: "其他",
};

const EMPTY_FORM = {
  agendaDate: "",
  startTime: "09:00",
  endTime: "10:00",
  title: "",
  titleEn: "",
  description: "",
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

export function AdminAgendaClient({
  locale,
  activityId,
  initialItems,
  allSpeakers,
}: {
  locale: Locale;
  activityId: string;
  initialItems: AgendaItem[];
  allSpeakers: Speaker[];
}) {
  const [items, setItems] = useState<AgendaItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setItems((prev) => {
        if (editId) return prev.map((it) => (it.id === editId ? data.item : it));
        return [...prev, data.item];
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
    if (!confirm(locale === "zh" ? "确认删除此议程项目？" : "Delete this agenda item?")) return;
    const res = await fetch(`/api/activities/${activityId}/agenda/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
  }

  const groups = groupByDate(items);

  return (
    <div>
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <h2>{locale === "zh" ? "活动议程管理" : "Agenda Management"}</h2>
        <button className="button button button" onClick={openAdd}>
          {locale === "zh" ? "+ 添加议程项" : "+ Add Item"}
        </button>
      </div>

      {showForm && (
        <div className="data-card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>
            {editId ? (locale === "zh" ? "编辑议程项" : "Edit Item") : (locale === "zh" ? "新建议程项" : "New Item")}
          </h3>
          {error && <div className="form-error form-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "日期 *" : "Date *"}</label>
              <input className="field" type="date" required value={form.agendaDate} onChange={(e) => set("agendaDate", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "开始时间 *" : "Start *"}</label>
              <input className="field" type="time" required value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "结束时间 *" : "End *"}</label>
              <input className="field" type="time" required value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "标题（中文）*" : "Title *"}</label>
              <input className="field" type="text" required value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "标题（英文）" : "Title (EN)"}</label>
              <input className="field" type="text" value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "类型" : "Type"}</label>
              <select className="field" value={form.type} onChange={(e) => set("type", e.target.value)}>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{locale === "zh" ? TYPE_LABELS_ZH[t] : t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "顺序" : "Order"}</label>
              <input className="field" type="number" min={0} value={form.order} onChange={(e) => set("order", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "分会场" : "Venue"}</label>
              <input className="field" type="text" value={form.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "分会场（英文）" : "Venue (EN)"}</label>
              <input className="field" type="text" value={form.venueEn} onChange={(e) => set("venueEn", e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "主持人" : "Moderator"}</label>
              <select className="field" value={form.moderatorId} onChange={(e) => set("moderatorId", e.target.value)}>
                <option value="">{locale === "zh" ? "（不设置）" : "(none)"}</option>
                {allSpeakers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.nameEn ? ` / ${s.nameEn}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "演讲嘉宾（选择多位，按住Ctrl/Cmd）" : "Speakers (multi-select, hold Ctrl/Cmd)"}</label>
              <select
                className="field"
                multiple
                size={Math.min(6, allSpeakers.length + 1)}
                value={form.speakerIds ? form.speakerIds.split(",").map((s) => s.trim()).filter(Boolean) : []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  set("speakerIds", selected.join(","));
                }}
              >
                {allSpeakers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.nameEn ? ` / ${s.nameEn}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{locale === "zh" ? "描述" : "Description"}</label>
              <textarea className="field" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="button button button" disabled={saving} onClick={handleSave}>
              {saving ? (locale === "zh" ? "保存中…" : "Saving…") : (locale === "zh" ? "保存" : "Save")}
            </button>
            <button className="button button-secondary button" disabled={saving} onClick={() => setShowForm(false)}>
              {locale === "zh" ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="proto-admin-empty">
          {locale === "zh" ? "暂无议程项目，点击上方按钮添加。" : "No agenda items yet. Click above to add one."}
        </div>
      )}

      {groups.map(([date, dayItems]) => (
        <div key={date} style={{ marginBottom: "2rem" }}>
          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
            {new Date(`${date}T12:00:00`).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </h3>
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>{locale === "zh" ? "时间" : "Time"}</th>
                  <th>{locale === "zh" ? "议程标题" : "Title"}</th>
                  <th style={{ width: "80px" }}>{locale === "zh" ? "类型" : "Type"}</th>
                  <th>{locale === "zh" ? "主持/嘉宾" : "Moderator/Speakers"}</th>
                  <th style={{ width: "100px" }}>{locale === "zh" ? "操作" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {dayItems.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order).map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "var(--cp-text-small)" }}>{item.startTime} – {item.endTime}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.title}</div>
                      {item.titleEn && <div style={{ color: "#6b7280", fontSize: "var(--cp-text-small)" }}>{item.titleEn}</div>}
                      {item.venue && <div style={{ color: "#9ca3af", fontSize: "var(--cp-text-small)" }}>📍 {item.venue}</div>}
                    </td>
                    <td>
                      <span className="chip chip" style={{ fontSize: "var(--cp-text-caption)" }}>
                        {locale === "zh" ? TYPE_LABELS_ZH[item.type] ?? item.type : item.type}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--cp-text-small)" }}>
                      {item.moderator && <div style={{ marginBottom: "2px" }}>🎤 {item.moderator.name}</div>}
                      {item.speakers.map((sl) => (
                        <div key={sl.id}>{sl.speaker.name}</div>
                      ))}
                    </td>
                    <td>
                      <button className="button button-secondary button" style={{ marginRight: "0.25rem" }} onClick={() => openEdit(item)}>
                        {locale === "zh" ? "编辑" : "Edit"}
                      </button>
                      <button className="button button" style={{ color: "#dc2626" }} onClick={() => handleDelete(item.id)}>
                        {locale === "zh" ? "删除" : "Del"}
                      </button>
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
