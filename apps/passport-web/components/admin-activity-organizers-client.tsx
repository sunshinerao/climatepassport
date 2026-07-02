"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Organizer {
  id: string;
  name: string;
  email: string;
  role: string;
  organizedActivityCount: number;
}

interface Props {
  organizers: Organizer[];
  locale: string;
}

function RoleToggleButton({ userId, currentRole, locale }: { userId: string; currentRole: string; locale: string }) {
  const router = useRouter();
  const zh = locale === "zh";
  const [loading, setLoading] = useState(false);

  const isManager = currentRole === "EVENT_MANAGER";

  async function handle() {
    const newRole = isManager ? "ATTENDEE" : "EVENT_MANAGER";
    const msg = isManager
      ? (zh ? `确定撤销该用户的活动主办方权限吗？` : `Revoke Event Manager role from this user?`)
      : (zh ? `确定授予该用户活动主办方权限吗？` : `Grant Event Manager role to this user?`);
    if (!confirm(msg)) return;
    setLoading(true);
    await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      className={`button button ${isManager ? "button" : "button"}`}
      onClick={handle}
      disabled={loading}
    >
      {loading ? "…" : isManager ? (zh ? "撤销权限" : "Revoke") : (zh ? "授予主办方" : "Grant Manager")}
    </button>
  );
}

export default function AdminActivityOrganizersClient({ organizers, locale }: Props) {
  const zh = locale === "zh";
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? organizers.filter(
        (o) =>
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.email.toLowerCase().includes(search.toLowerCase())
      )
    : organizers;

  const managers = filtered.filter((o) => o.role === "EVENT_MANAGER");
  const others = filtered.filter((o) => o.role !== "EVENT_MANAGER");

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <input
          className="field"
          placeholder={zh ? "搜索用户名或邮箱…" : "Search name or email…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "24rem" }}
        />
      </div>

      <h3 style={{ marginBottom: "0.5rem", fontSize: "var(--cp-text-body)", fontWeight: 600 }}>
        {zh ? `当前主办方（${managers.length} 人）` : `Current Managers (${managers.length})`}
      </h3>

      {managers.length === 0 ? (
        <div className="form-error form-success" style={{ marginBottom: "1rem" }}>
          {zh ? "暂无活动主办方用户。" : "No Event Manager users yet."}
        </div>
      ) : (
        <div  style={{ marginBottom: "1.5rem" }}>
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "姓名" : "Name"}</th>
                <th>{zh ? "邮箱" : "Email"}</th>
                <th>{zh ? "负责活动数" : "Activities"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ fontSize: "var(--cp-text-small)" }}>{u.email}</td>
                  <td>
                    <span className="chip chip">{u.organizedActivityCount}</span>
                  </td>
                  <td>
                    <RoleToggleButton userId={u.id} currentRole={u.role} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: "0.5rem", fontSize: "var(--cp-text-body)", fontWeight: 600 }}>
        {zh ? `其他用户（可授权，共 ${others.length} 条结果）` : `Other Users (${others.length} results)`}
      </h3>

      {others.length === 0 ? (
        <div className="form-error form-success">
          {zh ? "没有匹配的用户。" : "No matching users."}
        </div>
      ) : (
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "姓名" : "Name"}</th>
                <th>{zh ? "邮箱" : "Email"}</th>
                <th>{zh ? "当前角色" : "Role"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {others.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ fontSize: "var(--cp-text-small)" }}>{u.email}</td>
                  <td><span className="chip chip">{u.role}</span></td>
                  <td>
                    <RoleToggleButton userId={u.id} currentRole={u.role} locale={locale} />
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
