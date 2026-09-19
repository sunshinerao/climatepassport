export type CertificateRenderSnapshot = {
  schemaVersion: 1;
  templateId: string;
  templateVersion: number;
  renderConfigJson: Record<string, unknown>;
  holderName: string;
  certificateName: string;
  categoryName: string;
  issueDate: string;
  variableValues: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function createCertificateRenderSnapshot(input: Omit<CertificateRenderSnapshot, "schemaVersion">) {
  return { schemaVersion: 1 as const, ...input };
}

export function parseCertificateRenderSnapshot(value: unknown): CertificateRenderSnapshot | null {
  const snapshot = record(value);
  const renderConfigJson = record(snapshot?.renderConfigJson);
  const variableValues = record(snapshot?.variableValues);
  const templateId = text(snapshot?.templateId);
  const holderName = text(snapshot?.holderName);
  const certificateName = text(snapshot?.certificateName);
  const categoryName = text(snapshot?.categoryName);
  const issueDate = text(snapshot?.issueDate) ?? text(snapshot?.issuedAt);
  const templateVersion = snapshot?.templateVersion;

  if (snapshot?.schemaVersion !== 1
    || !templateId
    || typeof templateVersion !== "number"
    || !Number.isInteger(templateVersion)
    || templateVersion < 1
    || !renderConfigJson
    || !variableValues
    || !holderName
    || !certificateName
    || !categoryName
    || !issueDate
    || Number.isNaN(Date.parse(issueDate))) {
    return null;
  }

  return {
    schemaVersion: 1,
    templateId,
    templateVersion,
    renderConfigJson,
    holderName,
    certificateName,
    categoryName,
    issueDate,
    variableValues,
  };
}

export function snapshotText(snapshot: CertificateRenderSnapshot | null, ...keys: string[]) {
  for (const key of keys) {
    const value = snapshot?.variableValues[key];
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return null;
}
