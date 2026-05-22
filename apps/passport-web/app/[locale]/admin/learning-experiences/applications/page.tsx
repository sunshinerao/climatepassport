import { redirect } from "next/navigation";
import type { Locale } from "@/lib/site-content";

export default function LocalizedAdminLearningExperiencesApplicationsPage({
  params,
}: {
  params: { locale: Locale };
}) {
  redirect(`/${params.locale}/admin/learning-experiences`);
}
