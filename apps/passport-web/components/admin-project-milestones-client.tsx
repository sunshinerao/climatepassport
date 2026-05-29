"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  orderIndex: number;
  deliverables: { id: string; status: string; submissionId: string | null }[];
}

interface Props {
  activityId: string;
  locale: string;
  milestones: Milestone[];
}

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  upcoming:    { zh: "待开始", en: "Upcoming" },
  in_progress: { zh: "进行中", en: "In Progress" },
  completed:   { zh: "已完成", en: "Completed" },
  cancelled:   { zh: "已取消", en: "Cancelled" },
};

function MilestoneDeleteButton({ id, locale }: { id: string; locale: string }) {
  const router = useRouter();
  const zh = locale === "zh";
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(zh ? "确定删除该里程碑？此操作不可撤销。" : "Delete this milestone? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/project-milestones?id=${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      className="button button button"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? "…" : (zh ? "删除" : "Delete")}
    </button>
  );
}

function MilestoneStatusButton({ id, currentStatus, locale }: { id: string; currentStatus: string; locale: string }) {
  const router = useRouter();
  const zh = locale === "zh";
  const [loading, setLoading] = useState(false);

  const nextStatus: Record<string, string> = {
    upcoming:    "in_progress",
    in_progress: "completed",
    completed:   "upcoming",
    cancelled:   "upcoming",
  };
  const next = nextStatus[currentStatus] ?? "in_progress";
  const nextLabel = STATUS_LABELS[next]?.[zh ? "zh" : "en"] ?? next;

  async function handleUpdate() {
    setLoading(true);
    await fetch(`/api/project-milestones?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button className="button button" onClick={handleUpdate} disabled={loading}>
      {loading ? "…" : `→ ${nextLabel}`}
    </button>
  );
}

export default function AdminProjectMilestonesClient({ activityId, locale, milestones }: Props) {
  const router = useRouter();
  const zh = locale === "zh";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError(zh ? "标题不能为空" : "Title is required"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/project-milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate || null,
        orderIndex: milestones.length,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? (zh ? "创建失败" : "Failed to create"));
      return;
    }
    setForm({ title: "", description: "", dueDate: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <button className="button button" onClick={() => { setOpen(!open); setError(""); }}>
          {open ? (zh ? "收起" : "Cancel") : (zh ? "+ 添加里程碑" : "+ Add Milestone")}
        </button>
      </div>

      {open && (
        <form className="form-grid" onSubmit={handleCreate} style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }}>
          <div className="field">
            <label>{zh ? "标题" : "Title"} *</label>
            <input className="field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={zh ? "里程碑名称" : "Milestone title"} />
          </div>
          <div className="field">
            <label>{zh ? "描述（可选）" : "Description (optional)"}</label>
            <textarea className="field" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="field">
            <label>{zh ? "截止日期（可选）" : "Due Date (optional)"}</label>
            <input type="date" className="field" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          {error && <div className="form-error form-error">{error}</div>}
          <button type="submit" className="button button button" disabled={loading}>
            {loading ? (zh ? "创建中…" : "Creating…") : (zh ? "创建里程碑" : "Create Milestone")}
          </button>
        </form>
      )}

      {milestones.length === 0 ? (
        <div className="form-error form-success">
          {zh ? "暂无里程碑，点击上方按钮添加。" : "No milestones yet. Use the button above to add one."}
        </div>
      ) : (
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>#</th>
                <th>{zh ? "标题" : "Title"}</th>
                <th>{zh ? "截止日期" : "Due Date"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "成果件" : "Deliverables"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
                  <td>
                    <strong>{m.title}</strong>
                    {m.description && <div style={{ fontSize: "0.82em", color: "var(--color-text-muted)" }}>{m.description}</div>}
                  </td>
                  <td>{m.dueDate ? new Date(m.dueDate).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—"}</td>
                  <td>
                    <span className={`chip ${m.status === "completed" ? "cpca-badge cpca-badge-green" : m.status === "in_progress" ? "cpca-badge cpca-badge-blue" : "chip"}`}>
                      {STATUS_LABELS[m.status]?.[zh ? "zh" : "en"] ?? m.status}
                    </span>
                  </td>
                  <td>
                    <span className="chip chip">{m.deliverables.length}</span>
                  </td>
                  <td style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <MilestoneStatusButton id={m.id} currentStatus={m.status} locale={locale} />
                    <MilestoneDeleteButton id={m.id} locale={locale} />
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
