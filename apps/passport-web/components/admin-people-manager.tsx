"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { Locale } from "@/lib/site-content";

type PersonRecord = {
  id: string;
  slug: string | null;
  displayName: string;
  displayNameEn: string | null;
  salutation?: string | null;
  title: string | null;
  titleEn: string | null;
  bio?: string | null;
  bioEn?: string | null;
  countryOrRegion?: string | null;
  countryOrRegionEn?: string | null;
  avatar?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  orcid?: string | null;
  verificationStatus: string;
  isPublic: boolean;
  userId: string | null;
  affiliationCount: number;
  roleProfileCount: number;
  speakerCount: number;
};

type InstitutionOption = { id: string; name: string; slug: string };

type Affiliation = {
  id: string;
  institutionId: string | null;
  institution: InstitutionOption | null;
  organizationName: string | null;
  title: string | null;
  isCurrent: boolean;
  status: string;
};

type RoleProfile = {
  id: string;
  roleType: string;
  roleTitle: string | null;
  scopeInstitutionId: string | null;
  scopeInstitution: InstitutionOption | null;
  isVisible: boolean;
};

type PersonDetail = PersonRecord & {
  affiliations: Affiliation[];
  roleProfiles: RoleProfile[];
  speakers: { id: string; name: string; nameEn: string | null }[];
  user: { id: string; email: string; name: string } | null;
};

type PersonFormState = {
  slug: string;
  displayName: string;
  displayNameEn: string;
  salutation: string;
  title: string;
  titleEn: string;
  bio: string;
  bioEn: string;
  countryOrRegion: string;
  countryOrRegionEn: string;
  avatar: string;
  website: string;
  linkedin: string;
  twitter: string;
  orcid: string;
  isPublic: boolean;
  verificationStatus: string;
  userId: string;
};

const defaultState: PersonFormState = {
  slug: "",
  displayName: "",
  displayNameEn: "",
  salutation: "",
  title: "",
  titleEn: "",
  bio: "",
  bioEn: "",
  countryOrRegion: "",
  countryOrRegionEn: "",
  avatar: "",
  website: "",
  linkedin: "",
  twitter: "",
  orcid: "",
  isPublic: false,
  verificationStatus: "DRAFT",
  userId: "",
};

function buildStateFromPerson(person: PersonRecord | PersonDetail): PersonFormState {
  return {
    slug: person.slug ?? "",
    displayName: person.displayName,
    displayNameEn: person.displayNameEn ?? "",
    salutation: ("salutation" in person ? person.salutation : undefined) ?? "",
    title: person.title ?? "",
    titleEn: person.titleEn ?? "",
    bio: ("bio" in person ? person.bio : undefined) ?? "",
    bioEn: ("bioEn" in person ? person.bioEn : undefined) ?? "",
    countryOrRegion: ("countryOrRegion" in person ? person.countryOrRegion : undefined) ?? "",
    countryOrRegionEn: ("countryOrRegionEn" in person ? person.countryOrRegionEn : undefined) ?? "",
    avatar: ("avatar" in person ? person.avatar : undefined) ?? "",
    website: ("website" in person ? person.website : undefined) ?? "",
    linkedin: ("linkedin" in person ? person.linkedin : undefined) ?? "",
    twitter: ("twitter" in person ? person.twitter : undefined) ?? "",
    orcid: ("orcid" in person ? person.orcid : undefined) ?? "",
    isPublic: ("isPublic" in person ? person.isPublic : undefined) ?? false,
    verificationStatus: person.verificationStatus,
    userId: person.userId ?? "",
  };
}

