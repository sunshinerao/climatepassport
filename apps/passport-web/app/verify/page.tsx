import { redirect } from "next/navigation";

export default function VerifyEntryPage({
  searchParams,
}: {
  searchParams?: { code?: string; preview?: string; source?: string };
}) {
  const code = searchParams?.code?.trim();

  if (!code) {
    redirect("/en");
  }

  const query = new URLSearchParams();

  if (searchParams?.preview === "1") {
    query.set("preview", "1");
  }

  if (searchParams?.source) {
    query.set("source", searchParams.source);
  }

  const suffix = query.toString();
  redirect(`/en/verify/certificate/${encodeURIComponent(code)}${suffix ? `?${suffix}` : ""}`);
}