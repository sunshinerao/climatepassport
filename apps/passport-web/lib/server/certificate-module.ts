import { maskPassportId } from "@climate-passport/passport-core";
import type { CertificateIssueStatus } from "@prisma/client";
import QRCode from "qrcode";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";

export function formatCertificateDate(locale: Locale, value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function getCertificateName(locale: Locale, item: { name: string; nameEn?: string | null }) {
  return locale === "zh" ? item.name : item.nameEn ?? item.name;
}

export function getCertificateStatusLabel(locale: Locale, status: CertificateIssueStatus | string) {
  const labels: Record<string, { en: string; zh: string }> = {
    DRAFT: { en: "Draft", zh: "草稿" },
    PENDING_APPROVAL: { en: "Pending review", zh: "待审核" },
    APPROVED: { en: "Approved", zh: "已通过" },
    GENERATED: { en: "Generated", zh: "已生成" },
    ISSUED: { en: "Issued", zh: "已签发" },
    REVOKED: { en: "Revoked", zh: "已撤销" },
  };

  return labels[status]?.[locale === "zh" ? "zh" : "en"] ?? status;
}

export function getVerificationUrl(code: string | null | undefined) {
  return code ? `/verify/certificate/${encodeURIComponent(code)}` : null;
}

const CERTIFICATE_VARIABLE_NAMES = [
  "holderName",
  "holderNameEn",
  "certificateName",
  "certificateNameEn",
  "categoryName",
  "categoryNameEn",
  "workName",
  "workNameEn",
  "eventName",
  "eventNameEn",
  "projectName",
  "projectNameEn",
  "programName",
  "programNameEn",
  "courseName",
  "courseNameEn",
  "roleName",
  "roleNameEn",
  "organizationName",
  "organizationNameEn",
  "institutionName",
  "institutionNameEn",
  "achievementName",
  "achievementNameEn",
  "milestoneName",
  "milestoneNameEn",
  "sessionName",
  "sessionNameEn",
  "topicName",
  "topicNameEn",
  "trackName",
  "trackNameEn",
  "speakerName",
  "speakerNameEn",
  "mentorName",
  "mentorNameEn",
  "cohortName",
  "cohortNameEn",
  "locationName",
  "locationNameEn",
  "completionDate",
  "issueDate",
  "certificateNumber",
  "issuerName",
  "signer",
  "learningHours",
  "capabilityTags",
  "verificationUrl",
] as const;

type CertificateVariableName = typeof CERTIFICATE_VARIABLE_NAMES[number];

function isCertificateVariableName(value: unknown): value is CertificateVariableName {
  return typeof value === "string" && CERTIFICATE_VARIABLE_NAMES.includes(value as CertificateVariableName);
}

type CertificateRenderConfig = {
  issuerName?: string;
  signerName?: string;
  pageSize?: "A4_LANDSCAPE" | "A4_PORTRAIT" | "DIGITAL_CARD";
  pageWidthMm?: number;
  pageHeightMm?: number;
  accentColor?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  signatureImageUrl?: string;
  sealImageUrl?: string;
  elements?: CertificateRenderElement[];
};

type CertificateRenderElement = {
  id: string;
  kind: "TEXT" | "VARIABLE" | "IMAGE" | "QR" | "NOTE";
  label?: string;
  content?: string;
  variable?: CertificateVariableName;
  imageKey?: "logo" | "signature" | "seal";
  qrLabelGap?: number;
  qrLabelOffsetY?: number;
  qrLabelFontSize?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  zIndex?: number;
  visible?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isSafeDataImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpe?g|webp);base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function sanitizePercent(value: unknown, fallback: number, min = 0, max = 100) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function sanitizeRenderElement(value: unknown): CertificateRenderElement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const kind = input.kind === "TEXT" || input.kind === "VARIABLE" || input.kind === "IMAGE" || input.kind === "QR" || input.kind === "NOTE"
    ? input.kind
    : null;

  if (!kind || typeof input.id !== "string" || !input.id.trim()) {
    return null;
  }

  const variable = isCertificateVariableName(input.variable) ? input.variable : undefined;
  const imageKey = input.imageKey === "logo" || input.imageKey === "signature" || input.imageKey === "seal"
    ? input.imageKey
    : undefined;
  const textAlign = input.textAlign === "center" || input.textAlign === "right" ? input.textAlign : "left";

  return {
    id: input.id.trim().slice(0, 80),
    kind,
    label: typeof input.label === "string" ? input.label.trim().slice(0, 120) : undefined,
    content: typeof input.content === "string" ? input.content.trim().slice(0, 1000) : undefined,
    variable,
    imageKey,
    qrLabelGap: typeof input.qrLabelGap === "number" || typeof input.qrLabelGap === "string"
      ? sanitizePercent(input.qrLabelGap, 6, 0, 40)
      : undefined,
    qrLabelOffsetY: typeof input.qrLabelOffsetY === "number" || typeof input.qrLabelOffsetY === "string"
      ? sanitizePercent(input.qrLabelOffsetY, 0, -40, 40)
      : undefined,
    qrLabelFontSize: typeof input.qrLabelFontSize === "number" || typeof input.qrLabelFontSize === "string"
      ? sanitizePercent(input.qrLabelFontSize, 10, 8, 24)
      : undefined,
    x: sanitizePercent(input.x, 0),
    y: sanitizePercent(input.y, 0),
    width: sanitizePercent(input.width, 20, 1),
    height: sanitizePercent(input.height, 8, 1),
    fontFamily: typeof input.fontFamily === "string" ? input.fontFamily.trim().slice(0, 120) : undefined,
    fontSize: sanitizePercent(input.fontSize, 16, 6, 96),
    fontWeight: typeof input.fontWeight === "string" && /^(400|500|600|700|800)$/.test(input.fontWeight) ? input.fontWeight : undefined,
    color: isSafeHexColor(input.color) ? input.color : undefined,
    textAlign,
    lineHeight: sanitizePercent(input.lineHeight, 1.35, 0.8, 2.4),
    zIndex: Math.round(sanitizePercent(input.zIndex, 10, 0, 100)),
    visible: input.visible === false ? false : true,
  };
}

