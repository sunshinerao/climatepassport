"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type CategoryOption = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
};

type CategoryFormProps = {
  locale: Locale;
};

type TemplateFormProps = {
  locale: Locale;
  categories: CategoryOption[];
  initialTemplate?: {
    id: string;
    categoryId: string;
    name: string;
    nameEn?: string | null;
    templateType: string;
    isActive: boolean;
    renderConfig?: {
      issuerName?: string;
      pageSize?: string;
      accentColor?: string;
      backgroundColor?: string;
      backgroundImageUrl?: string;
      logoImageUrl?: string;
      signatureImageUrl?: string;
      sealImageUrl?: string;
      elements?: unknown;
    };
    definition?: {
      name: string;
      nameEn?: string | null;
      approvalMode?: string | null;
    } | null;
  };
};

function getFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function readImageAsDataUrl(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Only PNG, JPG, and WebP images are supported.");
  }

  if (file.size > 1_500_000) {
    throw new Error("Image must be 1.5 MB or smaller.");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Could not read image.")));
    reader.readAsDataURL(file);
  });
}

export function CertificateCategoryForm({ locale }: CategoryFormProps) {
  const isZh = locale === "zh";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      key: getFormValue(formData, "key"),
      name: getFormValue(formData, "name"),
      nameEn: getFormValue(formData, "nameEn") || null,
      description: getFormValue(formData, "description") || null,
      descriptionEn: getFormValue(formData, "descriptionEn") || null,
      order: Number(getFormValue(formData, "order") || "0"),
      isActive: formData.get("isActive") === "on",
    };

    try {
      const response = await fetch("/api/admin/certificates/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? (isZh ? "保存失败" : "Save failed."));
        return;
      }

      event.currentTarget.reset();
      setMessage(isZh ? "分类已保存。" : "Category saved.");
      router.refresh();
    } catch {
      setError(isZh ? "网络错误。" : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "分类 Key" : "Category key"}</span>
          <input name="key" pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" placeholder="course-certificate" required />
        </label>
        <label className="field">
          <span>{isZh ? "排序" : "Order"}</span>
          <input defaultValue="0" min="0" name="order" type="number" />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "中文名称" : "Primary name"}</span>
          <input name="name" placeholder={isZh ? "课程证书" : "Course certificate"} required />
        </label>
        <label className="field">
          <span>{isZh ? "英文名称" : "English name"}</span>
          <input name="nameEn" placeholder="Course Certificate" />
        </label>
      </div>
      <label className="field">
        <span>{isZh ? "中文说明" : "Primary description"}</span>
        <textarea name="description" rows={3} />
      </label>
      <label className="field">
        <span>{isZh ? "英文说明" : "English description"}</span>
        <textarea name="descriptionEn" rows={3} />
      </label>
      <label className="toggle-field">
        <input defaultChecked name="isActive" type="checkbox" />
        <span>{isZh ? "启用该分类" : "Enable this category"}</span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <div className="button-row">
        <button className="button" disabled={saving} type="submit">
          {saving ? (isZh ? "保存中..." : "Saving...") : (isZh ? "保存分类" : "Save category")}
        </button>
      </div>
    </form>
  );
}

