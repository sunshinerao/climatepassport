"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { Locale } from "@/lib/site-content";

type InstitutionRecord = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  shortName: string | null;
  shortNameEn: string | null;
  legalName: string | null;
  aliases: string[];
  orgType: string | null;
  governanceType: string | null;
  countryOrRegion: string | null;
  countryOrRegionEn: string | null;
  website: string | null;
  verificationStatus: string;
  isActive: boolean;
};

type UnlinkedSpeaker = {
  id: string;
  name: string;
  nameEn: string | null;
  title: string | null;
  organization: string;
};

type PersonOption = { id: string; displayName: string };

type InstitutionFormState = {
  slug: string;
  name: string;
  nameEn: string;
  shortName: string;
  shortNameEn: string;
  legalName: string;
  aliases: string;
  orgType: string;
  governanceType: string;
  countryOrRegion: string;
  countryOrRegionEn: string;
  website: string;
  verificationStatus: string;
  publicContactEmail: string;
  publicContactPhone: string;
  headquartersAddress: string;
  foundingYear: string;
};

const defaultState: InstitutionFormState = {
  slug: "",
  name: "",
  nameEn: "",
  shortName: "",
  shortNameEn: "",
  legalName: "",
  aliases: "",
  orgType: "",
  governanceType: "",
  countryOrRegion: "",
  countryOrRegionEn: "",
  website: "",
  verificationStatus: "UNVERIFIED",
  publicContactEmail: "",
  publicContactPhone: "",
  headquartersAddress: "",
  foundingYear: "",
};

function buildStateFromInstitution(institution: InstitutionRecord): InstitutionFormState {
  return {
    slug: institution.slug,
    name: institution.name,
    nameEn: institution.nameEn ?? "",
    shortName: institution.shortName ?? "",
    shortNameEn: institution.shortNameEn ?? "",
    legalName: institution.legalName ?? "",
    aliases: (institution.aliases ?? []).join(", "),
    orgType: institution.orgType ?? "",
    governanceType: institution.governanceType ?? "",
    countryOrRegion: institution.countryOrRegion ?? "",
    countryOrRegionEn: institution.countryOrRegionEn ?? "",
    website: institution.website ?? "",
    verificationStatus: institution.verificationStatus,
    publicContactEmail: "",
    publicContactPhone: "",
    headquartersAddress: "",
    foundingYear: "",
  };
}