export function parseCertificateRenderConfig(value: unknown): CertificateRenderConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const pageSize = input.pageSize === "A4_PORTRAIT" || input.pageSize === "DIGITAL_CARD"
    ? input.pageSize
    : input.pageSize === "A4_LANDSCAPE"
      ? input.pageSize
      : undefined;

  return {
    issuerName: typeof input.issuerName === "string" && input.issuerName.trim() ? input.issuerName.trim() : undefined,
    signerName: typeof input.signerName === "string" && input.signerName.trim() ? input.signerName.trim() : undefined,
    pageSize,
    pageWidthMm: Number.isFinite(Number(input.pageWidthMm)) ? sanitizePercent(input.pageWidthMm, 0, 80, 1200) : undefined,
    pageHeightMm: Number.isFinite(Number(input.pageHeightMm)) ? sanitizePercent(input.pageHeightMm, 0, 80, 1200) : undefined,
    accentColor: isSafeHexColor(input.accentColor) ? input.accentColor : undefined,
    backgroundColor: isSafeHexColor(input.backgroundColor) ? input.backgroundColor : undefined,
    backgroundImageUrl: isSafeDataImage(input.backgroundImageUrl) ? input.backgroundImageUrl : undefined,
    logoImageUrl: isSafeDataImage(input.logoImageUrl) ? input.logoImageUrl : undefined,
    signatureImageUrl: isSafeDataImage(input.signatureImageUrl) ? input.signatureImageUrl : undefined,
    sealImageUrl: isSafeDataImage(input.sealImageUrl) ? input.sealImageUrl : undefined,
    elements: Array.isArray(input.elements)
      ? input.elements.map(sanitizeRenderElement).filter((item): item is CertificateRenderElement => Boolean(item)).slice(0, 40)
      : undefined,
  };
}

