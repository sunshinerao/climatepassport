"use client";

import { useEffect, useState, useCallback } from "react";
import type { Locale } from "@/lib/site-content";

type ApplicationRow = {
  id: string;
  email: string;
  fullName: string;
  preferredName: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  channel: string | null;
  climatePassportId: string | null;
  projectSlug: string;
  applicationStatus: string | null;
  locale: string;
  answersJson: Record<string, unknown> | null;
  submittedAt: string | null;
};

const FIELD_LABELS: Record<string, [string, string]> = {
  fullName: ["全名", "Full name"],
  email: ["邮箱", "Email"],
  phone: ["手机", "Phone"],
  guardianName: ["监护人", "Guardian"],
  channel: ["渠道", "Channel"],
  applicationStatus: ["状态", "Status"],
  submittedAt: ["提交时间", "Submitted at"],
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default function SummerSchoolApplicationsClient({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/summer-school/applications?locale=${locale}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(isZh ? "加载失败，请刷新重试。" : "Failed to load. Please refresh.");
        setLoading(false);
      });
  }, [locale, isZh]);

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadSelected = useCallback(async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    for (const id of selected) {
      const url = `/api/admin/summer-school/applications/${id}/print?locale=${locale}`;
      const win = window.open(url, "_blank");
      if (!win) {
        alert(isZh ? "请允许弹出窗口以下载 PDF。" : "Please allow pop-ups to download PDFs.");
        break;
      }
      // Brief pause to avoid browser blocking rapid pop-ups
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloading(false);
  }, [selected, locale, isZh]);

  const statusLabel = (s: string | null) => {
    if (!s) return "—";
    const map: Record<string, string> = {
      PENDING: isZh ? "待审核" : "Pending",
      APPROVED: isZh ? "已录取" : "Approved",
      REJECTED: isZh ? "未录取" : "Rejected",
      WAITLISTED: isZh ? "候补" : "Waitlisted",
    };
    return map[s] ?? s;
  };

  const channelLabel = (c: string | null) => {
    if (!c) return "—";
    const map: Record<string, string> = { gca: isZh ? "全球气候学院" : "GCA", scw: isZh ? "上海气候周" : "SHCW" };
    return map[c] ?? c;
  };

  if (loading) {
    return <div >{isZh ? "加载中…" : "Loading…"}</div>;
  }
  if (error) {
    return <div >{error}</div>;
  }

  return (
    <div className="ssa-wrapper">
      {/* Toolbar */}
      <div className="ssa-toolbar">
        <span className="ssa-count">
          {isZh ? `共 ${rows.length} 条申请` : `${rows.length} application${rows.length !== 1 ? "s" : ""}`}
          {selected.size > 0 &&
            (isZh ? `，已选 ${selected.size} 条` : `, ${selected.size} selected`)}
        </span>
        <button
          className="ssa-btn-primary"
          disabled={selected.size === 0 || downloading}
          onClick={downloadSelected}
        >
          {downloading
            ? (isZh ? "打开中…" : "Opening…")
            : isZh
            ? `下载选中 PDF（${selected.size}）`
            : `Download PDF (${selected.size})`}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="ssa-empty">{isZh ? "暂无申请记录。" : "No applications yet."}</p>
      ) : (
        <div className="ssa-table-wrap">
          <table className="ssa-table">
            <thead>
              <tr>
                <th className="ssa-th-check">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                    title={isZh ? "全选" : "Select all"}
                  />
                </th>
                <th>{isZh ? "全名" : "Full name"}</th>
                <th>{isZh ? "邮箱" : "Email"}</th>
                <th>{isZh ? "手机" : "Phone"}</th>
                <th>{isZh ? "监护人" : "Guardian"}</th>
                <th>{isZh ? "渠道" : "Channel"}</th>
                <th>{isZh ? "Passport ID" : "Passport ID"}</th>
                <th>{isZh ? "状态" : "Status"}</th>
                <th>{isZh ? "提交时间" : "Submitted"}</th>
                <th>{isZh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "ssa-row-selected" : ""}>
                  <td className="ssa-td-check">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="ssa-td-name">
                    <span className="ssa-fullname">{r.fullName}</span>
                    {r.preferredName && <span className="ssa-preferred">（{r.preferredName}）</span>}
                  </td>
                  <td className="ssa-td-email">{r.email}</td>
                  <td className="ssa-td-phone">{r.phone ?? "—"}</td>
                  <td className="ssa-td-guardian">
                    {r.guardianName ?? "—"}
                    {r.guardianEmail && <div className="ssa-guardian-email">{r.guardianEmail}</div>}
                  </td>
                  <td>{channelLabel(r.channel)}</td>
                  <td className="ssa-td-passportid">
                    <code>{r.climatePassportId ?? "—"}</code>
                  </td>
                  <td>
                    <span className={`ssa-badge ssa-badge-${(r.applicationStatus ?? "").toLowerCase()}`}>
                      {statusLabel(r.applicationStatus)}
                    </span>
                  </td>
                  <td className="ssa-td-date">{fmtDate(r.submittedAt)}</td>
                  <td className="ssa-td-actions">
                    <a
                      className="ssa-btn-link"
                      href={`/api/admin/summer-school/applications/${r.id}/print?locale=${locale}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {isZh ? "打印/PDF" : "Print/PDF"}
                    </a>
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
