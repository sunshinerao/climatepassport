"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { FormErrorText, FormSuccessText } from "@/components/form-feedback";
import { FieldLabelWithInfo } from "@/components/info-tooltip";
import type { Locale } from "@/lib/site-content";

type CategoryOption = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
};

type CategoryFormProps = {
  locale: Locale;
  categories?: Array<{
    id: string;
    key: string;
    name: string;
    nameEn?: string | null;
    description?: string | null;
    descriptionEn?: string | null;
    order?: number;
    autoIssueEnabled?: boolean;
    userRequestEnabled?: boolean;
    pdfEnabled?: boolean;
    publicVerifyEnabled?: boolean;
    isActive: boolean;
  }>;
  initialCategory?: {
    id: string;
    key: string;
    name: string;
    nameEn?: string | null;
    description?: string | null;
    descriptionEn?: string | null;
    order?: number;
    autoIssueEnabled?: boolean;
    userRequestEnabled?: boolean;
    pdfEnabled?: boolean;
    publicVerifyEnabled?: boolean;
    isActive: boolean;
  };
  onCancelEdit?: () => void;
};

type TemplateFormProps = {
  locale: Locale;
  categories: CategoryOption[];
  initialTemplate?: {
    id: string;
    categoryId?: string;
    name: string;
    nameEn?: string | null;
    templateType: string;
    isActive: boolean;
    renderConfig?: {
      issuerName?: string;
      signerName?: string;
      pageSize?: string;
      pageWidthMm?: number;
      pageHeightMm?: number;
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
  onCancelEdit?: () => void;
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

const CUSTOM_KEY_VALUE = "__custom__";
const categoryKeyPresets = [
  "course-certificate",
  "event-attendance",
  "speaker-certificate",
  "moderator-certificate",
  "volunteer-certificate",
  "achievement-badge",
  "milestone-certificate",
];

function splitWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function suggestEnglishName(value: string) {
  const dictionary: Array<[RegExp, string]> = [
    [/证书/g, "certificate"],
    [/课程/g, "course"],
    [/活动/g, "event"],
    [/出席/g, "attendance"],
    [/演讲/g, "speaker"],
    [/嘉宾/g, "speaker"],
    [/主持人/g, "moderator"],
    [/志愿者/g, "volunteer"],
    [/学习/g, "learning"],
    [/体验/g, "experience"],
    [/成就/g, "achievement"],
    [/徽章/g, "badge"],
    [/里程碑/g, "milestone"],
    [/认证/g, "credential"],
    [/记录/g, "record"],
  ];

  let normalized = value.trim();
  for (const [pattern, replacement] of dictionary) {
    normalized = normalized.replace(pattern, ` ${replacement} `);
  }

  const words = splitWords(normalized);
  if (words.length === 0) {
    return "";
  }

  return toTitleCase(words.join(" "));
}

function localizeCategorySaveError(message: string | undefined, isZh: boolean) {
  if (!message) {
    return isZh ? "保存失败。" : "Save failed.";
  }

  if (message === "Category key already exists.") {
    return isZh ? "分类 Key 已存在，请更换后再保存。" : message;
  }

  if (message === "Category not found.") {
    return isZh ? "未找到该分类，请刷新后重试。" : message;
  }

  if (message === "Failed to save category.") {
    return isZh ? "保存分类失败，请稍后重试。" : message;
  }

  if (message === "Database schema is outdated. Please run category migration.") {
    return isZh ? "数据库结构未更新，请执行分类迁移后再保存。" : message;
  }

  return message;
}

function localizeTemplateSaveError(message: string | undefined, isZh: boolean) {
  if (!message) {
    return isZh ? "保存模板失败。" : "Save template failed.";
  }

  if (message === "Template or definition not found.") {
    return isZh ? "未找到模板或签发定义，请刷新后重试。" : message;
  }

  if (message === "Related category does not exist.") {
    return isZh ? "关联分类不存在，请重新选择分类。" : message;
  }

  if (message === "Failed to save template.") {
    return isZh ? "保存模板失败，请稍后重试。" : message;
  }

  return message;
}

export function CertificateCategoryForm({ locale, categories = [], initialCategory, onCancelEdit }: CategoryFormProps) {
  const isZh = locale === "zh";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [selectedKeyPreset, setSelectedKeyPreset] = useState(
    initialCategory && categoryKeyPresets.includes(initialCategory.key) ? initialCategory.key : CUSTOM_KEY_VALUE,
  );
  const [customKey, setCustomKey] = useState(
    initialCategory && !categoryKeyPresets.includes(initialCategory.key) ? initialCategory.key : "",
  );
  const [englishNameEdited, setEnglishNameEdited] = useState(Boolean(initialCategory?.nameEn));
  const nameEnInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(activeCategory?.id);

  function findCategoryByKey(key: string) {
    return categories.find((category) => category.key === key);
  }

  useEffect(() => {
    const preset = initialCategory && categoryKeyPresets.includes(initialCategory.key) ? initialCategory.key : CUSTOM_KEY_VALUE;
    setActiveCategory(initialCategory);
    setSelectedKeyPreset(preset);
    setCustomKey(initialCategory && preset === CUSTOM_KEY_VALUE ? initialCategory.key : "");
    setEnglishNameEdited(Boolean(initialCategory?.nameEn));
    setMessage("");
    setError("");
  }, [initialCategory]);

  function handlePresetChange(nextValue: string) {
    setSelectedKeyPreset(nextValue);
    setMessage("");
    setError("");

    if (nextValue === CUSTOM_KEY_VALUE) {
      setActiveCategory(undefined);
      return;
    }

    const matched = findCategoryByKey(nextValue);
    setActiveCategory(matched);
    setEnglishNameEdited(Boolean(matched?.nameEn));
  }

  function resolvedCategoryKey() {
    if (selectedKeyPreset === CUSTOM_KEY_VALUE) {
      return customKey.trim();
    }
    return selectedKeyPreset;
  }

  function maybeAutofillEnglishName(sourceName: string) {
    if (!nameEnInputRef.current) {
      return;
    }
    if (englishNameEdited || nameEnInputRef.current.value.trim()) {
      return;
    }

    const translated = suggestEnglishName(sourceName);
    if (translated) {
      nameEnInputRef.current.value = translated;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const rawOrder = getFormValue(formData, "order");
    const key = resolvedCategoryKey();

    if (!key) {
      setError(isZh ? "请填写分类 Key。" : "Category key is required.");
      setSaving(false);
      return;
    }

    const payload = {
      id: activeCategory?.id,
      key,
      name: getFormValue(formData, "name"),
      nameEn: getFormValue(formData, "nameEn") || null,
      description: getFormValue(formData, "description") || null,
      descriptionEn: getFormValue(formData, "descriptionEn") || null,
      order: rawOrder ? Number(rawOrder) : null,
      autoIssueEnabled: formData.get("autoIssueEnabled") === "on",
      userRequestEnabled: formData.get("userRequestEnabled") === "on",
      pdfEnabled: formData.get("pdfEnabled") === "on",
      publicVerifyEnabled: formData.get("publicVerifyEnabled") === "on",
      isActive: formData.get("isActive") === "on",
    };

    try {
      const response = await fetch("/api/admin/certificates/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        setError(localizeCategorySaveError(result.error, isZh));
        return;
      }

      if (!isEditing) {
        event.currentTarget.reset();
        setSelectedKeyPreset(CUSTOM_KEY_VALUE);
        setCustomKey("");
      } else {
        const latest = findCategoryByKey(key);
        if (latest) {
          setActiveCategory(latest);
        }
      }

      setEnglishNameEdited(false);
      setMessage(isZh ? (isEditing ? "分类已更新。" : "分类已保存。") : (isEditing ? "Category updated." : "Category saved."));
      router.refresh();
    } catch {
      setError(isZh ? "网络错误。" : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  const formRenderKey = `${activeCategory?.id ?? "create"}-${selectedKeyPreset}`;

  return (
    <form className="form-grid" key={formRenderKey} onSubmit={handleSubmit}>
      <input name="key" type="hidden" value={resolvedCategoryKey()} />
      <div className="field-row category-key-order-row">
        <label className="field category-key-field">
          <FieldLabelWithInfo
            label={isZh ? "分类 Key" : "Category key"}
            tooltip={isZh
              ? "Key 是系统稳定标识（用于 API 与规则关联），建议用英文短横线；若有固定分类可直接选择。"
              : "Key is the stable system identifier for API and rule mapping. Kebab-case is recommended, and presets can be selected."}
          />
          <select
            className="category-key-control"
            onChange={(event) => handlePresetChange(event.target.value)}
            value={selectedKeyPreset}
          >
            {categoryKeyPresets.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
            <option value={CUSTOM_KEY_VALUE}>{isZh ? "自定义 Key" : "Custom key"}</option>
          </select>
          {selectedKeyPreset === CUSTOM_KEY_VALUE ? (
            <input
              className="category-key-control"
              onChange={(event) => setCustomKey(event.target.value)}
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              placeholder="course-certificate"
              required
              value={customKey}
            />
          ) : null}
        </label>
        <label className="field category-order-field">
          <span>{isZh ? "排序" : "Order"}</span>
          <input
            className="category-order-control"
            defaultValue={isEditing ? String(activeCategory?.order ?? "") : ""}
            min="0"
            name="order"
            placeholder={isZh ? "留空自动追加到末尾" : "Leave empty to auto append"}
            type="number"
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "中文名称" : "Primary name"}</span>
          <input
            defaultValue={activeCategory?.name ?? ""}
            name="name"
            onBlur={(event) => maybeAutofillEnglishName(event.target.value)}
            onChange={(event) => maybeAutofillEnglishName(event.target.value)}
            placeholder={isZh ? "课程证书" : "Course certificate"}
            required
          />
        </label>
        <label className="field">
          <span>{isZh ? "英文名称" : "English name"}</span>
          <input
            defaultValue={activeCategory?.nameEn ?? ""}
            name="nameEn"
            onChange={(event) => setEnglishNameEdited(Boolean(event.target.value.trim()))}
            placeholder="Course Certificate"
            ref={nameEnInputRef}
          />
        </label>
      </div>
      <label className="field">
        <span>{isZh ? "中文说明" : "Primary description"}</span>
        <textarea defaultValue={activeCategory?.description ?? ""} name="description" rows={3} />
      </label>
      <label className="field">
        <span>{isZh ? "英文说明" : "English description"}</span>
        <textarea defaultValue={activeCategory?.descriptionEn ?? ""} name="descriptionEn" rows={3} />
      </label>
      <label className="toggle-field">
        <input defaultChecked={activeCategory?.isActive ?? true} name="isActive" type="checkbox" />
        <span>{isZh ? "启用该分类" : "Enable this category"}</span>
      </label>
      <div className="cpca-toggle-row">
        <label>
          <input defaultChecked={activeCategory?.autoIssueEnabled ?? true} name="autoIssueEnabled" type="checkbox" />
          <span>{isZh ? "允许自动签发" : "Enable auto issue"}</span>
        </label>
        <label>
          <input defaultChecked={activeCategory?.userRequestEnabled ?? false} name="userRequestEnabled" type="checkbox" />
          <span>{isZh ? "允许用户申请" : "Enable user request"}</span>
        </label>
        <label>
          <input defaultChecked={activeCategory?.pdfEnabled ?? true} name="pdfEnabled" type="checkbox" />
          <span>{isZh ? "允许 PDF 下载" : "Enable PDF download"}</span>
        </label>
        <label>
          <input defaultChecked={activeCategory?.publicVerifyEnabled ?? true} name="publicVerifyEnabled" type="checkbox" />
          <span>{isZh ? "允许公开验证" : "Enable public verify"}</span>
        </label>
      </div>
      {error ? <FormErrorText>{error}</FormErrorText> : null}
      {message ? <FormSuccessText>{message}</FormSuccessText> : null}
      <div className="button-row">
        {isEditing ? (
          <button
            className="button-secondary"
            onClick={() => {
              setActiveCategory(undefined);
              setSelectedKeyPreset(CUSTOM_KEY_VALUE);
              setCustomKey("");
              setMessage("");
              setError("");
              onCancelEdit?.();
            }}
            type="button"
          >
            {isZh ? "取消编辑" : "Cancel edit"}
          </button>
        ) : null}
        <button className="button" disabled={saving} type="submit">
          {saving ? (isZh ? "保存中..." : "Saving...") : (isZh ? (isEditing ? "保存修改" : "保存分类") : (isEditing ? "Save changes" : "Save category"))}
        </button>
      </div>
    </form>
  );
}

export function CertificateTemplateForm({ locale, categories, initialTemplate, onCancelEdit }: TemplateFormProps) {
  const isZh = locale === "zh";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedVariable, setCopiedVariable] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateName, setTemplateName] = useState(initialTemplate?.name ?? "");
  const [templateNameEn, setTemplateNameEn] = useState(initialTemplate?.nameEn ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialTemplate?.categoryId ?? "");
  const [issuerName, setIssuerName] = useState(initialTemplate?.renderConfig?.issuerName ?? "Climate Passport");
  const [signerName, setSignerName] = useState(initialTemplate?.renderConfig?.signerName ?? initialTemplate?.renderConfig?.issuerName ?? "Climate Passport");
  const [pageSize, setPageSize] = useState(initialTemplate?.renderConfig?.pageSize ?? "A4_LANDSCAPE");
  const [pageWidthMm, setPageWidthMm] = useState(
    initialTemplate?.renderConfig?.pageWidthMm ? String(initialTemplate.renderConfig.pageWidthMm) : "",
  );
  const [pageHeightMm, setPageHeightMm] = useState(
    initialTemplate?.renderConfig?.pageHeightMm ? String(initialTemplate.renderConfig.pageHeightMm) : "",
  );
  const [accentColor, setAccentColor] = useState(initialTemplate?.renderConfig?.accentColor ?? "#0e7c66");
  const [backgroundColor, setBackgroundColor] = useState(initialTemplate?.renderConfig?.backgroundColor ?? "#f7fbf8");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initialTemplate?.renderConfig?.backgroundImageUrl ?? "");
  const [logoImageUrl, setLogoImageUrl] = useState(initialTemplate?.renderConfig?.logoImageUrl ?? "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(initialTemplate?.renderConfig?.signatureImageUrl ?? "");
  const [sealImageUrl, setSealImageUrl] = useState(initialTemplate?.renderConfig?.sealImageUrl ?? "");
  const [elementsJson, setElementsJson] = useState(
    initialTemplate?.renderConfig?.elements
      ? JSON.stringify(initialTemplate.renderConfig.elements, null, 2)
      : "",
  );
  const previewRequestIdRef = useRef(0);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const restoreTitleTimerRef = useRef<number | null>(null);
  const printTitleActiveRef = useRef(false);
  const isEditing = Boolean(initialTemplate?.id);

  useEffect(() => {
    setTemplateName(initialTemplate?.name ?? "");
    setTemplateNameEn(initialTemplate?.nameEn ?? "");
    setSelectedCategoryId(initialTemplate?.categoryId ?? "");
    setIssuerName(initialTemplate?.renderConfig?.issuerName ?? "Climate Passport");
    setSignerName(initialTemplate?.renderConfig?.signerName ?? initialTemplate?.renderConfig?.issuerName ?? "Climate Passport");
    setPageSize(initialTemplate?.renderConfig?.pageSize ?? "A4_LANDSCAPE");
    setPageWidthMm(initialTemplate?.renderConfig?.pageWidthMm ? String(initialTemplate.renderConfig.pageWidthMm) : "");
    setPageHeightMm(initialTemplate?.renderConfig?.pageHeightMm ? String(initialTemplate.renderConfig.pageHeightMm) : "");
    setAccentColor(initialTemplate?.renderConfig?.accentColor ?? "#0e7c66");
    setBackgroundColor(initialTemplate?.renderConfig?.backgroundColor ?? "#f7fbf8");
    setBackgroundImageUrl(initialTemplate?.renderConfig?.backgroundImageUrl ?? "");
    setLogoImageUrl(initialTemplate?.renderConfig?.logoImageUrl ?? "");
    setSignatureImageUrl(initialTemplate?.renderConfig?.signatureImageUrl ?? "");
    setSealImageUrl(initialTemplate?.renderConfig?.sealImageUrl ?? "");
    setElementsJson(
      initialTemplate?.renderConfig?.elements
        ? JSON.stringify(initialTemplate.renderConfig.elements, null, 2)
        : "",
    );
    setMessage("");
    setError("");
  }, [initialTemplate?.id]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const originalTitle = document.title;

    const restoreTitle = () => {
      if (!printTitleActiveRef.current) {
        return;
      }
      document.title = originalTitle;
      printTitleActiveRef.current = false;
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
        restoreTitleTimerRef.current = null;
      }
    };

    const handlePreviewPrintTitle = (event: MessageEvent) => {
      const payload = event.data as { type?: string; title?: unknown };
      if (!payload || payload.type !== "certificate-preview-title") {
        return;
      }

      const nextTitle = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!nextTitle) {
        return;
      }

      document.title = nextTitle;
      printTitleActiveRef.current = true;
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
      }
      restoreTitleTimerRef.current = window.setTimeout(() => {
        restoreTitle();
      }, 120000);
    };

    window.addEventListener("message", handlePreviewPrintTitle);
    window.addEventListener("afterprint", restoreTitle);
    return () => {
      window.removeEventListener("message", handlePreviewPrintTitle);
      window.removeEventListener("afterprint", restoreTitle);
      restoreTitle();
    };
  }, []);

  async function copyVariableName(variableName: string) {
    try {
      await navigator.clipboard.writeText(variableName);
      setCopiedVariable(variableName);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedVariable("");
        copyFeedbackTimerRef.current = null;
      }, 1200);
    } catch {
      setError(isZh ? "复制失败，请手动复制变量名。" : "Copy failed. Please copy the variable name manually.");
    }
  }

  function getPresetSize(size: string) {
    if (size === "A4_PORTRAIT") {
      return { width: 210, height: 297 };
    }
    if (size === "DIGITAL_CARD") {
      return { width: 160, height: 100 };
    }
    return { width: 297, height: 210 };
  }

  const presetSize = getPresetSize(pageSize);
  const previewWidthMm = pageWidthMm.trim() ? Number(pageWidthMm) : presetSize.width;
  const previewHeightMm = pageHeightMm.trim() ? Number(pageHeightMm) : presetSize.height;
  const previewRatio = previewHeightMm > 0 ? previewWidthMm / previewHeightMm : 1.4;
  const previewBadge = `${Math.round(previewWidthMm)} x ${Math.round(previewHeightMm)} mm`;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const templateVariableDescriptions: Array<{ name: string; zh: string; en: string }> = [
    { name: "holderName", zh: "证书持有人姓名（默认主姓名）", en: "Certificate holder name (default primary name)" },
    { name: "holderNameEn", zh: "证书持有人英文姓名（中英独立字段）", en: "Certificate holder English name (independent bilingual field)" },
    { name: "certificateName", zh: "证书名称（默认主名称）", en: "Certificate name (default primary title)" },
    { name: "certificateNameEn", zh: "证书英文名称（中英独立字段）", en: "Certificate English name (independent bilingual field)" },
    { name: "categoryName", zh: "证书分类名称", en: "Certificate category name" },
    { name: "categoryNameEn", zh: "证书分类英文名称", en: "Certificate category English name" },
    { name: "workName", zh: "作品名称", en: "Work name" },
    { name: "workNameEn", zh: "作品英文名称", en: "Work English name" },
    { name: "eventName", zh: "活动名称", en: "Event name" },
    { name: "eventNameEn", zh: "活动英文名称", en: "Event English name" },
    { name: "projectName", zh: "项目名称", en: "Project name" },
    { name: "projectNameEn", zh: "项目英文名称", en: "Project English name" },
    { name: "programName", zh: "计划名称", en: "Program name" },
    { name: "programNameEn", zh: "计划英文名称", en: "Program English name" },
    { name: "courseName", zh: "课程名称", en: "Course name" },
    { name: "courseNameEn", zh: "课程英文名称", en: "Course English name" },
    { name: "roleName", zh: "角色名称", en: "Role name" },
    { name: "roleNameEn", zh: "角色英文名称", en: "Role English name" },
    { name: "organizationName", zh: "组织名称", en: "Organization name" },
    { name: "organizationNameEn", zh: "组织英文名称", en: "Organization English name" },
    { name: "institutionName", zh: "机构名称", en: "Institution name" },
    { name: "institutionNameEn", zh: "机构英文名称", en: "Institution English name" },
    { name: "achievementName", zh: "成就名称", en: "Achievement name" },
    { name: "achievementNameEn", zh: "成就英文名称", en: "Achievement English name" },
    { name: "milestoneName", zh: "里程碑名称", en: "Milestone name" },
    { name: "milestoneNameEn", zh: "里程碑英文名称", en: "Milestone English name" },
    { name: "completionDate", zh: "完成日期", en: "Completion date" },
    { name: "issueDate", zh: "签发日期", en: "Issue date" },
    { name: "certificateNumber", zh: "证书编号", en: "Certificate number" },
    { name: "issuerName", zh: "签发机构名称", en: "Issuer name" },
    { name: "signerName", zh: "签名人名称", en: "Signer display name" },
    { name: "signer", zh: "签名人", en: "Signer name" },
    { name: "learningHours", zh: "学习时长", en: "Learning hours" },
    { name: "capabilityTags", zh: "能力标签（多值会自动拼接）", en: "Capability tags (arrays are auto-joined)" },
    { name: "verificationUrl", zh: "公开验证链接", en: "Public verification URL" },
  ];

  async function refreshTemplatePreview(options?: { showError?: boolean }) {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewLoading(true);

    let parsedElements: unknown[] | undefined;
    if (elementsJson.trim()) {
      try {
        const parsed = JSON.parse(elementsJson) as unknown;
        if (Array.isArray(parsed)) {
          parsedElements = parsed;
        }
      } catch {
        if (options?.showError) {
          setError(isZh ? "元素配置 JSON 无效，无法生成预览。" : "Element JSON is invalid. Preview cannot be generated.");
        }
      }
    }

    try {
      const response = await fetch("/api/admin/certificates/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          name: templateName || null,
          nameEn: templateNameEn || null,
          categoryName: selectedCategory?.name ?? null,
          categoryNameEn: selectedCategory?.nameEn ?? null,
          holderName: isZh ? "证书持有人" : "Credential Holder",
          certificateNumber: "CV-PREVIEW",
          renderConfig: {
            issuerName: issuerName || null,
            signerName: signerName || null,
            pageSize,
            pageWidthMm: pageWidthMm.trim() ? Number(pageWidthMm) : null,
            pageHeightMm: pageHeightMm.trim() ? Number(pageHeightMm) : null,
            accentColor: accentColor || null,
            backgroundColor: backgroundColor || null,
            backgroundImageUrl: backgroundImageUrl || null,
            logoImageUrl: logoImageUrl || null,
            signatureImageUrl: signatureImageUrl || null,
            sealImageUrl: sealImageUrl || null,
            elements: parsedElements,
          },
        }),
      });

      let result: { error?: string; html?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string; html?: string };
      }

      if (!response.ok) {
        if (options?.showError) {
          setError(result.error ?? (isZh ? "预览生成失败。" : "Failed to generate preview."));
        }
        return;
      }

      if (previewRequestIdRef.current === requestId) {
        setPreviewHtml(result.html ?? "");
      }
    } catch {
      if (options?.showError) {
        setError(isZh ? "网络错误。" : "Network error.");
      }
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setPreviewLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshTemplatePreview();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    locale,
    templateName,
    templateNameEn,
    selectedCategoryId,
    issuerName,
    signerName,
    pageSize,
    pageWidthMm,
    pageHeightMm,
    accentColor,
    backgroundColor,
    backgroundImageUrl,
    logoImageUrl,
    signatureImageUrl,
    sealImageUrl,
    elementsJson,
  ]);

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
      signerName: getFormValue(formData, "signerName") || null,
      pageSize: getFormValue(formData, "pageSize"),
      pageWidthMm: getFormValue(formData, "pageWidthMm") ? Number(getFormValue(formData, "pageWidthMm")) : null,
      pageHeightMm: getFormValue(formData, "pageHeightMm") ? Number(getFormValue(formData, "pageHeightMm")) : null,
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
        setError(localizeTemplateSaveError(result.error, isZh));
        return;
      }

      if (!initialTemplate) {
        event.currentTarget.reset();
        setTemplateName("");
        setTemplateNameEn("");
        setSelectedCategoryId("");
        setIssuerName("Climate Passport");
        setSignerName("Climate Passport");
        setPageSize("A4_LANDSCAPE");
        setPageWidthMm("");
        setPageHeightMm("");
        setAccentColor("#0e7c66");
        setBackgroundColor("#f7fbf8");
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
    <form className="form-grid" key={initialTemplate?.id ?? "create-template"} onSubmit={handleSubmit}>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "分类" : "Category"}</span>
          <select disabled={categories.length === 0} name="categoryId" onChange={(event) => setSelectedCategoryId(event.target.value)} required value={selectedCategoryId}>
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
          <input name="name" onChange={(event) => setTemplateName(event.target.value)} placeholder={isZh ? "活动出席证书" : "Event Attendance Certificate"} required value={templateName} />
        </label>
        <label className="field">
          <span>{isZh ? "英文名称" : "English name"}</span>
          <input name="nameEn" onChange={(event) => setTemplateNameEn(event.target.value)} placeholder="Event Attendance Certificate" value={templateNameEn} />
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
          <input name="issuerName" onChange={(event) => setIssuerName(event.target.value)} value={issuerName} />
        </label>
        <label className="field">
          <span>{isZh ? "签名人" : "Signer display name"}</span>
          <input name="signerName" onChange={(event) => setSignerName(event.target.value)} value={signerName} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>{isZh ? "审核模式" : "Approval mode"}</span>
          <select defaultValue={initialTemplate?.definition?.approvalMode ?? "auto"} name="approvalMode">
            <option value="auto">{isZh ? "自动" : "Auto"}</option>
            <option value="manual">{isZh ? "人工审核" : "Manual review"}</option>
          </select>
        </label>
        <div />
      </div>
      <div className="field-row-3">
        <label className="field">
          <span>{isZh ? "版式预设" : "Layout preset"}</span>
          <select name="pageSize" onChange={(event) => setPageSize(event.target.value)} value={pageSize}>
            <option value="A4_LANDSCAPE">A4 landscape</option>
            <option value="A4_PORTRAIT">A4 portrait</option>
            <option value="DIGITAL_CARD">Digital card</option>
          </select>
        </label>
        <label className="field">
          <span>{isZh ? "宽度 (mm)" : "Width (mm)"}</span>
          <input min="80" name="pageWidthMm" onChange={(event) => setPageWidthMm(event.target.value)} placeholder={String(presetSize.width)} type="number" value={pageWidthMm} />
        </label>
        <label className="field">
          <span>{isZh ? "高度 (mm)" : "Height (mm)"}</span>
          <input min="80" name="pageHeightMm" onChange={(event) => setPageHeightMm(event.target.value)} placeholder={String(presetSize.height)} type="number" value={pageHeightMm} />
        </label>
      </div>
      <div className="field-row-3">
        <label className="field">
          <span>{isZh ? "强调色" : "Accent color"}</span>
          <input name="accentColor" onChange={(event) => setAccentColor(event.target.value)} type="color" value={accentColor} />
        </label>
        <label className="field">
          <span>{isZh ? "背景色" : "Background color"}</span>
          <input name="backgroundColor" onChange={(event) => setBackgroundColor(event.target.value)} type="color" value={backgroundColor} />
        </label>
        <label className="field template-layout-hint">
          <span>{isZh ? "当前版式" : "Current layout"}</span>
          <div>{previewBadge}</div>
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
      <details className="template-json-help" aria-label={isZh ? "元素配置说明" : "Element configuration help"}>
        <summary>{isZh ? "元素配置 JSON 指南" : "Element JSON Guide"}</summary>
        <p>
          {isZh
            ? "每个元素代表证书上的一个可视块。推荐先从最小配置开始：id、kind、x、y、width、height，然后逐步添加字体和样式。"
            : "Each item represents one visual block on the certificate. Start with id, kind, x, y, width, and height, then add typography and styles gradually."}
        </p>
        <ul>
          <li>{isZh ? "坐标与尺寸：x/y/width/height 使用百分比（0-100），相对于整张证书画布。" : "Position and size: x/y/width/height are percentages (0-100) of the whole canvas."}</li>
          <li>{isZh ? "文字样式：fontSize 范围 6-96，fontWeight 支持 400/500/600/700/800，textAlign 支持 left/center/right。" : "Typography: fontSize 6-96, fontWeight 400/500/600/700/800, textAlign left/center/right."}</li>
          <li>{isZh ? "层级：zIndex 越大越靠前；visible=false 可临时隐藏元素。" : "Layering: larger zIndex is on top; use visible=false to hide an element temporarily."}</li>
          <li>{isZh ? "元素类型：TEXT/NOTE 使用 content，VARIABLE 使用 variable，IMAGE 使用 imageKey，QR 自动渲染验证二维码。" : "Kinds: TEXT/NOTE use content, VARIABLE uses variable, IMAGE uses imageKey, QR renders verification QR."}</li>
          <li>{isZh ? "QR 细调：qrLabelGap（码与文字间距）、qrLabelOffsetY（文字纵向位移）、qrLabelFontSize（文字字号）。" : "QR tuning: qrLabelGap (gap), qrLabelOffsetY (vertical shift), qrLabelFontSize (label size)."}</li>
        </ul>
        <pre>{`[
  {
    "id": "holder-name",
    "kind": "VARIABLE",
    "variable": "holderName",
    "x": 15,
    "y": 42,
    "width": 70,
    "height": 10,
    "fontSize": 34,
    "fontWeight": "600",
    "color": "#12382f",
    "textAlign": "center",
    "zIndex": 10
  },
  {
    "id": "verification-qr",
    "kind": "QR",
    "x": 78,
    "y": 72,
    "width": 14,
    "height": 16,
    "qrLabelGap": 2,
    "qrLabelOffsetY": -1,
    "qrLabelFontSize": 9,
    "content": "Scan to verify this credential"
  },
  {
    "id": "note",
    "kind": "NOTE",
    "content": "This credential certifies verified participation.",
    "x": 18,
    "y": 56,
    "width": 64,
    "height": 12,
    "fontSize": 17,
    "lineHeight": 1.45
  }
]`}</pre>
      </details>
      <details className="template-json-help" aria-label={isZh ? "变量说明" : "Template variables"}>
        <summary>{isZh ? "可用变量（由数据库与签发流程提供）" : "Available Variables (from DB and issuing flow)"}</summary>
        <ul>
          {templateVariableDescriptions.map((variableMeta) => (
            <li className="template-variable-item" key={variableMeta.name}>
              <div>
                <strong>{variableMeta.name}</strong>: {isZh ? variableMeta.zh : variableMeta.en}
              </div>
              <button className="cpca-btn cpca-btn-ghost template-variable-copy-btn" onClick={() => void copyVariableName(variableMeta.name)} type="button">
                {copiedVariable === variableMeta.name ? (isZh ? "已复制" : "Copied") : (isZh ? "复制" : "Copy")}
              </button>
            </li>
          ))}
        </ul>
        <p>
          {isZh
            ? "注意：只有出现在上述名单中的 variable 才会被渲染器识别。若填入其它变量名，渲染时会为空。"
            : "Only variables listed above are recognized by the renderer. Unknown variable names are rendered as empty values."}
        </p>
      </details>
      <section className="template-inline-preview">
        <div className="template-inline-preview-head">
          <h3>{isZh ? "模板预览" : "Template preview"}</h3>
          <small>{isZh ? "基于当前配置生成（接近最终渲染）" : "Generated from current configuration (near-final rendering)"}</small>
          <button className="cpca-btn cpca-btn-ghost" onClick={() => void refreshTemplatePreview({ showError: true })} type="button">
            {previewLoading ? (isZh ? "生成中..." : "Rendering...") : (isZh ? "刷新预览" : "Refresh Preview")}
          </button>
        </div>
        <div className="template-inline-preview-stage">
          {previewHtml ? (
            <iframe
              className="template-inline-preview-frame"
              sandbox="allow-scripts allow-modals"
              srcDoc={previewHtml}
              style={{ aspectRatio: `${previewRatio}` }}
              title={isZh ? "模板预览" : "Template preview"}
            />
          ) : (
            <div className="template-inline-preview-sheet" style={{ aspectRatio: `${previewRatio}` }}>
              <div className="template-inline-kicker">{isZh ? "预览尚未生成" : "Preview not generated yet"}</div>
              <strong>{isZh ? "请点击“刷新预览”" : "Click Refresh Preview"}</strong>
            </div>
          )}
        </div>
      </section>
      {error ? <FormErrorText>{error}</FormErrorText> : null}
      {message ? <FormSuccessText>{message}</FormSuccessText> : null}
      <label className="toggle-field">
        <input defaultChecked={initialTemplate?.isActive ?? true} name="isActive" type="checkbox" />
        <span>{isZh ? "启用该模板和默认签发定义" : "Enable this template and default issue definition"}</span>
      </label>
      <div className="button-row">
        {isEditing ? (
          <button className="button-secondary" onClick={() => onCancelEdit?.()} type="button">
            {isZh ? "取消编辑" : "Cancel edit"}
          </button>
        ) : null}
        <button className="button" disabled={saving || categories.length === 0} type="submit">
          {saving ? (isZh ? "保存中..." : "Saving...") : (isZh ? (isEditing ? "保存修改" : "保存模板") : (isEditing ? "Save changes" : "Save template"))}
        </button>
      </div>
    </form>
  );
}
