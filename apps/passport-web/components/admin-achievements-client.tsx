"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type AdminAchievementRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  verificationLevel: string;
  points: number;
  createdAt: Date;
  user: {
    name: string;
    email: string;
  };
};

export function AdminAchievementsClient({
  initialRows,
  locale,
}: {
  initialRows: AdminAchievementRow[];
  locale: Locale;
}) {
  const isZh = locale === "zh";
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function mutate(id: string, action: "approve" | "reject" | "revoke") {
    setError("");
    setBusyId(`${id}:${action}`);

    try {
      const response = await fetch(`/api/admin/achievements/${id}/${action}`, {
        method: "POST",
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Operation failed.");
        return;
      }

      const statusMap = {
        approve: "APPROVED",
        reject: "REJECTED",
        revoke: "REVOKED",
      } as const;

      setRows((prev) => prev.map((item) => (item.id === id ? { ...item, status: statusMap[action] } : item)));
    } catch {
      setError(isZh ? "网络错误，请重试。" : "Network error. Please retry.");
    } finally {
      setBusyId("");
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
                <th>{isZh ? "成就" : "Achievement"}</th>
                <th>{isZh ? "类型" : "Type"}</th>
                <th>{isZh ? "状态" : "Status"}</th>
                <th>{isZh ? "验证等级" : "Verification"}</th>
                <th>{isZh ? "积分" : "Points"}</th>
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
                  <td>{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.status}</td>
                  <td>{row.verificationLevel}</td>
                  <td>{row.points}</td>
                  <td>
                    <div className="table-actions">
                      <button className="button-outline" disabled={Boolean(busyId)} onClick={() => mutate(row.id, "approve")} type="button">
                        {isZh ? "通过" : "Approve"}
                      </button>
                      <button className="button-outline" disabled={Boolean(busyId)} onClick={() => mutate(row.id, "reject")} type="button">
                        {isZh ? "拒绝" : "Reject"}
                      </button>
                      <button className="button-outline" disabled={Boolean(busyId)} onClick={() => mutate(row.id, "revoke")} type="button">
                        {isZh ? "撤销" : "Revoke"}
                      </button>
                    </div>
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