export function CertificateTemplateForm({ locale, categories, initialTemplate }: TemplateFormProps) {
  const isZh = locale === "zh";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initialTemplate?.renderConfig?.backgroundImageUrl ?? "");
  const [logoImageUrl, setLogoImageUrl] = useState(initialTemplate?.renderConfig?.logoImageUrl ?? "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(initialTemplate?.renderConfig?.signatureImageUrl ?? "");
  const [sealImageUrl, setSealImageUrl] = useState(initialTemplate?.renderConfig?.sealImageUrl ?? "");
  const [elementsJson, setElementsJson] = useState(
    initialTemplate?.renderConfig?.elements
      ? JSON.stringify(initialTemplate.renderConfig.elements, null, 2)
      : "",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const name = getFormValue(formData, "name");
    const nameEn = getFormValue(formData, "nameEn");
    let elements: unknown[] | undefined;

    if (elementsJson.trim()) {
      try {
        const parsed = JSON.parse(elementsJson) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("Element configuration must be a JSON array.");
        }
        elements = parsed;
      } catch (err) {
        setError(err instanceof Error ? err.message : (isZh ? "元素配置 JSON 无效。" : "Invalid element JSON."));
        setSaving(false);
        return;
      }
    }

    let nextBackgroundImageUrl = backgroundImageUrl || null;
    let nextLogoImageUrl = logoImageUrl || null;
    let nextSignatureImageUrl = signatureImageUrl || null;
    let nextSealImageUrl = sealImageUrl || null;

    try {
      nextBackgroundImageUrl = await readImageAsDataUrl(formData.get("backgroundImage") as File | null) ?? nextBackgroundImageUrl;
      nextLogoImageUrl = await readImageAsDataUrl(formData.get("logoImage") as File | null) ?? nextLogoImageUrl;
      nextSignatureImageUrl = await readImageAsDataUrl(formData.get("signatureImage") as File | null) ?? nextSignatureImageUrl;
      nextSealImageUrl = await readImageAsDataUrl(formData.get("sealImage") as File | null) ?? nextSealImageUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? "图片读取失败。" : "Image read failed."));
      setSaving(false);
      return;
    }

    const payload = {
      id: initialTemplate?.id,
      categoryId: getFormValue(formData, "categoryId"),
      name,
      nameEn: nameEn || null,
      templateType: getFormValue(formData, "templateType"),
      issuerName: getFormValue(formData, "issuerName") || null,
      pageSize: getFormValue(formData, "pageSize"),
      accentColor: getFormValue(formData, "accentColor") || null,
      backgroundColor: getFormValue(formData, "backgroundColor") || null,
      backgroundImageUrl: nextBackgroundImageUrl,
      logoImageUrl: nextLogoImageUrl,
      signatureImageUrl: nextSignatureImageUrl,
      sealImageUrl: nextSealImageUrl,
      elements,
      isActive: formData.get("isActive") === "on",
      definitionName: getFormValue(formData, "definitionName") || name,
      definitionNameEn: getFormValue(formData, "definitionNameEn") || nameEn || null,
      approvalMode: getFormValue(formData, "approvalMode"),
    };

    try {
      const response = await fetch("/api/admin/certificates/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? (isZh ? "保存失败" : "Save failed."));
        return;
      }

      if (!initialTemplate) {
        event.currentTarget.reset();
        setElementsJson("");
      }
      setBackgroundImageUrl(nextBackgroundImageUrl ?? "");
      setLogoImageUrl(nextLogoImageUrl ?? "");
      setSignatureImageUrl(nextSignatureImageUrl ?? "");
      setSealImageUrl(nextSealImageUrl ?? "");
      setMessage(isZh ? "模板、资产和签发定义已保存。" : "Template, assets, and issue definition saved.");
      router.refresh();
    } catch {
      setError(isZh ? "网络错误。" : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "分类" : "Category"}</span>
          <select defaultValue={initialTemplate?.categoryId ?? ""} disabled={categories.length === 0} name="categoryId" required>
            <option value="">{isZh ? "选择分类" : "Select category"}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {isZh ? category.name : (category.nameEn ?? category.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{isZh ? "模板类型" : "Template type"}</span>
          <select defaultValue={initialTemplate?.templateType ?? "CUSTOM"} name="templateType">
            <option value="ATTENDANCE">{isZh ? "活动出席" : "Attendance"}</option>
            <option value="LEARNING">{isZh ? "学习体验" : "Learning"}</option>
            <option value="ACHIEVEMENT">{isZh ? "成就徽章" : "Achievement"}</option>
            <option value="CUSTOM">{isZh ? "自定义" : "Custom"}</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "模板名称" : "Template name"}</span>
          <input defaultValue={initialTemplate?.name ?? ""} name="name" placeholder={isZh ? "活动出席证书" : "Event Attendance Certificate"} required />
        </label>
        <label className="field">
          <span>{isZh ? "英文名称" : "English name"}</span>
          <input defaultValue={initialTemplate?.nameEn ?? ""} name="nameEn" placeholder="Event Attendance Certificate" />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "签发定义名称" : "Issue definition name"}</span>
          <input defaultValue={initialTemplate?.definition?.name ?? ""} name="definitionName" placeholder={isZh ? "默认同模板名称" : "Defaults to template name"} />
        </label>
        <label className="field">
          <span>{isZh ? "英文签发定义" : "English issue definition"}</span>
          <input defaultValue={initialTemplate?.definition?.nameEn ?? ""} name="definitionNameEn" placeholder="Defaults to English template name" />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "签发机构" : "Issuer"}</span>
          <input defaultValue={initialTemplate?.renderConfig?.issuerName ?? "Climate Passport"} name="issuerName" />
        </label>
        <label className="field">
          <span>{isZh ? "审核模式" : "Approval mode"}</span>
          <select defaultValue={initialTemplate?.definition?.approvalMode ?? "auto"} name="approvalMode">
            <option value="auto">{isZh ? "自动" : "Auto"}</option>
            <option value="manual">{isZh ? "人工审核" : "Manual review"}</option>
          </select>
        </label>
      </div>
      <div className="field-row-3">
        <label className="field">
          <span>{isZh ? "页面尺寸" : "Page size"}</span>
          <select defaultValue={initialTemplate?.renderConfig?.pageSize ?? "A4_LANDSCAPE"} name="pageSize">
            <option value="A4_LANDSCAPE">A4 landscape</option>
            <option value="A4_PORTRAIT">A4 portrait</option>
            <option value="DIGITAL_CARD">Digital card</option>
          </select>
        </label>
        <label className="field">
          <span>{isZh ? "强调色" : "Accent color"}</span>
          <input defaultValue={initialTemplate?.renderConfig?.accentColor ?? "#0e7c66"} name="accentColor" type="color" />
        </label>
        <label className="field">
          <span>{isZh ? "背景色" : "Background color"}</span>
          <input defaultValue={initialTemplate?.renderConfig?.backgroundColor ?? "#f7fbf8"} name="backgroundColor" type="color" />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "证书背景图" : "Certificate background"}</span>
          <input accept="image/png,image/jpeg,image/webp" name="backgroundImage" type="file" />
          {backgroundImageUrl ? <small>{isZh ? "已保存背景图；上传新文件会替换。" : "Background saved; upload to replace."}</small> : null}
        </label>
        <label className="field">
          <span>{isZh ? "机构 Logo" : "Logo image"}</span>
          <input accept="image/png,image/jpeg,image/webp" name="logoImage" type="file" />
          {logoImageUrl ? <small>{isZh ? "已保存 Logo。" : "Logo saved."}</small> : null}
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "签名图片" : "Signature image"}</span>
          <input accept="image/png,image/jpeg,image/webp" name="signatureImage" type="file" />
          {signatureImageUrl ? <small>{isZh ? "已保存签名图。" : "Signature saved."}</small> : null}
        </label>
        <label className="field">
          <span>{isZh ? "印章图片" : "Seal image"}</span>
          <input accept="image/png,image/jpeg,image/webp" name="sealImage" type="file" />
          {sealImageUrl ? <small>{isZh ? "已保存印章图。" : "Seal saved."}</small> : null}
        </label>
      </div>
      <label className="field">
        <span>{isZh ? "元素配置 JSON" : "Element configuration JSON"}</span>
        <textarea
          name="elementsJson"
          onChange={(event) => setElementsJson(event.target.value)}
          placeholder='[{"id":"holder","kind":"VARIABLE","variable":"holderName","x":20,"y":42,"width":60,"height":10,"fontSize":34,"textAlign":"center"}]'
          rows={8}
          value={elementsJson}
        />
      </label>
      <label className="toggle-field">
        <input defaultChecked={initialTemplate?.isActive ?? true} name="isActive" type="checkbox" />
        <span>{isZh ? "启用该模板和默认签发定义" : "Enable this template and default issue definition"}</span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <div className="button-row">
        <button className="button" disabled={saving || categories.length === 0} type="submit">
          {saving ? (isZh ? "保存中..." : "Saving...") : (isZh ? "保存模板" : "Save template")}
        </button>
      </div>
    </form>
  );
}