function buildCertificateFileBaseName(input: {
  holderName: string;
  certificateName: string;
  categoryName: string;
  certificateNumber: string;
}) {
  const raw = [
    input.categoryName,
    input.certificateName,
    input.holderName,
    input.certificateNumber,
  ].join("-");

  return raw
    .replace(/[\\/:*?"<>|#%{}[\]^~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || input.certificateNumber;
}

function getElementValue(element: CertificateRenderElement, values: Record<string, string>) {
  if (element.kind === "VARIABLE" && element.variable) {
    return values[element.variable] ?? "";
  }

  return element.content ?? "";
}

function normalizeVariableValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(value).trim();
}

function getImageForElement(element: CertificateRenderElement, renderConfig: CertificateRenderConfig) {
  if (element.imageKey === "logo") {
    return renderConfig.logoImageUrl;
  }
  if (element.imageKey === "signature") {
    return renderConfig.signatureImageUrl;
  }
  if (element.imageKey === "seal") {
    return renderConfig.sealImageUrl;
  }
  return undefined;
}

function buildPseudoQrSvg(value: string, accentColor: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  const cells: string[] = [];
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 17; x += 1) {
      const finder = (x < 5 && y < 5) || (x > 11 && y < 5) || (x < 5 && y > 11);
      const bit = ((hash + x * 17 + y * 31 + x * y) % 5) < 2;
      if (finder || bit) {
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
      }
    }
  }

  return `<svg viewBox="0 0 17 17" aria-label="Verification QR" role="img" xmlns="http://www.w3.org/2000/svg"><rect width="17" height="17" fill="#fff" /> <g fill="${accentColor}">${cells.join("")}</g></svg>`;
}

export async function buildCertificateVerificationQrSvg(value: string, accentColor = "#1f5a4e") {
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    color: {
      dark: accentColor,
      light: "#ffffff",
    },
  });
}

function renderConfiguredElement(
  element: CertificateRenderElement,
  values: Record<string, string>,
  renderConfig: CertificateRenderConfig,
  verificationQrSvg?: string,
) {
  if (element.visible === false) {
    return "";
  }

  const style = [
    "position:absolute",
    `left:${element.x}%`,
    `top:${element.y}%`,
    `width:${element.width}%`,
    `height:${element.height}%`,
    `z-index:${element.zIndex ?? 10}`,
  ];

  if (element.kind === "IMAGE") {
    const imageUrl = getImageForElement(element, renderConfig);
    return imageUrl ? `<img class="cert-el cert-img" src="${imageUrl}" alt="${escapeHtml(element.label ?? element.imageKey ?? "image")}" style="${style.join(";")}" />` : "";
  }

  if (element.kind === "QR") {
    const verificationUrl = values.verificationUrl;
    const qrStyle = [...style, `gap:${element.qrLabelGap ?? 6}px`];
    const qrLabelStyle = [
      `font-size:${element.qrLabelFontSize ?? 10}px`,
      `transform:translateY(${element.qrLabelOffsetY ?? 0}px)`,
      "line-height:1.35",
    ];
    return `<div class="cert-el cert-qr" data-verification-url="${escapeHtml(verificationUrl)}" style="${qrStyle.join(";")}">${verificationQrSvg ?? buildPseudoQrSvg(verificationUrl, renderConfig.accentColor ?? "#1f5a4e")}<span style="${qrLabelStyle.join(";")}">${escapeHtml(element.content || "Scan to verify this credential")}</span></div>`;
  }

  const value = getElementValue(element, values);
  const textStyle = [
    ...style,
    `font-family:${escapeHtml(element.fontFamily ?? "Inter, Arial, sans-serif")}`,
    `font-size:${element.fontSize ?? 16}px`,
    `font-weight:${element.fontWeight ?? "400"}`,
    `color:${element.color ?? "#12382f"}`,
    `text-align:${element.textAlign ?? "left"}`,
    `line-height:${element.lineHeight ?? 1.35}`,
  ];
  const label = element.label ? `<small>${escapeHtml(element.label)}</small>` : "";

  return `<div class="cert-el cert-text" style="${textStyle.join(";")}">${label}<span>${escapeHtml(value)}</span></div>`;
}

