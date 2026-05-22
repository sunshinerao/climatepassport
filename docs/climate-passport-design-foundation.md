# Climate Passport Global Design Foundation

> For VS Code / GitHub Copilot / Codex reference  
> Version: 1.0  
> Design direction: WEF-inspired institutional climate identity system  
> Primary use: Climate Passport web app, public site, credential verification, user passport, institutional admin console

---

## 1. Product Design Positioning

Climate Passport should be designed as a **trusted climate-era identity infrastructure**, not as a generic sustainability website, NGO campaign page, event registration platform, or education portal.

The design should feel like:

- an international institutional platform;
- a verified digital identity system;
- a climate credential and action record infrastructure;
- a global programme and partner collaboration layer;
- a calm, high-trust interface for individuals, institutions, and administrators.

The visual language should sit between:

- World Economic Forum-style global issue platform;
- green finance / climate infrastructure;
- digital credential and verification system;
- international organisation-level public communication.

Avoid:

- bright environmental green;
- cartoon earth / leaf / NGO visual clichés;
- heavy SaaS gradients;
- flashy Web3 visuals;
- over-decorated AI-generated layouts;
- overly large festival/forum typography;
- dark navy that feels too governmental or severe.

---

## 2. Core Visual Principles

### 2.1 Institutional

The interface should communicate authority, legitimacy, credibility, and long-term governance.

Use:

- controlled layouts;
- strong grid;
- clear hierarchy;
- restrained motion;
- precise spacing;
- low-saturation colours;
- consistent component behaviour.

### 2.2 Green but Not “Eco”

The platform may use green, but only as a **top-tier institutional green**.

The design should feel like:

- climate finance;
- green infrastructure;
- verified trust layer;
- international climate governance.

It should not feel like:

- generic environmental NGO;
- wellness brand;
- garden / agriculture visual identity;
- bright sustainability campaign.

### 2.3 Calm and Spacious

Most pages should preserve generous white space.

Use larger section spacing, but moderate typography.

Avoid overcrowded dashboards, dense cards, or colourful visual noise.

### 2.4 Global and Multilingual

The system must support Chinese, English and future multilingual content.

All layouts should work with:

- longer English phrases;
- compact Chinese phrases;
- mixed-language labels;
- future i18n routing;
- RTL adaptability as a future consideration.

---

## 3. Colour System

### 3.1 Primary Palette

Use this palette as the global token foundation.

```css
:root {
  --cp-ink: #12382F;
  --cp-ink-hover: #17483D;
  --cp-forest: #1F5A4E;

  --cp-bg: #F6F9F6;
  --cp-bg-soft: #EEF6F1;
  --cp-bg-page-top: #F8FBF8;
  --cp-bg-page-mid: #F3F8F4;

  --cp-line: #DDE7E1;
  --cp-line-strong: #BFD0C8;

  --cp-text: #12382F;
  --cp-text-secondary: #36524B;
  --cp-text-muted: rgba(54, 82, 75, 0.55);

  --cp-white: #FFFFFF;
}
```

### 3.2 Usage Ratio

Recommended colour ratio:

- 60–70% white / near-white;
- 15–20% pale green-grey background;
- 10–15% deep green-blue;
- 5% soft borders and muted text.

Do not introduce many accent colours.  
The system should remain predominantly green-blue, white, and green-grey.

### 3.3 Gradients

Gradients should be rare and institutional.

Approved deep panel gradient:

```css
background: linear-gradient(135deg, #12382F 0%, #1F5A4E 62%, #89A99A 160%);
```

Approved page background gradient:

```css
background: linear-gradient(180deg, #F8FBF8 0%, #F3F8F4 46%, #FFFFFF 100%);
```

Approved admin/sidebar gradient:

```css
background: linear-gradient(180deg, #12382F 0%, #1F5A4E 100%);
```

Avoid:

- neon green;
- yellow-green;
- rainbow gradients;
- colourful blobs;
- high-saturation cyan;
- purple/orange decorative gradients.

---

## 4. Typography

### 4.1 Font Stack

Use a multilingual sans-serif stack:

