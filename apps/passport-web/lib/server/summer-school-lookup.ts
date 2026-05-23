export function isValidApplicationLookupEmail(email: string) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function buildSummerSchoolLookupOrFilters(input: {
  email?: string;
  passportId?: string;
}) {
  const filters: Array<{ email?: string; climatePassportId?: string }> = [];

  if (isValidApplicationLookupEmail(input.email ?? "")) {
    filters.push({ email: input.email });
  }

  if (input.passportId && input.passportId.trim().length > 0) {
    filters.push({ climatePassportId: input.passportId.trim() });
  }

  return filters;
}
