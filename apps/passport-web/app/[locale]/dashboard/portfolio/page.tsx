import { requireAuthenticatedUser } from "@/lib/server/auth";
import { derivePortfolio } from "@/lib/server/portfolio";
import type { Locale } from "@/lib/site-content";
import { PortfolioSharingSettings } from "@/components/portfolio-sharing-settings";

export default async function PortfolioDashboardPage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale === "zh" ? "zh" : "en"; const user = await requireAuthenticatedUser(locale, `/${locale}/dashboard/portfolio`); const portfolio = await derivePortfolio(user.id, locale);
  return <main className="mx-auto max-w-6xl px-6 py-10"><h1 className="text-3xl font-semibold">{locale === "zh" ? "已验证档案" : "Verified portfolio"}</h1><p className="mt-2 text-slate-600">{locale === "zh" ? "仅基于当前已验证记录；不使用推断分数。" : "Derived only from current verified records; no inferred score."}</p><section className="mt-8 grid gap-4 md:grid-cols-2">{portfolio.dimensions.map((dimension) => <article key={dimension.key} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">{dimension.title}</h2><p className="text-sm text-slate-600">{dimension.band} · {dimension.evidenceCount} {locale === "zh" ? "项记录" : "records"}</p><details className="mt-3 text-sm"><summary>{locale === "zh" ? "查看依据" : "View explanation"}</summary><p className="mt-2">{dimension.explanation}</p><ul className="mt-2 list-disc pl-5">{dimension.evidence.map((item) => <li key={item.evidenceKey}>{item.title} — {item.explanation}</li>)}</ul></details></article>)}</section><p className="mt-8 text-sm text-slate-500">{locale === "zh" ? `规则版本 ${portfolio.ruleVersion ?? "—"}` : `Rule version ${portfolio.ruleVersion ?? "—"}`}</p><PortfolioSharingSettings locale={locale} /></main>;
}