export function AdminInstitutionsManager({
  locale,
  userRole,
  initialInstitutions,
}: {
  locale: Locale;
  userRole: UserRole;
  initialInstitutions: InstitutionRecord[];
}) {
  const router = useRouter();
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [selectedId, setSelectedId] = useState<string>("");
  const [formState, setFormState] = useState<InstitutionFormState>(defaultState);
  const [activeTab, setActiveTab] = useState<"directory" | "speakers">("directory");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlinkedSpeakers, setUnlinkedSpeakers] = useState<UnlinkedSpeaker[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [linkState, setLinkState] = useState<Record<string, string>>({});

  const isEditing = Boolean(selectedId);

  const filteredInstitutions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return institutions;
    return institutions.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        (i.nameEn ?? "").toLowerCase().includes(term) ||
        i.slug.toLowerCase().includes(term) ||
        (i.aliases ?? []).some((a) => a.toLowerCase().includes(term)),
    );
  }, [institutions, search]);

  useEffect(() => {
    if (activeTab !== "speakers") return;

    Promise.all([
      fetch("/api/admin/speakers/unlinked?pageSize=100").then((res) => res.json()),
      fetch("/api/admin/people?pageSize=1000").then((res) => res.json()),
    ])
      .then(([speakersJson, peopleJson]) => {
        setUnlinkedSpeakers((speakersJson.speakers ?? []) as UnlinkedSpeaker[]);
        setPeople((peopleJson.people ?? []) as PersonOption[]);
      })
      .catch(() => setError(locale === "zh" ? "加载未关联演讲者失败" : "Failed to load unlinked speakers"));
  }, [activeTab, locale]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target.value;
    setFormState((current) => ({ ...current, [target.name]: value }));
  }

  function startCreate() {
    setSelectedId("");
    setError("");
    setStatus("");
    setFormState(defaultState);
  }

  function startEdit(institution: InstitutionRecord) {
    setSelectedId(institution.id);
    setError("");
    setStatus("");
    setFormState(buildStateFromInstitution(institution));
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formState)) {
      if (value === "" || value === undefined) continue;
      if (key === "aliases") {
        payload[key] = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      } else if (key === "foundingYear") {
        payload[key] = value ? Number(value) : undefined;
      } else {
        payload[key] = value;
      }
    }
    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        isEditing ? `/api/admin/institutions/${selectedId}/governance` : "/api/admin/institutions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        },
      );
      const result = (await response.json()) as { error?: string; institution?: InstitutionRecord };

      if (!response.ok || !result.institution) {
        setError(result.error ?? (locale === "zh" ? "保存失败" : "Unable to save institution."));
        return;
      }

      const institution = result.institution;

      setInstitutions((current) =>
        isEditing
          ? current.map((item) => (item.id === institution.id ? institution : item))
          : [institution, ...current],
      );
      setSelectedId(institution.id);
      setStatus(locale === "zh" ? "已保存机构。" : "Institution saved.");
      router.refresh();
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function linkSpeaker(speakerId: string) {
    const personId = linkState[speakerId];
    if (!personId) return;
    setError("");
    const response = await fetch(`/api/admin/speakers/${speakerId}/person`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? (locale === "zh" ? "关联失败" : "Failed to link speaker."));
      return;
    }
    setUnlinkedSpeakers((current) => current.filter((s) => s.id !== speakerId));
    setStatus(locale === "zh" ? "已关联演讲者。" : "Speaker linked.");
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{locale === "zh" ? "机构清单" : "Institution inventory"}</span>
            <h2>{locale === "zh" ? "已创建机构" : "Created institutions"}</h2>
          </div>
          <button className="button-secondary" onClick={startCreate} type="button">
            {locale === "zh" ? "新建机构" : "New institution"}
          </button>
        </div>

        <label className="field">
          <span>{locale === "zh" ? "搜索" : "Search"}</span>
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === "zh" ? "名称 / slug / 别名" : "Name / slug / alias"}
            type="text"
            value={search}
          />
        </label>

        <div className="button-row">
          <button className={activeTab === "directory" ? "is-active" : undefined} onClick={() => setActiveTab("directory")} type="button">
            {locale === "zh" ? "目录" : "Directory"}
          </button>
          <button className={activeTab === "speakers" ? "is-active" : undefined} onClick={() => setActiveTab("speakers")} type="button">
            {locale === "zh" ? "演讲者关联" : "Speaker links"}
          </button>
        </div>

        {activeTab === "directory" ? (
          <div className="list admin-list">
            {filteredInstitutions.map((institution) => (
              <button
                className={`list-item admin-list-item ${selectedId === institution.id ? "is-active" : ""}`}
                key={institution.id}
                onClick={() => startEdit(institution)}
                type="button"
              >
                <span className="label">{institution.verificationStatus}</span>
                <strong>{institution.name}</strong>
                <p>{institution.slug}</p>
                <div className="footer-note compact-note">
                  {institution.governanceType ?? (locale === "zh" ? "未设置治理类型" : "No governance type")} ·{" "}
                  {institution.isActive ? (locale === "zh" ? "启用" : "Active") : locale === "zh" ? "停用" : "Inactive"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="list admin-list">
            {unlinkedSpeakers.map((speaker) => (
              <div className="list-item admin-list-item" key={speaker.id}>
                <strong>{speaker.name}</strong>
                <p>{speaker.title ?? "—"} · {speaker.organization}</p>
                <div className="footer-note compact-note">
                  <select
                    onChange={(e) => setLinkState((current) => ({ ...current, [speaker.id]: e.target.value }))}
                    value={linkState[speaker.id] ?? ""}
                  >
                    <option value="">{locale === "zh" ? "选择人员" : "Select person"}</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.displayName}
                      </option>
                    ))}
                  </select>
                  <button className="button-secondary" onClick={() => linkSpeaker(speaker.id)} type="button">
                    {locale === "zh" ? "关联" : "Link"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === "directory" ? (
        <div className="panel">
          <div className="section-header compact-header">
            <div>
              <span className="label">
                {isEditing ? (locale === "zh" ? "编辑模式" : "Editing") : locale === "zh" ? "创建模式" : "Create"}
              </span>
              <h2>{locale === "zh" ? "机构配置" : "Institution configuration"}</h2>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "名称" : "Name"}</span>
                <input name="name" onChange={updateField} required type="text" value={formState.name} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "名称（英文）" : "Name (English)"}</span>
                <input name="nameEn" onChange={updateField} type="text" value={formState.nameEn} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>Slug</span>
                <input name="slug" onChange={updateField} required type="text" value={formState.slug} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "机构类型" : "Org type"}</span>
                <input name="orgType" onChange={updateField} type="text" value={formState.orgType} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "法律名称" : "Legal name"}</span>
                <input name="legalName" onChange={updateField} type="text" value={formState.legalName} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "别名（逗号分隔）" : "Aliases (comma separated)"}</span>
                <input name="aliases" onChange={updateField} type="text" value={formState.aliases} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "治理类型" : "Governance type"}</span>
                <input name="governanceType" onChange={updateField} type="text" value={formState.governanceType} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "验证状态" : "Verification status"}</span>
                <select name="verificationStatus" onChange={updateField} value={formState.verificationStatus}>
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="VERIFIED">VERIFIED</option>
                </select>
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

            <label className="field">
              <span>{locale === "zh" ? "网站" : "Website"}</span>
              <input name="website" onChange={updateField} type="url" value={formState.website} />
            </label>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "公开联系邮箱" : "Public contact email"}</span>
                <input name="publicContactEmail" onChange={updateField} type="email" value={formState.publicContactEmail} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "公开联系电话" : "Public contact phone"}</span>
                <input name="publicContactPhone" onChange={updateField} type="text" value={formState.publicContactPhone} />
              </label>
            </div>

            <div className="split">
              <label className="field">
                <span>{locale === "zh" ? "总部地址" : "Headquarters address"}</span>
                <input name="headquartersAddress" onChange={updateField} type="text" value={formState.headquartersAddress} />
              </label>
              <label className="field">
                <span>{locale === "zh" ? "成立年份" : "Founding year"}</span>
                <input name="foundingYear" onChange={updateField} type="number" value={formState.foundingYear} />
              </label>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {status ? <p className="form-success">{status}</p> : null}

            <div className="button-row">
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "..." : locale === "zh" ? "保存机构" : "Save institution"}
              </button>
              <button className="button-secondary" onClick={startCreate} type="button">
                {locale === "zh" ? "清空" : "Reset"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