export function AdminPeopleManager({
  locale,
  userRole,
  initialPeople,
  institutions,
}: {
  locale: Locale;
  userRole: UserRole;
  initialPeople: PersonRecord[];
  institutions: InstitutionOption[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  const [selectedId, setSelectedId] = useState<string>("");
  const [formState, setFormState] = useState<PersonFormState>(defaultState);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "affiliations" | "roles">("profile");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(selectedId);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return people;
    return people.filter(
      (p) =>
        p.displayName.toLowerCase().includes(term) ||
        (p.displayNameEn ?? "").toLowerCase().includes(term) ||
        (p.slug ?? "").toLowerCase().includes(term),
    );
  }, [people, search]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setFormState(defaultState);
      return;
    }

    fetch(`/api/admin/people/${selectedId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.person) {
          setDetail(json.person as PersonDetail);
          setFormState(buildStateFromPerson(json.person as PersonDetail));
        }
      })
      .catch(() => setError(locale === "zh" ? "加载详情失败" : "Failed to load detail"));
  }, [selectedId, locale]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
    setFormState((current) => ({ ...current, [target.name]: value }));
  }

  function startCreate() {
    setSelectedId("");
    setDetail(null);
    setError("");
    setStatus("");
    setFormState(defaultState);
    setActiveTab("profile");
  }

  function startEdit(person: PersonRecord) {
    setSelectedId(person.id);
    setError("");
    setStatus("");
    setActiveTab("profile");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formState)) {
      if (key === "slug" && !value) continue;
      if (key === "userId" && !value) continue;
      if (value === "" && !["isPublic"].includes(key)) continue;
      payload[key] = value;
    }

    try {
      const response = await fetch(isEditing ? `/api/admin/people/${selectedId}` : "/api/admin/people", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; person?: PersonRecord };

      if (!response.ok || !result.person) {
        setError(result.error ?? (locale === "zh" ? "保存失败" : "Unable to save person."));
        return;
      }

      const person = result.person;

      setPeople((current) =>
        isEditing
          ? current.map((item) => (item.id === person.id ? person : item))
          : [person, ...current],
      );
      setSelectedId(person.id);
      setStatus(locale === "zh" ? "已保存人员。" : "Person saved.");
      router.refresh();
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addAffiliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      institutionId: (data.get("institutionId") as string) || undefined,
      organizationName: (data.get("organizationName") as string) || undefined,
      title: (data.get("title") as string) || undefined,
      isCurrent: data.get("isCurrent") === "on",
    };

    const response = await fetch(`/api/admin/people/${selectedId}/affiliations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string; affiliation?: Affiliation };
    if (!response.ok || !result.affiliation) {
      setError(result.error ?? (locale === "zh" ? "添加隶属失败" : "Failed to add affiliation."));
      return;
    }
    const affiliation = result.affiliation;
    setDetail((current) => (current ? { ...current, affiliations: [affiliation, ...current.affiliations] } : current));
    form.reset();
    setStatus(locale === "zh" ? "已添加隶属。" : "Affiliation added.");
  }

  async function addRoleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      roleType: data.get("roleType") as string,
      roleTitle: (data.get("roleTitle") as string) || undefined,
      scopeInstitutionId: (data.get("scopeInstitutionId") as string) || undefined,
    };

    const response = await fetch(`/api/admin/people/${selectedId}/role-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string; roleProfile?: RoleProfile };
    if (!response.ok || !result.roleProfile) {
      setError(result.error ?? (locale === "zh" ? "添加角色失败" : "Failed to add role profile."));
      return;
    }
    const roleProfile = result.roleProfile;
    setDetail((current) => (current ? { ...current, roleProfiles: [roleProfile, ...current.roleProfiles] } : current));
    form.reset();
    setStatus(locale === "zh" ? "已添加角色。" : "Role profile added.");
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{locale === "zh" ? "人员清单" : "People inventory"}</span>
            <h2>{locale === "zh" ? "已创建人员" : "Created people"}</h2>
          </div>
          <button className="button-secondary" onClick={startCreate} type="button">
            {locale === "zh" ? "新建人员" : "New person"}
          </button>
        </div>

        <label className="field">
          <span>{locale === "zh" ? "搜索" : "Search"}</span>
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === "zh" ? "姓名 / 英文名 /  slug" : "Name / English name / slug"}
            type="text"
            value={search}
          />
        </label>

        <div className="list admin-list">
          {filteredPeople.map((person) => (
            <button
              className={`list-item admin-list-item ${selectedId === person.id ? "is-active" : ""}`}
              key={person.id}
              onClick={() => startEdit(person)}
              type="button"
            >
              <span className="label">{person.verificationStatus}</span>
              <strong>{person.displayName}</strong>
              {person.title ? <p>{person.title}</p> : null}
              <div className="footer-note compact-note">
                {locale === "zh" ? "隶属" : "Affiliations"}: {person.affiliationCount} ·{" "}
                {locale === "zh" ? "角色" : "Roles"}: {person.roleProfileCount} ·{" "}
                {locale === "zh" ? "演讲者" : "Speakers"}: {person.speakerCount}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{isEditing ? (locale === "zh" ? "编辑模式" : "Editing") : locale === "zh" ? "创建模式" : "Create"}</span>
            <h2>{locale === "zh" ? "人员配置" : "Person configuration"}</h2>
          </div>
        </div>

        {isEditing ? (
          <div className="button-row">
            <button
              className={activeTab === "profile" ? "is-active" : undefined}
              onClick={() => setActiveTab("profile")}
              type="button"
            >
              {locale === "zh" ? "档案" : "Profile"}
            </button>
            <button
              className={activeTab === "affiliations" ? "is-active" : undefined}
              onClick={() => setActiveTab("affiliations")}
              type="button"
            >
              {locale === "zh" ? "隶属" : "Affiliations"}
            </button>
            <button className={activeTab === "roles" ? "is-active" : undefined} onClick={() => setActiveTab("roles")} type="button">
              {locale === "zh" ? "角色" : "Roles"}
            </button>
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "显示名（中文）" : "Display name"}</span>
                <input name="displayName" onChange={updateField} required type="text" value={formState.displayName} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "显示名（英文）" : "Display name (English)"}</span>
                <input name="displayNameEn" onChange={updateField} type="text" value={formState.displayNameEn} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "称谓" : "Salutation"}</span>
                <input name="salutation" onChange={updateField} type="text" value={formState.salutation} />
              </label>
              <label className="field">
                <span>Slug</span>
                <input name="slug" onChange={updateField} type="text" value={formState.slug} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "职位" : "Title"}</span>
                <input name="title" onChange={updateField} type="text" value={formState.title} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "职位（英文）" : "Title (English)"}</span>
                <input name="titleEn" onChange={updateField} type="text" value={formState.titleEn} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "国家/地区" : "Country / Region"}</span>
                <input name="countryOrRegion" onChange={updateField} type="text" value={formState.countryOrRegion} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "国家/地区（英文）" : "Country / Region (English)"}</span>
                <input name="countryOrRegionEn" onChange={updateField} type="text" value={formState.countryOrRegionEn} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "个人网站" : "Website"}</span>
                <input name="website" onChange={updateField} type="url" value={formState.website} />
              </label>
              <label className="field">
                <span>LinkedIn</span>
                <input name="linkedin" onChange={updateField} type="text" value={formState.linkedin} />
              </label>
            </div>

            <label className="field">
              <span>{locale === "zh" ? "简介" : "Bio"}</span>
              <textarea name="bio" onChange={updateField} rows={4} value={formState.bio} />
            </label>

            <label className="field">
              <span>{locale === "zh" ? "简介（英文）" : "Bio (English)"}</span>
              <textarea name="bioEn" onChange={updateField} rows={4} value={formState.bioEn} />
            </label>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "验证状态" : "Verification status"}</span>
                <select name="verificationStatus" onChange={updateField} value={formState.verificationStatus}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING">PENDING</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </label>
              <label className="field">
                <span>{locale === "zh" ? "关联用户 ID" : "Linked user ID"}</span>
                <input name="userId" onChange={updateField} type="text" value={formState.userId} />
              </label>
            </div>

            <div className="toggle-grid">
              <label className="toggle-field">
                <input checked={formState.isPublic} name="isPublic" onChange={updateField} type="checkbox" />
                <span>{locale === "zh" ? "公开" : "Public"}</span>
              </label>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {status ? <p className="form-success">{status}</p> : null}

            <div className="button-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "..." : locale === "zh" ? "保存人员" : "Save person"}
              </button>
              <button className="button-secondary" onClick={startCreate} type="button">
                {locale === "zh" ? "清空" : "Reset"}
              </button>
            </div>
          </form>
        ) : activeTab === "affiliations" ? (
          <div className="form-grid">
            <h3>{locale === "zh" ? "添加隶属" : "Add affiliation"}</h3>
            <form className="form-grid" onSubmit={addAffiliation}>
              <div className="split">
                <label className="field">
                  <span>{locale === "zh" ? "机构" : "Institution"}</span>
                  <select name="institutionId">
                    <option value="">{locale === "zh" ? "选择机构" : "Select institution"}</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{locale === "zh" ? "或组织名称" : "Or organization name"}</span>
                  <input name="organizationName" type="text" />
                </label>
              </div>
              <div className="split">
                <label className="field">
                  <span>{locale === "zh" ? "职位" : "Title"}</span>
                  <input name="title" type="text" />
                </label>
                <label className="toggle-field">
                  <input name="isCurrent" type="checkbox" />
                  <span>{locale === "zh" ? "当前" : "Current"}</span>
                </label>
              </div>
              <div className="button-row">
                <button className="button" type="submit">
                  {locale === "zh" ? "添加隶属" : "Add affiliation"}
                </button>
              </div>
            </form>

            <div className="list admin-list">
              {detail?.affiliations.map((aff) => (
                <div className="list-item admin-list-item" key={aff.id}>
                  <strong>{aff.institution?.name ?? aff.organizationName ?? "—"}</strong>
                  <p>
                    {aff.title ?? "—"} · {aff.status} · {aff.isCurrent ? (locale === "zh" ? "当前" : "Current") : locale === "zh" ? "过往" : "Past"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <h3>{locale === "zh" ? "添加角色档案" : "Add role profile"}</h3>
            <form className="form-grid" onSubmit={addRoleProfile}>
              <div className="split">
                <label className="field">
                  <span>{locale === "zh" ? "角色类型" : "Role type"}</span>
                  <select name="roleType" required>
                    <option value="SPEAKER">SPEAKER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="PANELIST">PANELIST</option>
                    <option value="MENTOR">MENTOR</option>
                    <option value="ORGANIZER">ORGANIZER</option>
                    <option value="PARTNER">PARTNER</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="VOLUNTEER">VOLUNTEER</option>
                    <option value="STAFF">STAFF</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
                <label className="field">
                  <span>{locale === "zh" ? "角色标题" : "Role title"}</span>
                  <input name="roleTitle" type="text" />
                </label>
              </div>
              <label className="field">
                <span>{locale === "zh" ? "范围机构" : "Scope institution"}</span>
                <select name="scopeInstitutionId">
                  <option value="">{locale === "zh" ? "选择机构" : "Select institution"}</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                <button className="button" type="submit">
                  {locale === "zh" ? "添加角色" : "Add role"}
                </button>
              </div>
            </form>

            <div className="list admin-list">
              {detail?.roleProfiles.map((role) => (
                <div className="list-item admin-list-item" key={role.id}>
                  <strong>{role.roleType}</strong>
                  <p>
                    {role.roleTitle ?? "—"} · {role.scopeInstitution?.name ?? "—"} · {role.isVisible ? (locale === "zh" ? "可见" : "Visible") : locale === "zh" ? "隐藏" : "Hidden"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
