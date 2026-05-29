"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Locale } from "@/lib/site-content";

type ApplicationUser = {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  climatePassportId: string | null;
};

type ApplicationRow = {
  id: string;
  userId: string;
  activityId: string;
  roleType: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  formResponseJson: any;
  user: ApplicationUser;
};

type Stats = {
  approvedCount: number;
  capacity: number | null;
  byStatus: Record<string, number>;
};

type ActivityDetail = {
  id: string;
  title: string;
  capacity: number | null;
  registrationCloseAt: string | null;
};

const STATUS_LABEL: Record<string, { zh: string; en: string }> = {
  SUBMITTED: { zh: "已提交", en: "Submitted" },
  PENDING_REVIEW: { zh: "审核中", en: "Pending Review" },
  APPROVED: { zh: "已通过", en: "Approved" },
  REJECTED: { zh: "已拒绝", en: "Rejected" },
  WAITLISTED: { zh: "候补", en: "Waitlisted" },
  CANCELLED: { zh: "已取消", en: "Cancelled" },
  WITHDRAWN: { zh: "已撤回", en: "Withdrawn" },
  DRAFT: { zh: "草稿", en: "Draft" },
};

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "chip cpca-badge cpca-badge-blue",
  PENDING_REVIEW: "chip cpca-badge cpca-badge-amber",
  APPROVED: "chip cpca-badge cpca-badge-green",
  REJECTED: "chip cpca-badge cpca-badge-red",
  WAITLISTED: "chip cpca-badge cpca-badge-amber",
  CANCELLED: "chip cpca-badge cpca-badge-gray",
  WITHDRAWN: "chip cpca-badge cpca-badge-gray",
  DRAFT: "chip cpca-badge cpca-badge-gray",
};

const TABS = [
  { key: "ALL", zh: "全部", en: "All" },
  { key: "PENDING_REVIEW", zh: "待审批", en: "Pending" },
  { key: "APPROVED", zh: "已通过", en: "Approved" },
  { key: "REJECTED", zh: "已拒绝", en: "Rejected" },
  { key: "WAITLISTED", zh: "候补", en: "Waitlisted" },
];

