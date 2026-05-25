import { redirect } from "next/navigation";

export default function VerifyIdentityEntryPage({
  searchParams,
}: {
  searchParams?: { token?: string; public?: string };
}) {
  const token = searchParams?.token?.trim();
  const publicMode = searchParams?.public?.trim();

  if (!token) {
    redirect("/en");
  }

  const publicQuery = publicMode ? `&public=${encodeURIComponent(publicMode)}` : "";
  redirect(`/en/verify/identity?token=${encodeURIComponent(token)}${publicQuery}`);
}
