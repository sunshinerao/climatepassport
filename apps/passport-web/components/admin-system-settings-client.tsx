"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Locale } from "@/lib/site-content";

type SiteSettingsPayload = {
  siteName: string;
  siteNameEn: string | null;
  shortName: string | null;
  tagline: string | null;
  taglineEn: string | null;
  logoColor: string | null;
  logoMono: string | null;
  favicon: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWebsite: string | null;
  copyrightText: string | null;
  copyrightTextEn: string | null;
  icpNumber: string | null;
  themeColor: string | null;
  themeColorDark: string | null;
};

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_IMAGE_SIZE = 700 * 1024;

function toOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readFileAsDataUrl(file: File | null) {
  if (!file) {
    return null;
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export function AdminSystemSettingsClient({
  locale,
  initialSettings,
}: {
  locale: Locale;
  initialSettings: SiteSettingsPayload | null;
}) {
  const isZh = locale === "zh";
  const router = useRouter();

  const [siteName, setSiteName] = useState(initialSettings?.siteName ?? "Climate Passport");
  const [siteNameEn, setSiteNameEn] = useState(initialSettings?.siteNameEn ?? "Climate Passport");
  const [shortName, setShortName] = useState(initialSettings?.shortName ?? "CP");
  const [tagline, setTagline] = useState(initialSettings?.tagline ?? "面向气候时代的可信数字身份基础设施");
  const [taglineEn, setTaglineEn] = useState(initialSettings?.taglineEn ?? "Trusted digital identity infrastructure for the climate era.");

  const [logoColor, setLogoColor] = useState(initialSettings?.logoColor ?? "");
  const [logoMono, setLogoMono] = useState(initialSettings?.logoMono ?? "");
  const [favicon, setFavicon] = useState(initialSettings?.favicon ?? "");

  const [supportEmail, setSupportEmail] = useState(initialSettings?.supportEmail ?? "contact@climatepass.org");
  const [supportPhone, setSupportPhone] = useState(initialSettings?.supportPhone ?? "");
  const [supportWebsite, setSupportWebsite] = useState(initialSettings?.supportWebsite ?? "");
  const [copyrightText, setCopyrightText] = useState(initialSettings?.copyrightText ?? "© 2026 Climate Passport. 保留所有权利。面向气候时代的可信数字身份基础设施。");
  const [copyrightTextEn, setCopyrightTextEn] = useState(initialSettings?.copyrightTextEn ?? "© 2026 Climate Passport. All rights reserved. Trusted digital identity infrastructure for the climate era.");
  const [icpNumber, setIcpNumber] = useState(initialSettings?.icpNumber ?? "");
  const [themeColor, setThemeColor] = useState(initialSettings?.themeColor ?? "#1f5a4e");
  const [themeColorDark, setThemeColorDark] = useState(initialSettings?.themeColorDark ?? "#12382f");

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingImageReads, setPendingImageReads] = useState(0);
  const [logoColorFileName, setLogoColorFileName] = useState("");
  const [logoMonoFileName, setLogoMonoFileName] = useState("");
  const [faviconFileName, setFaviconFileName] = useState("");
  const logoColorInputRef = useRef<HTMLInputElement | null>(null);
  const logoMonoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImagePick(
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
    setFileName: (value: string) => void,
    label: string,
  ) {
    setError("");

    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setFileName(file.name);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError(isZh ? `${label} 仅支持 PNG/JPG/WEBP/SVG。` : `${label} only supports PNG/JPG/WEBP/SVG.`);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError(isZh ? `${label} 文件不能超过 700KB。` : `${label} file must be 700KB or less.`);
      return;
    }

    setPendingImageReads((count) => count + 1);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl) {
        setter(dataUrl);
      }
    } catch {
      setError(isZh ? "图片读取失败，请重试。" : "Failed to read image file. Please retry.");
    } finally {
      setPendingImageReads((count) => Math.max(0, count - 1));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!siteName.trim()) {
      setError(isZh ? "网站名称不能为空。" : "Site name is required.");
      return;
    }

    if (pendingImageReads > 0) {
      setError(isZh ? "图片仍在处理中，请稍候再保存。" : "Images are still processing. Please save again in a moment.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/system/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteName,
          siteNameEn: toOptional(siteNameEn),
          shortName: toOptional(shortName),
          tagline: toOptional(tagline),
          taglineEn: toOptional(taglineEn),
          logoColor: toOptional(logoColor),
          logoMono: toOptional(logoMono),
          favicon: toOptional(favicon),
          supportEmail: toOptional(supportEmail),
          supportPhone: toOptional(supportPhone),
          supportWebsite: toOptional(supportWebsite),
          copyrightText: toOptional(copyrightText),
          copyrightTextEn: toOptional(copyrightTextEn),
          icpNumber: toOptional(icpNumber),
          themeColor: toOptional(themeColor),
          themeColorDark: toOptional(themeColorDark),
        }),
      });

      let result: { error?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (!response.ok) {
        setError(result.error ?? (isZh ? "保存失败。" : "Failed to save settings."));
        return;
      }

      setStatus(isZh ? "系统管理设置已保存。" : "System settings saved.");
      router.refresh();
    } catch {
      setError(isZh ? "网络异常，请稍后重试。" : "Network error. Please retry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>{isZh ? "网站名称" : "Site name"}<span className="req-star">*</span></span>
              <input onChange={(event) => setSiteName(event.target.value)} type="text" value={siteName} />
            </label>
            <label className="field">
              <span>{isZh ? "网站英文名称" : "Site name (EN)"}</span>
              <input onChange={(event) => setSiteNameEn(event.target.value)} type="text" value={siteNameEn} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "短名称" : "Short name"}</span>
              <input onChange={(event) => setShortName(event.target.value)} type="text" value={shortName} />
            </label>
            <label className="field">
              <span>{isZh ? "ICP备案号（可选）" : "ICP number (optional)"}</span>
              <input onChange={(event) => setIcpNumber(event.target.value)} type="text" value={icpNumber} />
            </label>
          </div>

          <label className="field">
            <span>{isZh ? "网站标语" : "Tagline"}</span>
            <input onChange={(event) => setTagline(event.target.value)} type="text" value={tagline} />
          </label>

          <label className="field">
            <span>{isZh ? "网站标语（英文）" : "Tagline (EN)"}</span>
            <input onChange={(event) => setTaglineEn(event.target.value)} type="text" value={taglineEn} />
          </label>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "彩色 Logo" : "Color logo"}</span>
              <input
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="file-upload-input"
                onChange={(event) => void handleImagePick(event, setLogoColor, setLogoColorFileName, isZh ? "彩色 Logo" : "Color logo")}
                ref={logoColorInputRef}
                type="file"
              />
              <div className="file-upload-row">
                <button className="file-upload-button" onClick={() => logoColorInputRef.current?.click()} type="button">
                  {isZh ? "选择文件" : "Choose file"}
                </button>
                <span className="file-upload-filename">{logoColorFileName || (isZh ? "未选择文件" : "No file selected")}</span>
              </div>
              <small className="field-hint">{isZh ? "支持 PNG/JPG/WEBP/SVG，最大 700KB。" : "Supports PNG/JPG/WEBP/SVG, max 700KB."}</small>
              {logoColor ? (
                <div className="file-upload-preview">
                  <Image alt={isZh ? "彩色 Logo 预览" : "Color logo preview"} className="file-upload-preview-image" height={84} src={logoColor} unoptimized width={84} />
                  <div className="file-upload-meta">{isZh ? "已加载当前彩色 Logo，可重新选择替换。" : "Current color logo loaded. Re-upload to replace."}</div>
                </div>
              ) : null}
            </label>
            <label className="field">
              <span>{isZh ? "反白 Logo" : "Mono logo"}</span>
              <input
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="file-upload-input"
                onChange={(event) => void handleImagePick(event, setLogoMono, setLogoMonoFileName, isZh ? "反白 Logo" : "Mono logo")}
                ref={logoMonoInputRef}
                type="file"
              />
              <div className="file-upload-row">
                <button className="file-upload-button" onClick={() => logoMonoInputRef.current?.click()} type="button">
                  {isZh ? "选择文件" : "Choose file"}
                </button>
                <span className="file-upload-filename">{logoMonoFileName || (isZh ? "未选择文件" : "No file selected")}</span>
              </div>
              <small className="field-hint">{isZh ? "支持 PNG/JPG/WEBP/SVG，最大 700KB。" : "Supports PNG/JPG/WEBP/SVG, max 700KB."}</small>
              {logoMono ? (
                <div className="file-upload-preview">
                  <Image alt={isZh ? "反白 Logo 预览" : "Mono logo preview"} className="file-upload-preview-image" height={84} src={logoMono} unoptimized width={84} />
                  <div className="file-upload-meta">{isZh ? "已加载当前反白 Logo，可重新选择替换。" : "Current mono logo loaded. Re-upload to replace."}</div>
                </div>
              ) : null}
            </label>
          </div>

          <label className="field">
            <span>{isZh ? "Favicon" : "Favicon"}</span>
            <input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="file-upload-input"
              onChange={(event) => void handleImagePick(event, setFavicon, setFaviconFileName, "Favicon")}
              ref={faviconInputRef}
              type="file"
            />
            <div className="file-upload-row">
              <button className="file-upload-button" onClick={() => faviconInputRef.current?.click()} type="button">
                {isZh ? "选择文件" : "Choose file"}
              </button>
              <span className="file-upload-filename">{faviconFileName || (isZh ? "未选择文件" : "No file selected")}</span>
            </div>
            <small className="field-hint">{isZh ? "支持 PNG/JPG/WEBP/SVG，最大 700KB。" : "Supports PNG/JPG/WEBP/SVG, max 700KB."}</small>
            {favicon ? (
              <div className="file-upload-preview">
                <Image alt="Favicon preview" className="file-upload-preview-image" height={64} src={favicon} unoptimized width={64} />
                <div className="file-upload-meta">{isZh ? "已加载当前 Favicon，可重新选择替换。" : "Current favicon loaded. Re-upload to replace."}</div>
              </div>
            ) : null}
          </label>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "支持邮箱" : "Support email"}</span>
              <input onChange={(event) => setSupportEmail(event.target.value)} type="email" value={supportEmail} />
            </label>
            <label className="field">
              <span>{isZh ? "支持电话" : "Support phone"}</span>
              <input onChange={(event) => setSupportPhone(event.target.value)} type="text" value={supportPhone} />
            </label>
          </div>

          <label className="field">
            <span>{isZh ? "支持网站" : "Support website"}</span>
            <input onChange={(event) => setSupportWebsite(event.target.value)} placeholder="https://example.org" type="url" value={supportWebsite} />
          </label>

          <div className="field-row">
            <label className="field">
              <span>{isZh ? "主题色" : "Theme color"}</span>
              <input onChange={(event) => setThemeColor(event.target.value)} type="text" value={themeColor} />
            </label>
            <label className="field">
              <span>{isZh ? "深色主题色" : "Dark theme color"}</span>
              <input onChange={(event) => setThemeColorDark(event.target.value)} type="text" value={themeColorDark} />
            </label>
          </div>

          <label className="field">
            <span>{isZh ? "版权文案" : "Copyright text"}</span>
            <textarea onChange={(event) => setCopyrightText(event.target.value)} rows={3} value={copyrightText} />
          </label>

          <label className="field">
            <span>{isZh ? "版权文案（英文）" : "Copyright text (EN)"}</span>
            <textarea onChange={(event) => setCopyrightTextEn(event.target.value)} rows={3} value={copyrightTextEn} />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {status ? <p className="form-success">{status}</p> : null}

          <div className="button-row">
            <button className="button" disabled={isSaving || pendingImageReads > 0} type="submit">
              {isSaving ? (isZh ? "保存中..." : "Saving...") : (isZh ? "保存系统设置" : "Save settings")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
