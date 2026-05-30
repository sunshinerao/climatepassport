"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/site-content";

type InstitutionOption = {
  id: string;
  name: string;
  nameEn: string | null;
  logo: string | null;
  website: string | null;
};

type ActivityInstitutionLink = {
  id: string;
  institutionId: string;
  role: string | null;
  roleEn: string | null;
  showLogo: boolean;
  order: number;
  createdAt: string;
  institution: InstitutionOption;
};

export function AdminActivityInstitutionsClient({
  locale,
  activityId,
  initialInstitutions,
  availableInstitutions,
}: {
  locale: Locale;
  activityId: string;
  initialInstitutions: ActivityInstitutionLink[];
  availableInstitutions: InstitutionOption[];
}) {
  const zh = locale === "zh";
  const [links, setLinks] = useState(initialInstitutions);
  const [institutionId, setInstitutionId] = useState("");
  const [role, setRole] = useState("");
  const [roleEn, setRoleEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const linkedIds = new Set(links.map((item) => item.institutionId));
    return availableInstitutions.filter((item) => !linkedIds.has(item.id));
  }, [availableInstitutions, links]);

  async function handleAdd() {
    if (!institutionId) {
      setError(zh ? "请选择关联机构" : "Select an institution");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/activities/${activityId}/institutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, role: role || undefined, roleEn: roleEn || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; institution?: ActivityInstitutionLink };
      const institution = payload.institution;
      if (!response.ok || !institution) {
        throw new Error(payload.error ?? (zh ? "关联机构失败" : "Failed to link institution"));
      }

      setLinks((current) => [...current, institution]);
      setInstitutionId("");
      setRole("");
      setRoleEn("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(nextInstitutionId: string) {
    const confirmed = window.confirm(zh ? "确认移除该机构关联？" : "Remove this institution link?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/activities/${activityId}/institutions?institutionId=${encodeURIComponent(nextInstitutionId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? (zh ? "移除机构失败" : "Failed to remove institution"));
      }
      setLinks((current) => current.filter((item) => item.institutionId !== nextInstitutionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="activity-inline-stack">
      <div className="activity-inline-form">
        <label>
          <span>{zh ? "关联机构" : "Institution"}</span>
          <select disabled={saving} onChange={(event) => setInstitutionId(event.target.value)} value={institutionId}>
            <option value="">{zh ? "请选择机构" : "Select institution"}</option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {zh ? item.name : item.nameEn || item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{zh ? "角色说明" : "Role label"}</span>
          <input disabled={saving} onChange={(event) => setRole(event.target.value)} placeholder={zh ? "如：联合主办" : "e.g. Co-host"} value={role} />
        </label>
        <label>
          <span>{zh ? "英文角色" : "Role label EN"}</span>
          <input disabled={saving} onChange={(event) => setRoleEn(event.target.value)} placeholder="e.g. Co-host" value={roleEn} />
        </label>
        <button className="button button" disabled={saving || !institutionId} onClick={() => void handleAdd()} type="button">
          {saving ? (zh ? "处理中…" : "Saving…") : zh ? "添加机构" : "Add institution"}
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {links.length === 0 ? (
        <div className="activity-inline-empty">{zh ? "尚未关联机构，可用于对外展示主办 / 联办单位。" : "No institutions linked yet. Use this to expose hosts and partner organizations."}</div>
      ) : (
        <div className="activity-institution-grid">
          {links.map((item) => (
            <article className="activity-institution-card" key={item.id}>
              <div className="activity-institution-copy">
                <strong>{zh ? item.institution.name : item.institution.nameEn || item.institution.name}</strong>
                {item.role || item.roleEn ? <span>{zh ? item.role || item.roleEn : item.roleEn || item.role}</span> : null}
                {item.institution.website ? (
                  <a href={item.institution.website} rel="noreferrer" target="_blank">
                    {item.institution.website}
                  </a>
                ) : null}
              </div>
              <button className="button button-outline" disabled={saving} onClick={() => void handleRemove(item.institutionId)} type="button">
                {zh ? "移除" : "Remove"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}