```css
font-family:
  Inter,
  "Noto Sans SC",
  "Source Han Sans SC",
  "PingFang SC",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### 4.2 Typography Style

The design should be serious but not cold.

Use:

- semibold for major headings;
- medium/semibold for labels;
- regular or medium for body;
- restrained letter-spacing for uppercase metadata.

Avoid excessive `font-black`.

### 4.3 Recommended Scale

```css
--cp-text-caption: 11px;
--cp-text-small: 13px;
--cp-text-body: 15px;
--cp-text-body-lg: 17px;

--cp-heading-card: 20px;
--cp-heading-section: 34px;
--cp-heading-section-lg: 42px;
--cp-heading-page: 42px;
--cp-heading-hero: 60px;
```

### 4.4 Line Height

```css
--cp-leading-tight: 1.04;
--cp-leading-heading: 1.08;
--cp-leading-body: 1.7;
```

For Chinese body text, prefer line-height around `1.7`.  
For English body text, prefer `1.55–1.65`.

---

## 5. Layout System

### 5.1 Page Width

Use a controlled institutional width:

```css
--cp-container: 1280px; /* Tailwind max-w-7xl */
```

Recommended section wrapper:

```tsx
<section className="mx-auto max-w-7xl px-5 md:px-8">
  ...
</section>
```

### 5.2 Section Spacing

Use generous vertical spacing:

```tsx
<section className="py-20 md:py-24">
```

Hero:

```tsx
<section className="pt-16 pb-20 md:pt-24 md:pb-28">
```

### 5.3 Grid

Use 12-column thinking, implemented with Tailwind grids.

Common patterns:

```tsx
<div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
```

```tsx
<div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
```

```tsx
<div className="grid gap-6 md:grid-cols-3">
```

```tsx
<div className="grid gap-4 md:grid-cols-4">
```

### 5.4 White Space

Preserve white space as part of the brand.

Do not:

- pack too many cards per section;
- reduce vertical spacing aggressively;
- fill every gap with icons or decoration;
- use dense dashboard design for public pages.

---

## 6. Component System

## 6.1 Button

### Variants

Use four button variants only:

1. `primary`
2. `secondary`
3. `outline`
4. `ghost`

### Primary Button

Used for decisive actions:

- Create Passport
- Verify
- Issue Credential
- Submit
- Download Record

```tsx
className="
inline-flex items-center justify-center gap-2
rounded-full px-4 py-2.5
text-[13px] font-semibold
bg-[#12382F] text-white hover:bg-[#17483D]
transition
"
```

### Secondary Button

Used for secondary but visible actions:

```tsx
className="
bg-white text-[#12382F]
border border-[#BFD0C8]
hover:border-[#12382F] hover:bg-[#F6FAF7]
"
```

### Outline Button

Used for alternative actions:

```tsx
className="
bg-transparent text-[#12382F]
border border-[#BFD0C8]
hover:border-[#12382F] hover:bg-white
"
```

### Ghost Button

Used for navigation or light actions:

```tsx
className="
text-[#36524B]
hover:text-[#12382F] hover:bg-[#EFF5F1]
"
```

### Button Rules

- Use pill buttons.
- Avoid bright green buttons.
- Avoid large marketing-style CTA buttons.
- Keep button text short and action-oriented.
- All buttons should have `type="button"` unless used for form submission.

---

## 6.2 Pill / Badge

Pills are used for:

- status;
- section labels;
- metadata;
- verification state;
- role or category.

### Recommended styles

```tsx
dark: "bg-[#12382F] text-white border-[#12382F]"
default: "bg-white text-[#12382F] border-[#C9D8D1]"
muted: "bg-[#EFF5F1] text-[#36524B] border-[#DDE7E1]"
outline: "bg-transparent text-[#12382F] border-[#BFD0C8]"
glass: "bg-white/10 text-white border-white/18"
```

### Pill Rules

- Use `text-[11px]`.
- Use `font-semibold`.
- Use subtle border.
- Do not use bright success/error badges.
- For verification state, prefer calm labels: `Verified`, `Issued`, `Pending`, `Review`.

---

## 6.3 Card

Cards should feel calm, institutional, and lightly elevated.

```tsx
className="
rounded-[22px]
border border-[#DDE7E1]
bg-white
shadow-[0_14px_36px_rgba(18,56,47,0.04)]
"
```

### Card Rules

- Use soft but not playful radius.
- Use light border.
- Use very soft shadows.
- Avoid glassmorphism.
- Avoid heavy drop shadows.
- Avoid bright coloured card backgrounds.
- Use `p-6` or `p-7` for standard card padding.

---

## 6.4 Institutional Visual Block

Use this component for hero-side visuals or major section visuals.

Visual features:

- deep green-blue gradient;
- subtle grid overlay;
- thin circular outlines;
- text in white;
- restrained metadata labels.

Approved gradient:

```tsx
bg-[linear-gradient(135deg,#12382F_0%,#1F5A4E_62%,#89A99A_160%)]
```

Approved decoration:

```tsx
<div
  className="absolute inset-0 opacity-[0.08]"
  style={{
    backgroundImage:
      "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
    backgroundSize: "40px 40px",
  }}
/>
```

Use sparingly.

---

## 6.5 Metric Card

Used for numbers, stats and dashboard summary.

```tsx
<div className="
rounded-[18px]
border border-[#DDE7E1]
bg-white
p-5
">
  <Icon className="h-5 w-5 text-[#12382F]" />
  <div className="mt-5 text-[28px] font-semibold tracking-[-0.04em] text-[#12382F]">
    12,846
  </div>
  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#36524B]/45">
    Active passports
  </div>
</div>
```

---

## 6.6 Table

Admin tables should be highly readable and audit-friendly.

Recommended:

- header background: `#12382F`;
- header text: white with opacity;
- body background: white;
- dividers: `#DDE7E1`;
- row padding: generous;
- status pills.

```tsx
<table className="w-full min-w-[720px] text-left text-[13px]">
  <thead className="bg-[#12382F] text-[11px] uppercase tracking-[0.14em] text-white/60">
    ...
  </thead>
  <tbody className="divide-y divide-[#DDE7E1] bg-white">
    ...
  </tbody>
</table>
```

---

## 7. Page Templates

## 7.1 Public Home Page

Purpose:

- communicate institutional mission;
- introduce climate identity concept;
- show trust layer;
- guide users to passport creation and credential verification.

Recommended structure:

1. Header
2. Hero
3. Institutional visual block
4. Metrics strip
5. Climate Passport concept
6. System modules
7. Deep trust / concept section
8. Latest updates
9. Subscribe / partner call
10. Footer

Hero style:

```tsx
<h1 className="max-w-4xl text-[45px] font-semibold leading-[1.04] tracking-[-0.045em] text-[#12382F] md:text-[60px]">
  Climate identity for people who move systems.
</h1>
```

Body:

```tsx
<p className="mt-8 max-w-2xl text-[17px] leading-8 text-[#36524B]">
  A calm, international and trust-first design direction...
</p>
```

---

## 7.2 Climate Passport Profile Page

Purpose:

- present an individual’s verified sustainability identity;
- show passport ID;
- show credentials, events, projects and score;
- show timeline and AI insights.

Recommended structure:

1. Profile header
2. Passport ID card
3. Verified records card
4. Credential timeline
5. AI insight card
6. Trust composition card

Tone:

- identity-grade;
- calm;
- personal but not social-media-like;
- more like verified profile + digital credential wallet.

---

## 7.3 Credential Verification Page

Purpose:

- let third parties verify credential authenticity;
- show issuer authority, record integrity, QR verification;
- feel official and trustworthy.

Recommended structure:

1. Centered verification hero
2. Search / input block
3. Verification result card
4. Trust explanation cards

Input block:

```tsx
<div className="
mx-auto mt-10 flex max-w-2xl flex-col gap-3
rounded-[20px] border border-[#DDE7E1]
bg-white p-3
shadow-[0_14px_36px_rgba(18,56,47,0.04)]
md:flex-row
">
```

---

## 7.4 Institutional Admin Dashboard

Purpose:

- allow institutional operators to issue, review and manage records;
- maintain high-trust audit-friendly operations;
- avoid overly colourful SaaS dashboard patterns.

Recommended structure:

1. Left sidebar
2. Dashboard header
3. Summary metric cards
4. Recent operations table
5. Review workflows
6. Reports / insights

Sidebar:

```tsx
<aside className="
rounded-[24px]
bg-[linear-gradient(180deg,#12382F_0%,#1F5A4E_100%)]
p-5 text-white
">
```

---

## 7.5 Footer

Footer should operate as a **trust and governance layer**, not only a link list.

Include:

- brand identity;
- short institutional statement;
- credential verification entry;
- language selector;
- platform links;
- institution links;
- resources;
- governance links;
- terms, privacy, security;
- copyright.

Recommended footer background:

```tsx
<footer className="
relative overflow-hidden
border-t border-[#DDE7E1]
bg-[#0F2F28]
text-white
">
```

Footer navigation groups:

```ts
const groups = [
  ["Platform", ["Climate Passport", "Verified Records", "Credential Verification", "Programmes"]],
  ["For Institutions", ["Issue Credentials", "Partner Registry", "Programme Management", "Data & Insights"]],
  ["Resources", ["Concept Note", "Standards", "Help Centre", "Latest Updates"]],
  ["Governance", ["Privacy", "Data Ownership", "Security", "Accessibility"]],
];
```

Footer statement:

> A trusted climate-era identity infrastructure for verified learning, credentials, actions and institutional collaboration.

---

## 8. Icon System

Use a unified line-icon system.

Rules:

- stroke width: around 1.7px;
- rounded stroke caps and joins;
- no filled colourful icons;
- use single colour inherited from text;
- keep icons small and functional.

Recommended icon names:

- globe
- file
- shield
- qr
- arrow
- check
- users
- calendar
- spark
- chart
- language
- fingerprint

For production, use one of:

- Lucide React
- Phosphor Icons
- IBM Carbon Icons

If using Lucide, map internal names to imported icons.

Example:

```tsx
import {
  Globe2,
  FileCheck,
  ShieldCheck,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Users,
  CalendarDays,
  Sparkles,
  BarChart3,
  Languages,
  Fingerprint,
} from "lucide-react";
```

---

## 9. Motion

Motion should feel like a system becoming available, not like a marketing animation.

Use:

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.45 }}
>
```

Rules:

- duration: 0.25–0.55s;
- no bounce;
- no excessive parallax;
- no particle animation;
- no spinning icons;
- no unnecessary motion inside dashboards.

---

## 10. Accessibility

Minimum requirements:

- all buttons use visible focus states;
- all interactive elements use semantic elements;
- do not rely on colour only for status;
- maintain sufficient contrast;
- support keyboard navigation;
- use `aria-hidden="true"` for purely decorative SVG icons;
- provide accessible labels for icon-only buttons;
- support reduced motion preference in production.

Recommended focus class:

```tsx
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-[#12382F]
focus-visible:ring-offset-2
```

---

## 11. Responsive Rules

Breakpoints:

- mobile: default;
- tablet: `md`;
- desktop: `lg`;
- wide: `xl` / `max-w-7xl`.

Rules:

- hero becomes single-column on mobile;
- cards stack on mobile;
- dashboard tables should use horizontal scroll;
- header navigation may collapse into menu later;
- footer link groups become two-column or single-column on smaller screens.

---

## 12. i18n and Multilingual Rules

Use route-based locale structure:

```txt
/en
/zh
```

or Next.js App Router:

```txt
app/[locale]/...
```

Text rules:

- avoid hard-coded long text inside components;
- store labels in dictionaries;
- design for longer English text;
- Chinese and English should not be forced into same line if it harms readability;
- use neutral component names independent of language.

Example dictionary:

```ts
export const dict = {
  en: {
    createPassport: "Create Passport",
    verifyCredential: "Verify Credential",
  },
  zh: {
    createPassport: "创建气候护照",
    verifyCredential: "验证证书",
  },
};
```

---

## 13. Suggested File Structure

For a Next.js + Tailwind project:

```txt
src/
  app/
    [locale]/
      page.tsx
      passport/
        page.tsx
      verify/
        page.tsx
      admin/
        page.tsx

  components/
    cp/
      CPButton.tsx
      CPPill.tsx
      CPCard.tsx
      CPIcon.tsx
      CPHeader.tsx
      CPFooter.tsx
      CPInstitutionalVisual.tsx
      CPMetricCard.tsx
      CPNewsCard.tsx
      CPTable.tsx

  styles/
    climate-passport-tokens.css

  lib/
    i18n/
      dict.ts
```

---

## 14. Tailwind Token Extension

Add these values to `tailwind.config.ts` when possible.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        cp: {
          ink: "#12382F",
          inkHover: "#17483D",
          forest: "#1F5A4E",
          bg: "#F6F9F6",
          bgSoft: "#EEF6F1",
          line: "#DDE7E1",
          lineStrong: "#BFD0C8",
          textSecondary: "#36524B",
        },
      },
      boxShadow: {
        cp: "0 14px 36px rgba(18, 56, 47, 0.04)",
      },
      borderRadius: {
        cp: "22px",
      },
    },
  },
};

export default config;
```

---

## 15. Component Implementation Examples

### 15.1 CPButton

```tsx
type CPButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
};

export function CPButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: CPButtonProps) {
  const styles = {
    primary: "bg-[#12382F] text-white hover:bg-[#17483D]",
    secondary: "bg-white text-[#12382F] border border-[#BFD0C8] hover:border-[#12382F] hover:bg-[#F6FAF7]",
    outline: "bg-transparent text-[#12382F] border border-[#BFD0C8] hover:border-[#12382F] hover:bg-white",
    ghost: "text-[#36524B] hover:text-[#12382F] hover:bg-[#EFF5F1]",
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### 15.2 CPPill

```tsx
export function CPPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "dark" | "default" | "muted" | "outline" | "glass";
}) {
  const styles = {
    dark: "bg-[#12382F] text-white border-[#12382F]",
    default: "bg-white text-[#12382F] border-[#C9D8D1]",
    muted: "bg-[#EFF5F1] text-[#36524B] border-[#DDE7E1]",
    outline: "bg-transparent text-[#12382F] border-[#BFD0C8]",
    glass: "bg-white/10 text-white border-white/18",
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide ${styles[tone]}`}>
      {children}
    </span>
  );
}
```

### 15.3 CPCard

```tsx
export function CPCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[22px] border border-[#DDE7E1] bg-white shadow-[0_14px_36px_rgba(18,56,47,0.04)] ${className}`}>
      {children}
    </div>
  );
}
```

---

## 16. Copywriting Tone

Climate Passport copy should sound:

- institutional;
- precise;
- calm;
- optimistic;
- global;
- trust-oriented.

Use phrases such as:

- trusted climate-era identity infrastructure;
- verified climate action records;
- institution-issued credentials;
- user-owned learning and action history;
- global collaboration layer;
- verification-ready records;
- partner-led programmes;
- climate talent and capability signals.

Avoid:

- “save the planet”;
- “go green”;
- “fun eco points”;
- “blockchain revolution”;
- “AI-powered everything”;
- generic sustainability slogans.

---

## 17. Copilot Development Instructions

When using GitHub Copilot / Codex, paste or reference the following instruction:

```txt
Develop Climate Passport UI using the Climate Passport Global Design Foundation.

The interface must follow a WEF-inspired international institutional design language with a top-tier green finance / climate infrastructure colour system.

Use primary colour #12382F, hover #17483D, forest #1F5A4E, pale backgrounds #F6F9F6 and #EEF6F1, border #DDE7E1, strong border #BFD0C8, and secondary text #36524B.

Maintain generous white space, restrained typography, rounded institutional cards, very soft shadows, and pill-shaped buttons. Avoid bright green, colourful gradients, NGO-style eco visuals, cartoon earth/leaf imagery, heavy SaaS dashboard styling, and excessive animation.

Use Inter + Noto Sans SC + Source Han Sans SC + PingFang SC + system-ui as the font stack. Support Chinese and English content. Keep font sizes moderate: hero 45–60px, section headings 34–42px, card headings around 20px, body 15–17px.

Build reusable components: CPButton, CPPill, CPCard, CPHeader, CPFooter, CPIcon, CPInstitutionalVisual, CPMetricCard, CPNewsCard, CPTable.

Public pages should feel like an international institutional platform. Passport and verification pages should feel like digital identity and credential infrastructure. Admin pages should feel audit-ready, calm, and operational.
```

---

## 18. Final Design Summary

Climate Passport should look and feel like:

> a WEF-level global climate identity infrastructure, using restrained institutional green, calm spacing, trusted verification patterns, and multilingual-ready interface components.

It should not look like:

> a generic eco website, NGO campaign, Web3 project, SaaS dashboard, education portal, or colourful event microsite.

The final system should communicate:

- trust;
- legitimacy;
- climate action;
- verified identity;
- institutional collaboration;
- future-facing but grounded infrastructure.
