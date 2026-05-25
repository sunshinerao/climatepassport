import { redirect } from "next/navigation";
import type { Locale } from "@/lib/site-content";

export default function LocalizedVerifyEntryPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { code?: string; preview?: string; source?: string };
}) {
  const code = searchParams?.code?.trim();

  if (!code) {
    redirect(`/${params.locale}`);
  }

  const query = new URLSearchParams();

  if (searchParams?.preview === "1") {
    query.set("preview", "1");
  }

  if (searchParams?.source) {
    query.set("source", searchParams.source);
  }

  const suffix = query.toString();
  redirect(`/${params.locale}/verify/certificate/${encodeURIComponent(code)}${suffix ? `?${suffix}` : ""}`);
}