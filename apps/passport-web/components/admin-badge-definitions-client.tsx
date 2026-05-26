"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type BadgeDefinitionRow = {
  id: string;
  code: string;
  name: string;
  nameZh: string | null;
  category: string;
  level: string | null;
  verificationGrade: string;
  isActive: boolean;
  displayOrder: number;
};

export function AdminBadgeDefinitionsClient({
  initialRows,
  locale,
}: {
  initialRows: BadgeDefinitionRow[];
  locale: Locale;
}) {
  const isZh = locale === "zh";
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");

  async function toggle(id: string, nextActive: boolean) {
    setError("");

    try {
      const response = await fetch(`/api/admin/badge-definitions/${id}/${nextActive ? "activate" : "deactivate"}`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Operation failed.");
        return;
      }

      setRows((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: nextActive } : item)));
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
                <th>{isZh ? "编码" : "Code"}</th>
                <th>{isZh ? "名称" : "Name"}</th>
                <th>{isZh ? "类别" : "Category"}</th>
                <th>{isZh ? "等级" : "Level"}</th>
                <th>{isZh ? "可信等级" : "Verification"}</th>
                <th>{isZh ? "状态" : "Status"}</th>
                <th>{isZh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{isZh ? row.nameZh ?? row.name : row.name}</td>
                  <td>{row.category}</td>
                  <td>{row.level ?? "-"}</td>
                  <td>{row.verificationGrade}</td>
                  <td>{row.isActive ? (isZh ? "启用" : "Active") : (isZh ? "停用" : "Inactive")}</td>
                  <td>
                    <button
                      className="button-outline"
                      onClick={() => toggle(row.id, !row.isActive)}
                      type="button"
                    >
                      {row.isActive ? (isZh ? "停用" : "Deactivate") : (isZh ? "启用" : "Activate")}
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
