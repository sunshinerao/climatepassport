import { notFound } from "next/navigation";
import type { Locale } from "@/lib/site-content";
import { resolvePublicPortfolioShare } from "@/lib/server/portfolio";

export const metadata = { robots: { index: false, follow: false } };

export default async function PublicPortfolioPage({ params }: { params: { locale: Locale; token: string } }) {
  if (params.locale !== "en" && params.locale !== "zh") notFound();
  const projection = await resolvePublicPortfolioShare(params.token, params.locale); if (!projection) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-16"><p className="text-sm text-slate-500">{params.locale === "zh" ? "已验证档案" : "Verified portfolio"}</p>{projection.name && <h1 className="mt-2 text-3xl font-semibold">{projection.name}</h1>}{projection.title && <p className="mt-1 text-slate-600">{projection.title}</p>}{projection.dimensions && <section className="mt-10 grid gap-4 md:grid-cols-2">{projection.dimensions.map((dimension) => <article key={dimension.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">{dimension.title}</h2><p className="mt-1 text-sm text-slate-600">{dimension.band} · {dimension.evidenceCount} {params.locale === "zh" ? "项已验证记录" : "verified records"}</p><p className="mt-3 text-sm">{dimension.explanation}</p>{dimension.evidence && <ul className="mt-3 space-y-2 text-sm">{dimension.evidence.map((item) => <li key={item.evidenceKey}>{item.certificateVerificationUrl ? <a className="underline" href={item.certificateVerificationUrl}>{item.title}</a> : item.title} <span className="text-slate-500">— {item.explanation}</span></li>)}</ul>}</article>)}</section>}<p className="mt-8 text-xs text-slate-500">{params.locale === "zh" ? `规则版本 ${projection.ruleVersion ?? "—"}` : `Rule version ${projection.ruleVersion ?? "—"}`}</p></main>;
}