export function renderCertificateHtml(input: {
  holderName: string;
  certificateName: string;
  categoryName: string;
  issueDate: string;
  certificateNumber: string;
  variableValues?: Record<string, unknown>;
  documentTitle?: string;
  verificationUrl?: string;
  verificationQrSvg?: string;
  renderConfig?: CertificateRenderConfig;
}) {
  const renderConfig = input.renderConfig ?? {};
  const issuerName = renderConfig.issuerName ?? "Climate Passport";
  const accentColor = renderConfig.accentColor ?? "#1f5a4e";
  const backgroundColor = renderConfig.backgroundColor ?? "#f6f9f6";
  const pageClass = renderConfig.pageSize === "A4_PORTRAIT"
    ? "certificate portrait"
    : renderConfig.pageSize === "DIGITAL_CARD"
      ? "certificate digital-card"
      : "certificate";
  const safeCertificateName = escapeHtml(input.certificateName);
  const safeHolderName = escapeHtml(input.holderName);
  const safeCategoryName = escapeHtml(input.categoryName);
  const safeIssueDate = escapeHtml(input.issueDate);
  const safeCertificateNumber = escapeHtml(input.certificateNumber);
  const safeDocumentTitle = escapeHtml(input.documentTitle ?? input.certificateName);
  const safeIssuerName = escapeHtml(issuerName);
  const verificationUrl = input.verificationUrl ?? getVerificationUrl(input.certificateNumber) ?? "";
  const values: Record<string, string> = {
    holderName: input.holderName,
    holderNameEn: input.holderName,
    certificateName: input.certificateName,
    certificateNameEn: input.certificateName,
    categoryName: input.categoryName,
    categoryNameEn: input.categoryName,
    workName: "",
    workNameEn: "",
    eventName: "",
    eventNameEn: "",
    projectName: "",
    projectNameEn: "",
    programName: "",
    programNameEn: "",
    courseName: "",
    courseNameEn: "",
    roleName: "",
    roleNameEn: "",
    organizationName: issuerName,
    organizationNameEn: issuerName,
    institutionName: issuerName,
    institutionNameEn: issuerName,
    achievementName: "",
    achievementNameEn: "",
    milestoneName: "",
    milestoneNameEn: "",
    sessionName: "",
    sessionNameEn: "",
    topicName: "",
    topicNameEn: "",
    trackName: "",
    trackNameEn: "",
    speakerName: "",
    speakerNameEn: "",
    mentorName: "",
    mentorNameEn: "",
    cohortName: "",
    cohortNameEn: "",
    locationName: "",
    locationNameEn: "",
    completionDate: input.issueDate,
    issueDate: input.issueDate,
    certificateNumber: input.certificateNumber,
    issuerName,
    signer: issuerName,
    learningHours: "",
    capabilityTags: "",
    verificationUrl,
  };

  for (const [key, rawValue] of Object.entries(input.variableValues ?? {})) {
    if (!isCertificateVariableName(key)) {
      continue;
    }
    values[key] = normalizeVariableValue(rawValue);
  }
  const configuredElements = renderConfig.elements?.length
    ? renderConfig.elements.map((element) => renderConfiguredElement(element, values, renderConfig, input.verificationQrSvg)).join("\n")
    : "";
  const fallbackQrSvg = input.verificationQrSvg ?? buildPseudoQrSvg(verificationUrl, accentColor);
  const backgroundImageLayer = renderConfig.backgroundImageUrl
    ? `<img class="cert-background-image" src="${renderConfig.backgroundImageUrl}" alt="" aria-hidden="true" />`
    : "";
  const fallbackContent = configuredElements
    ? configuredElements
    : `
    <div class="kicker">Climate Passport Verified Credential</div>
    <h1>${safeCertificateName}</h1>
    <p class="body">This digital credential certifies the verified participation, learning, role, or capability record represented by this certificate.</p>
    <div class="holder">${safeHolderName}</div>
    <div class="meta">
      <div>Category<strong>${safeCategoryName}</strong></div>
      <div>Issued by<strong>${safeIssuerName}</strong></div>
      <div>Issue date<strong>${safeIssueDate}</strong></div>
      <div>Certificate number<strong>${safeCertificateNumber}</strong></div>
      <div>Verification<strong>Use the QR or verification link</strong></div>
      <div>Status<strong>Issued</strong></div>
    </div>
    <div class="fallback-footer">
      <div class="seal">CLIMATE<br />PASSPORT</div>
      <div class="fallback-qr cert-qr" data-verification-url="${escapeHtml(verificationUrl)}">${fallbackQrSvg}<span>Scan to verify this credential</span></div>
    </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeDocumentTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; min-height: 100vh; font-family: Inter, Arial, sans-serif; color: #12382f; background: ${backgroundColor}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .certificate { position: relative; overflow: hidden; width: 1120px; min-height: 780px; margin: 0 auto; padding: 72px; background: #fff; border: 0; box-shadow: none; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .certificate.portrait { width: 780px; min-height: 1120px; }
    .certificate.digital-card { width: 760px; min-height: 480px; padding: 48px; }
    .cert-background-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; pointer-events: none; user-select: none; }
    main > :not(.cert-background-image) { position: relative; }
    .kicker { letter-spacing: .18em; text-transform: uppercase; font-size: 13px; color: #60766f; font-weight: 700; }
    h1 { margin: 44px 0 16px; font-size: 54px; line-height: 1.04; font-weight: 650; }
    .holder { margin: 36px 0; font-size: 36px; border-bottom: 1px solid #bfd0c8; padding-bottom: 18px; }
    .body { max-width: 760px; font-size: 20px; line-height: 1.7; color: #36524b; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 72px; }
    .meta div { border-top: 1px solid #dde7e1; padding-top: 12px; font-size: 14px; color: #36524b; }
    .meta strong { display: block; margin-top: 6px; color: #12382f; font-size: 16px; }
    .fallback-footer { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin-top: 54px; }
    .seal { width: 132px; height: 132px; border: 2px solid ${accentColor}; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; text-align: center; color: ${accentColor}; }
    .fallback-qr { width: 132px; }
    .cert-el { box-sizing: border-box; }
    .cert-img { object-fit: contain; }
    .cert-text { display: flex; flex-direction: column; justify-content: center; overflow: hidden; white-space: pre-wrap; }
    .cert-text small { display: block; margin-bottom: 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #60766f; }
    .cert-qr { display: grid; gap: 6px; align-content: start; justify-items: center; font-size: 10px; color: #36524b; text-align: center; }
    .cert-qr svg { width: 100%; max-height: calc(100% - 18px); aspect-ratio: 1; }
    .print-actions { position: fixed; right: 18px; top: 18px; display: flex; gap: 8px; z-index: 200; }
    .print-actions button { border: 0; border-radius: 999px; padding: 10px 14px; background: ${accentColor}; color: white; font-weight: 700; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .certificate { transform: none !important; margin: 0 !important; }
      .certificate { width: 297mm; height: 210mm; min-height: 210mm; margin: 0; }
      .certificate.portrait { width: 210mm; height: 297mm; min-height: 297mm; }
      .certificate.digital-card { width: 210mm; height: 132mm; min-height: 132mm; }
      .print-actions { display: none; }
    }
  </style>
  <script>
    function fitCertificateForEmbeddedPreview() {
      if (window.self === window.top) {
        return;
      }

      const certificate = document.querySelector("main.certificate");
      if (!certificate) {
        return;
      }

      certificate.style.transform = "none";
      certificate.style.margin = "0 auto";

      const naturalWidth = certificate.offsetWidth;
      const naturalHeight = certificate.offsetHeight;
      if (!naturalWidth || !naturalHeight) {
        return;
      }

      const horizontalPadding = 24;
      const verticalPadding = 24;
      const availableWidth = Math.max(window.innerWidth - horizontalPadding, 240);
      const availableHeight = Math.max(window.innerHeight - verticalPadding, 240);
      const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);

      certificate.style.transformOrigin = "top center";
      certificate.style.transform = "scale(" + scale + ")";
      certificate.style.margin = "8px auto 12px";
    }

    function printCertificate() {
      try {
        window.parent.postMessage({ type: "certificate-preview-title", title: document.title }, "*");
      } catch (error) {
        // no-op for standalone rendering contexts
      }
      window.print();
    }

    window.addEventListener("load", fitCertificateForEmbeddedPreview);
    window.addEventListener("resize", fitCertificateForEmbeddedPreview);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitCertificateForEmbeddedPreview);
    }
  </script>
</head>
<body>
  <div class="print-actions"><button onclick="printCertificate()">Print / Save PDF</button></div>
  <main class="${pageClass}">
    ${backgroundImageLayer}
    ${fallbackContent}
  </main>
</body>
</html>`;
}

