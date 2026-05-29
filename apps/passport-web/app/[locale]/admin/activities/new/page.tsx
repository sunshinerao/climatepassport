import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { AdminActivityFormClient } from "@/components/admin-activity-form-client";
import type { Locale } from "@/lib/site-content";

const VALID_TYPES = ["EVENT", "LEARNING", "CHALLENGE", "PROJECT", "TASK", "COURSE"];
const TYPE_ZH: Record<string, string> = {
  EVENT: "活动", LEARNING: "学习体验", CHALLENGE: "挑战行动",
  PROJECT: "项目孵化", TASK: "任务", COURSE: "课程",
};

export default async function AdminActivityNewPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { type?: string };
}) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/new`);

  const typeDefault = searchParams.type && VALID_TYPES.includes(searchParams.type)
    ? searchParams.type
    : "EVENT";

  const zh = params.locale === "zh";
  const typeName = zh ? (TYPE_ZH[typeDefault] ?? typeDefault) : typeDefault;

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <span>{zh ? `创建${typeName}` : `Create ${typeName}`}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? `创建${typeName}` : `Create ${typeName}`}</h1>
        <p className="brand-subtitle">{zh ? "填写信息后保存即可发布" : "Fill in the details and save to publish"}</p>
      </div>
      <AdminActivityFormClient locale={params.locale} mode="create" userId={user.id} initial={{ type: typeDefault }} />
    </div>
  );
}
