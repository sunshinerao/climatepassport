type LearningExperienceSource = {
  programName?: string | null;
  programNameEn?: string | null;
  courseName?: string | null;
  courseNameEn?: string | null;
  projectName?: string | null;
  projectNameEn?: string | null;
  eventName?: string | null;
  eventNameEn?: string | null;
  locationName?: string | null;
  locationNameEn?: string | null;
  roleName?: string | null;
  roleNameEn?: string | null;
  cohortName?: string | null;
  cohortNameEn?: string | null;
  completionDate?: Date | string | null;
  learningHours?: number | string | null;
  capabilityTags?: unknown;
};

type BuildIssuedCertificateVariableValuesInput = {
  holderName: string;
  holderNameEn?: string | null;
  certificateName: string;
  certificateNameZh?: string | null;
  certificateNameEn?: string | null;
  categoryName: string;
  categoryNameZh?: string | null;
  categoryNameEn?: string | null;
  issueDate: Date;
  certificateNumber: string;
  verificationUrl: string;
  issuerName?: string | null;
  signer?: string | null;
  source?: LearningExperienceSource;
};

function pickText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
}

function asIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function asLearningHours(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed;
  }
  return "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function buildIssuedCertificateVariableValues(input: BuildIssuedCertificateVariableValuesInput) {
  const issueDate = asIsoDate(input.issueDate);
  const completionDate = asIsoDate(input.source?.completionDate) || issueDate;
  const issuerName = pickText(input.issuerName, "Climate Passport");
  const signer = pickText(input.signer, issuerName);

  return {
    holderName: pickText(input.holderName),
    holderNameEn: pickText(input.holderNameEn, input.holderName),
    certificateName: pickText(input.certificateNameZh, input.certificateName),
    certificateNameEn: pickText(input.certificateNameEn, input.certificateName),
    categoryName: pickText(input.categoryNameZh, input.categoryName),
    categoryNameEn: pickText(input.categoryNameEn, input.categoryName),
    workName: "",
    workNameEn: "",
    eventName: pickText(input.source?.eventName),
    eventNameEn: pickText(input.source?.eventNameEn, input.source?.eventName),
    projectName: pickText(input.source?.projectName),
    projectNameEn: pickText(input.source?.projectNameEn, input.source?.projectName),
    programName: pickText(input.source?.programName),
    programNameEn: pickText(input.source?.programNameEn, input.source?.programName),
    courseName: pickText(input.source?.courseName, input.source?.programName),
    courseNameEn: pickText(input.source?.courseNameEn, input.source?.programNameEn, input.source?.courseName, input.source?.programName),
    roleName: pickText(input.source?.roleName),
    roleNameEn: pickText(input.source?.roleNameEn, input.source?.roleName),
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
    cohortName: pickText(input.source?.cohortName),
    cohortNameEn: pickText(input.source?.cohortNameEn, input.source?.cohortName),
    locationName: pickText(input.source?.locationName),
    locationNameEn: pickText(input.source?.locationNameEn, input.source?.locationName),
    completionDate,
    issueDate,
    certificateNumber: input.certificateNumber,
    issuerName,
    signer,
    learningHours: asLearningHours(input.source?.learningHours),
    capabilityTags: asStringArray(input.source?.capabilityTags),
    verificationUrl: input.verificationUrl,
  };
}

export function extractLearningHoursFromProgramConfig(programConfigJson: unknown): string {
  if (!programConfigJson || typeof programConfigJson !== "object" || Array.isArray(programConfigJson)) {
    return "";
  }

  const input = programConfigJson as Record<string, unknown>;
  const candidates = [
    input.learningHours,
    input.hours,
    input.durationHours,
    input.totalHours,
    input.creditHours,
  ];

  for (const candidate of candidates) {
    const value = asLearningHours(candidate as number | string | null | undefined);
    if (value) {
      return value;
    }
  }

  return "";
}

export function extractCapabilityTags(...sources: unknown[]): string[] {
  const tags = new Set<string>();

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }

    const input = source as Record<string, unknown>;
    const values = [
      input.capabilityTags,
      input.capabilities,
      input.tags,
      input.skills,
    ];

    for (const value of values) {
      for (const tag of asStringArray(value)) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}
