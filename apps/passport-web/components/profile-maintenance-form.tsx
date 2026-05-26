"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import type { Locale } from "@/lib/site-content";
import { CountryCombobox } from "@/components/country-combobox";
import { getCountryOptions, getPreferredCountryOptions } from "@/lib/country-options";

const SALUTATION_OPTIONS = ["Dr.", "Prof.", "Mr.", "Ms.", "Mx.", "Rev."] as const;

const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_FILE_SIZE = 500 * 1024;
const MIN_AVATAR_DIMENSION = 200;
const MAX_AVATAR_DIMENSION = 4000;

type ProfilePayload = {
  name: string;
  email: string;
  climatePassportId: string;
  salutation: string;
  phone: string;
  country: string;
  title: string;
  avatar: string;
  bio: string;
  organization: {
    name: string;
    website: string;
    description: string;
  };
};

type TabKey = "basic" | "professional" | "security";

export function ProfileMaintenanceForm({
  locale,
  initialProfile,
}: {
  locale: Locale;
  initialProfile: ProfilePayload;
}) {
  const isZh = locale === "zh";
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  const [salutation, setSalutation] = useState(initialProfile.salutation);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [country, setCountry] = useState(initialProfile.country);
  const [avatar, setAvatar] = useState(initialProfile.avatar);
  const [bio, setBio] = useState(initialProfile.bio);

  const [title, setTitle] = useState(initialProfile.title);
  const [organizationName, setOrganizationName] = useState(initialProfile.organization.name);
  const [organizationWebsite, setOrganizationWebsite] = useState(initialProfile.organization.website);
  const [organizationDescription, setOrganizationDescription] = useState(initialProfile.organization.description);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [avatarMeta, setAvatarMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [avatarFileName, setAvatarFileName] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");

  const countryOptions = getCountryOptions(locale);
  const preferredCountryOptions = getPreferredCountryOptions(locale);

  function isValidWebUrl(value: string) {
    try {
      const url = new URL(value);
      const isHttp = url.protocol === "http:" || url.protocol === "https:";
      const hostname = url.hostname.trim();
      const hasValidHost = hostname === "localhost" || hostname.includes(".");
      return isHttp && hasValidHost;
    } catch {
      return false;
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  async function readAvatarFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read avatar file."));
      reader.readAsDataURL(file);
    });

    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        resolve({ width: image.width, height: image.height });
        URL.revokeObjectURL(objectUrl);
      };
      image.onerror = () => {
        reject(new Error("Failed to parse avatar image."));
        URL.revokeObjectURL(objectUrl);
      };
      image.src = objectUrl;
    });

    return { dataUrl, dimensions };
  }

  async function handleAvatarFileChange(file: File | null) {
    if (!file) {
      return;
    }

    setProfileError("");
    setAvatarFileName(file.name);

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setProfileError(isZh ? "头像仅支持 PNG / JPG / WEBP 格式。" : "Avatar must be PNG, JPG, or WEBP.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setProfileError(
        isZh ? "头像文件不能超过 500KB。" : "Avatar file size must be 500KB or less.",
      );
      return;
    }

    try {
      const { dataUrl, dimensions } = await readAvatarFile(file);

      if (
        dimensions.width < MIN_AVATAR_DIMENSION ||
        dimensions.height < MIN_AVATAR_DIMENSION ||
        dimensions.width > MAX_AVATAR_DIMENSION ||
        dimensions.height > MAX_AVATAR_DIMENSION
      ) {
        setProfileError(
          isZh
            ? `头像尺寸需在 ${MIN_AVATAR_DIMENSION}px ~ ${MAX_AVATAR_DIMENSION}px 之间。`
            : `Avatar dimensions must be between ${MIN_AVATAR_DIMENSION}px and ${MAX_AVATAR_DIMENSION}px.`,
        );
        return;
      }

      setAvatar(dataUrl);
      setAvatarMeta({ width: dimensions.width, height: dimensions.height, size: file.size });
    } catch {
      setProfileError(isZh ? "头像读取失败，请重试。" : "Failed to process avatar image. Please retry.");
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError("");
    setProfileStatus("");

    if (!phone.trim()) {
      setProfileError(isZh ? "联系电话为必填项。" : "Phone is required.");
      setIsSavingProfile(false);
      return;
    }

    if (!country.trim()) {
      setProfileError(isZh ? "国家/地区为必填项。" : "Country/Region is required.");
      setIsSavingProfile(false);
      return;
    }

    if (!organizationName.trim()) {
      setProfileError(isZh ? "机构名称为必填项。" : "Organization name is required.");
      setIsSavingProfile(false);
      return;
    }

    if (organizationWebsite.trim().length > 0 && !isValidWebUrl(organizationWebsite.trim())) {
      setProfileError(
        isZh
          ? "机构网站请输入有效网址（必须以 http:// 或 https:// 开头，例如 https://example.org）。"
          : "Organization website must be a valid URL with http/https (e.g. https://example.org).",
      );
      setIsSavingProfile(false);
      return;
    }

    try {
      const response = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salutation,
          phone,
          country,
          title,
          avatar,
          bio,
          organization: {
            name: organizationName,
            website: organizationWebsite,
            description: organizationDescription,
          },
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setProfileError(result.error ?? (isZh ? "保存失败。" : "Failed to save profile."));
        return;
      }

      setProfileStatus(isZh ? "资料已更新。" : "Profile updated.");
    } catch {
      setProfileError(isZh ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordStatus("");

    if (newPassword.length < 8) {
      setPasswordError(isZh ? "新密码至少 8 位。" : "New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(isZh ? "两次输入的新密码不一致。" : "New password confirmation does not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch("/api/dashboard/profile/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setPasswordError(result.error ?? (isZh ? "修改密码失败。" : "Failed to update password."));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus(isZh ? "密码已更新。" : "Password updated.");
    } catch {
      setPasswordError(isZh ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="profile-maintenance-shell">
      <div className="profile-maintenance-tabs" role="tablist" aria-label={isZh ? "资料维护分组" : "Profile maintenance tabs"}>
        <button
          aria-selected={activeTab === "basic"}
          className={activeTab === "basic" ? "active" : ""}
          onClick={() => setActiveTab("basic")}
          role="tab"
          type="button"
        >
          {isZh ? "基础资料" : "Basic"}
        </button>
        <button
          aria-selected={activeTab === "professional"}
          className={activeTab === "professional" ? "active" : ""}
          onClick={() => setActiveTab("professional")}
          role="tab"
          type="button"
        >
          {isZh ? "职业与机构" : "Professional"}
        </button>
        <button
          aria-selected={activeTab === "security"}
          className={activeTab === "security" ? "active" : ""}
          onClick={() => setActiveTab("security")}
          role="tab"
          type="button"
        >
          {isZh ? "安全设置" : "Security"}
        </button>
      </div>

      {(activeTab === "basic" || activeTab === "professional") && (
        <form className="form-grid" onSubmit={handleProfileSubmit}>
          <div className="profile-maintenance-readonly-grid">
            <label className="field">
              <span>{isZh ? "姓名（不可修改）" : "Name (read-only)"}</span>
              <input disabled readOnly type="text" value={initialProfile.name} />
            </label>
            <label className="field">
              <span>{isZh ? "邮箱（不可修改）" : "Email (read-only)"}</span>
              <input disabled readOnly type="email" value={initialProfile.email} />
            </label>
            <label className="field">
              <span>{isZh ? "Climate Passport ID" : "Climate Passport ID"}</span>
              <input disabled readOnly type="text" value={initialProfile.climatePassportId} />
            </label>
          </div>

          {activeTab === "basic" && (
            <>
              <label className="field">
                <span>{isZh ? "称谓" : "Salutation"}</span>
                <select onChange={(event) => setSalutation(event.target.value)} value={salutation}>
                  <option value="">{isZh ? "请选择称谓" : "Select salutation"}</option>
                  {SALUTATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <div className="profile-maintenance-field-row-two">
                <label className="field">
                  <span>{isZh ? "联系电话" : "Phone"}<span className="req-star">*</span></span>
                  <input onChange={(event) => setPhone(event.target.value)} type="text" value={phone} />
                </label>
                <label className="field">
                  <span>{isZh ? "国家/地区" : "Country/Region"}<span className="req-star">*</span></span>
                  <CountryCombobox
                    ariaLabel={isZh ? "国家或地区" : "Country or Region"}
                    noOptionsText={isZh ? "没有匹配选项" : "No matching options"}
                    onChange={setCountry}
                    options={countryOptions}
                    preferredOptions={preferredCountryOptions}
                    placeholder={isZh ? "输入即可搜索国家/地区" : "Type to search country/region"}
                    value={country}
                  />
                </label>
              </div>
              <label className="field">
                <span>{isZh ? "头像" : "Avatar"}</span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="profile-avatar-input"
                  id="profile-avatar-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleAvatarFileChange(file);
                  }}
                  ref={avatarInputRef}
                  type="file"
                />
                <div className="profile-avatar-upload-row">
                  <button
                    className="profile-avatar-upload-button"
                    onClick={() => avatarInputRef.current?.click()}
                    type="button"
                  >
                    {isZh ? "选择头像文件" : "Choose avatar"}
                  </button>
                  <span className="profile-avatar-upload-filename">
                    {avatarFileName || (isZh ? "未选择文件" : "No file selected")}
                  </span>
                </div>
                <small className="field-hint">
                  {isZh
                    ? "支持 PNG/JPG/WEBP，最大 500KB，建议不小于 200x200 像素。上传成功后可预览并重新上传。"
                    : "Supports PNG/JPG/WEBP, max 500KB, recommended at least 200x200. You can preview and re-upload after upload."}
                </small>
                {avatar ? (
                  <div className="profile-avatar-preview">
                    <Image
                      alt={isZh ? "头像预览" : "Avatar preview"}
                      height={120}
                      src={avatar}
                      unoptimized
                      width={120}
                    />
                    <div className="profile-avatar-meta">
                      {avatarMeta
                        ? isZh
                          ? `${avatarMeta.width}x${avatarMeta.height}px · ${formatFileSize(avatarMeta.size)}`
                          : `${avatarMeta.width}x${avatarMeta.height}px · ${formatFileSize(avatarMeta.size)}`
                        : isZh
                          ? "已存在头像，若需更新请重新上传。"
                          : "Existing avatar loaded. Re-upload to replace it."}
                    </div>
                  </div>
                ) : null}
              </label>
              <label className="field">
                <span>{isZh ? "个人简介" : "Bio"}</span>
                <textarea onChange={(event) => setBio(event.target.value)} rows={5} value={bio} />
              </label>
            </>
          )}

          {activeTab === "professional" && (
            <>
              <label className="field">
                <span>{isZh ? "职位" : "Professional Title"}</span>
                <input onChange={(event) => setTitle(event.target.value)} type="text" value={title} />
              </label>
              <label className="field">
                <span>{isZh ? "机构名称" : "Organization Name"}<span className="req-star">*</span></span>
                <input onChange={(event) => setOrganizationName(event.target.value)} type="text" value={organizationName} />
              </label>
              <label className="field">
                <span>{isZh ? "机构网站" : "Organization Website"}</span>
                <input
                  onChange={(event) => setOrganizationWebsite(event.target.value)}
                  placeholder="https://example.org"
                  type="url"
                  value={organizationWebsite}
                />
              </label>
              <label className="field">
                <span>{isZh ? "机构简介" : "Organization Description"}</span>
                <textarea
                  onChange={(event) => setOrganizationDescription(event.target.value)}
                  rows={5}
                  value={organizationDescription}
                />
              </label>
            </>
          )}

          {profileError ? <p className="form-error">{profileError}</p> : null}
          {profileStatus ? <p className="form-success">{profileStatus}</p> : null}

          <div className="button-row">
            <button className="button" disabled={isSavingProfile} type="submit">
              {isSavingProfile ? "..." : isZh ? "保存资料" : "Save Profile"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "security" && (
        <form className="form-grid" onSubmit={handlePasswordSubmit}>
          <label className="field">
            <span>{isZh ? "当前密码" : "Current Password"}</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="field">
            <span>{isZh ? "新密码（至少 8 位）" : "New Password (min 8 chars)"}</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className="field">
            <span>{isZh ? "确认新密码" : "Confirm New Password"}</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          {passwordStatus ? <p className="form-success">{passwordStatus}</p> : null}

          <div className="button-row">
            <button className="button" disabled={isSavingPassword} type="submit">
              {isSavingPassword ? "..." : isZh ? "更新密码" : "Update Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