export function buildCertificateArtifact(input: {
  holderName: string;
  certificateName: string;
  categoryName: string;
  issueDate: Date;
  certificateNumber: string;
  verificationUrl?: string;
  renderConfigJson?: unknown;
  variableValues?: Record<string, unknown>;
}) {
  const renderConfig = parseCertificateRenderConfig(input.renderConfigJson);
  const fileBaseName = buildCertificateFileBaseName(input);
  const fileName = `${fileBaseName}.html`;
  const pdfFileName = `${fileBaseName}.pdf`;
  const verificationUrl = input.verificationUrl ?? getVerificationUrl(input.certificateNumber) ?? "";
  const html = renderCertificateHtml({
    holderName: input.holderName,
    certificateName: input.certificateName,
    categoryName: input.categoryName,
    issueDate: input.issueDate.toISOString().slice(0, 10),
    certificateNumber: input.certificateNumber,
    variableValues: input.variableValues,
    verificationUrl,
    renderConfig,
  });

  return {
    fileName,
    pdfFileName,
    mimeType: "text/html",
    html,
    dataUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  };
}

export async function buildCertificateArtifactWithQr(input: {
  holderName: string;
  certificateName: string;
  categoryName: string;
  issueDate: Date;
  certificateNumber: string;
  verificationUrl: string;
  renderConfigJson?: unknown;
  variableValues?: Record<string, unknown>;
}) {
  const renderConfig = parseCertificateRenderConfig(input.renderConfigJson);
  const verificationQrSvg = await buildCertificateVerificationQrSvg(
    input.verificationUrl,
    renderConfig.accentColor ?? "#1f5a4e",
  );
  const fileBaseName = buildCertificateFileBaseName(input);
  const fileName = `${fileBaseName}.html`;
  const pdfFileName = `${fileBaseName}.pdf`;
  const html = renderCertificateHtml({
    holderName: input.holderName,
    certificateName: input.certificateName,
    categoryName: input.categoryName,
    issueDate: input.issueDate.toISOString().slice(0, 10),
    certificateNumber: input.certificateNumber,
    variableValues: input.variableValues,
    verificationUrl: input.verificationUrl,
    verificationQrSvg,
    renderConfig,
  });

  return {
    fileName,
    pdfFileName,
    mimeType: "text/html",
    html,
    dataUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  };
}

