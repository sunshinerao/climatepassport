import { unstable_noStore as noStore } from "next/cache";
import { AdminMessageInbox } from "@/components/admin-message-inbox";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminMessagesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/messages`);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "支持工单" : "Support tickets"}</span>
          <h1>{params.locale === "zh" ? "联系表单收件箱" : "Contact form inbox"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "按状态与类别筛选用户提交的支持请求，撰写回复并推进工单。回复内容会在提交者的消息中心展示。"
            : "Filter user-submitted support requests by status and category, write a reply, and move the ticket forward. Replies appear in the sender's message centre."}
        </p>
      </div>

      <AdminMessageInbox locale={params.locale} />
    </>
  );
}
