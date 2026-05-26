"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type BadgeAwardRow = {
  id: string;
  status: string;
  awardedAt: Date;
  user: { name: string; email: string };
  badgeDefinition: { name: string; code: string; category: string; level: string | null };
};

export function AdminBadgeAwardsClient({
  initialRows,
  locale,
}: {
  initialRows: BadgeAwardRow[];
  locale: Locale;
}) {
  const isZh = locale === "zh";
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");

  async function revoke(id: string) {
    setError("");

    try {
      const response = await fetch(`/api/admin/badge-awards/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin revoke" }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Operation failed.");
        return;
      }

      setRows((prev) => prev.map((item) => (item.id === id ? { ...item, status: "REVOKED" } : item)));
    } catch {
      setError(isZh ? "网络错误，请重试。" : "Network error. Please retry.");
    }
  }

  return (
    <section className="section">
      <div className="panel">
        {error ? <p className="form-error">{error}</p> : null}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{isZh ? "用户" : "User"}</th>
                <th>{isZh ? "徽章" : "Badge"}</th>
                <th>{isZh ? "类别" : "Category"}</th>
                <th>{isZh ? "状态" : "Status"}</th>
                <th>{isZh ? "授予时间" : "Awarded At"}</th>
                <th>{isZh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.user.name}</strong>
                    <div>{row.user.email}</div>
                  </td>
                  <td>
                    <strong>{row.badgeDefinition.name}</strong>
                    <div>{row.badgeDefinition.code}</div>
                  </td>
                  <td>{row.badgeDefinition.category}</td>
                  <td>{row.status}</td>
                  <td>{new Date(row.awardedAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</td>
                  <td>
                    <button className="button-outline" onClick={() => revoke(row.id)} type="button">
                      {isZh ? "撤销" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