export function AdminActivityApplicationsClient({
  locale,
  activityId,
  applications,
  reviewerUserId,
}: {
  locale: Locale;
  activityId: string;
  applications: ApplicationRow[];
  reviewerUserId: string;
}) {
  const [rows, setRows] = useState<ApplicationRow[]>(applications);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const zh = locale === "zh";

  const t = (obj: { zh: string; en: string }) => obj[zh ? "zh" : "en"];

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [appRes, actRes] = await Promise.all([
        fetch(`/api/activities/${activityId}/applications`),
        fetch(`/api/activities/${activityId}`),
      ]);
      if (appRes.ok) {
        const data = await appRes.json();
        setRows(data.applications ?? []);
        setStats(data.stats ?? null);
      }
      if (actRes.ok) {
        const data = await actRes.json();
        setActivity(data.activity ?? null);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (activeTab !== "ALL") {
      list = list.filter((r) => r.status === activeTab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.user.name ?? "").toLowerCase().includes(q) ||
          (r.user.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, activeTab, search]);

  const allSelectableIds = useMemo(
    () =>
      new Set(
        filteredRows
          .filter((r) => r.status === "SUBMITTED" || r.status === "PENDING_REVIEW")
          .map((r) => r.id)
      ),
    [filteredRows]
  );

  const isAllSelected = allSelectableIds.size > 0 && [...allSelectableIds].every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allSelectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allSelectableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleReview(id: string, status: "APPROVED" | "REJECTED" | "WAITLISTED") {
    setPendingId(id);
    try {
      const res = await fetch(`/api/activity-applications/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewComment: commentMap[id],
          reviewedByUserId: reviewerUserId,
        }),
      });
      if (res.ok) {
        const { application } = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: application.status,
                  reviewedAt: application.reviewedAt,
                  reviewComment: application.reviewComment,
                }
              : r
          )
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadData();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPendingId(null);
    }
  }

  async function handleBatchReview(status: "APPROVED" | "REJECTED" | "WAITLISTED") {
    if (selectedIds.size === 0) return;
    if (!confirm(zh ? `确认批量${STATUS_LABEL[status].zh} ${selectedIds.size} 条申请？` : `Batch ${STATUS_LABEL[status].en} ${selectedIds.size} applications?`)) return;
    setBatchPending(true);
    try {
      const res = await fetch(`/api/activity-applications/batch-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status,
        }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (zh ? "批量操作失败" : "Batch review failed"));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBatchPending(false);
    }
  }

  function handleExportCsv() {
    const url = `/api/activities/${activityId}/applications/export${activeTab !== "ALL" ? `?status=${activeTab}` : ""}`;
    window.open(url, "_blank");
  }

  const approvedCount = stats?.approvedCount ?? 0;
  const capacity = stats?.capacity ?? activity?.capacity ?? null;
  const registrationCloseAt = activity?.registrationCloseAt;

  return (
    <div className="section">
      {error && (
        <div className="form-error form-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {capacity !== null && (
            <span className="chip chip">
              {zh ? "已批准 / 容量" : "Approved / Capacity"}: {approvedCount} / {capacity}
            </span>
          )}
          {registrationCloseAt && (
            <span className="chip chip">
              {zh ? "报名截止" : "Deadline"}: {new Date(registrationCloseAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}
            </span>
          )}
        </div>
        <button className="button button button-secondary" onClick={handleExportCsv}>
          {zh ? "导出 CSV" : "Export CSV"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem", borderBottom: "1px solid #e5e7eb" }}>
        {TABS.map((tab) => {
          const count =
            tab.key === "ALL"
              ? rows.length
              : (stats?.byStatus?.[tab.key] ?? 0);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedIds(new Set());
              }}
              style={{
                padding: "0.5rem 0.75rem",
                borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                color: isActive ? "#2563eb" : "#6b7280",
                fontWeight: isActive ? 600 : 400,
                background: "none",
                border: "none",
                borderBottomWidth: "2px",
                borderBottomStyle: "solid",
                borderBottomColor: isActive ? "#2563eb" : "transparent",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              {t(tab)} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
        <input
          className="field"
          placeholder={zh ? "搜索姓名或邮箱…" : "Search by name or email…"}
          style={{ maxWidth: "320px", flex: 1 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selectedIds.size > 0 && (
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", marginRight: "0.25rem" }}>
              {selectedIds.size} {zh ? "条已选" : "selected"}
            </span>
            <button
              className="button button button"
              disabled={batchPending}
              onClick={() => handleBatchReview("APPROVED")}
            >
              {zh ? "通过" : "Approve"}
            </button>
            <button
              className="button button button"
              disabled={batchPending}
              onClick={() => handleBatchReview("WAITLISTED")}
            >
              {zh ? "候补" : "Waitlist"}
            </button>
            <button
              className="button button button"
              disabled={batchPending}
              onClick={() => handleBatchReview("REJECTED")}
            >
              {zh ? "拒绝" : "Reject"}
            </button>
          </div>
        )}
      </div>

      <div >
        <table className="tableish">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  disabled={allSelectableIds.size === 0}
                />
              </th>
              <th>{zh ? "姓名" : "Name"}</th>
              <th>{zh ? "邮箱" : "Email"}</th>
              <th>{zh ? "角色类型" : "Role"}</th>
              <th>{zh ? "状态" : "Status"}</th>
              <th>{zh ? "提交时间" : "Submitted"}</th>
              <th>{zh ? "审核意见" : "Comment"}</th>
              <th style={{ minWidth: "200px" }}>{zh ? "操作" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                  {zh ? "暂无申请" : "No applications"}
                </td>
              </tr>
            ) : (
              filteredRows.map((app) => {
                const canReview = app.status === "SUBMITTED" || app.status === "PENDING_REVIEW";
                return (
                  <tr key={app.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        disabled={!canReview}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{app.user.name ?? "—"}</div>
                      {app.user.climatePassportId && (
                        <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace" }}>
                          {app.user.climatePassportId}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{app.user.email}</td>
                    <td>{app.roleType ?? "—"}</td>
                    <td>
                      <span className={STATUS_BADGE[app.status] ?? "chip"}>
                        {STATUS_LABEL[app.status]?.[zh ? "zh" : "en"] ?? app.status}
                      </span>
                    </td>
                    <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—"}</td>
                    <td>
                      {canReview && (
                        <input
                          className="field field"
                          placeholder={zh ? "可选审核意见" : "Optional comment"}
                          style={{ width: "10rem" }}
                          value={commentMap[app.id] ?? ""}
                          onChange={(e) =>
                            setCommentMap((m) => ({ ...m, [app.id]: e.target.value }))
                          }
                        />
                      )}
                      {app.reviewComment && !canReview && (
                        <span style={{ fontSize: "0.85rem" }}>{app.reviewComment}</span>
                      )}
                    </td>
                    <td>
                      {canReview ? (
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button
                            className="button button button"
                            disabled={pendingId === app.id}
                            type="button"
                            onClick={() => handleReview(app.id, "APPROVED")}
                          >
                            {zh ? "通过" : "Approve"}
                          </button>
                          <button
                            className="button button button"
                            disabled={pendingId === app.id}
                            type="button"
                            onClick={() => handleReview(app.id, "WAITLISTED")}
                          >
                            {zh ? "候补" : "Waitlist"}
                          </button>
                          <button
                            className="button button button"
                            disabled={pendingId === app.id}
                            type="button"
                            onClick={() => handleReview(app.id, "REJECTED")}
                          >
                            {zh ? "拒绝" : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                          {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