export async function getCertificateIssueForPublicVerification(code: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  return prisma.certificateIssue.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true, climatePassportId: true } },
      definition: {
        include: {
          category: true,
          template: true,
        },
      },
      verifications: { select: { id: true } },
    },
  });
}

export function serializeCertificateCard(locale: Locale, issue: {
  id: string;
  status: CertificateIssueStatus | string;
  issuedAt: Date | null;
  createdAt: Date;
  verificationCode: string | null;
  downloadCount: number;
  generatedFileUrl?: string | null;
  definition: {
    name: string;
    nameEn?: string | null;
    category: { name: string; nameEn?: string | null };
    template?: { name: string; nameEn?: string | null; templateType?: string } | null;
  };
  verifications?: Array<{ id: string }>;
}) {
  return {
    id: issue.id,
    name: getCertificateName(locale, issue.definition),
    category: getCertificateName(locale, issue.definition.category),
    templateName: issue.definition.template ? getCertificateName(locale, issue.definition.template) : null,
    type: issue.definition.template?.templateType ?? "CUSTOM",
    status: issue.status,
    statusLabel: getCertificateStatusLabel(locale, issue.status),
    issuedAtLabel: formatCertificateDate(locale, issue.issuedAt ?? issue.createdAt),
    certificateNumber: issue.verificationCode ?? "—",
    verificationUrl: getVerificationUrl(issue.verificationCode),
    downloadCount: issue.downloadCount,
    verificationCount: issue.verifications?.length ?? 0,
    hasRenderedFile: Boolean(issue.generatedFileUrl),
  };
}

export function serializePublicHolder(input: { name: string; climatePassportId?: string | null }) {
  return {
    name: input.name,
    maskedPassportId: maskPassportId(input.climatePassportId ?? ""),
  };
}
