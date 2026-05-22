"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/site-content";

const OPTIONS = [
  { code: "en" as const, flag: "🇬🇧", label: "English" },
  { code: "zh" as const, flag: "🇨🇳", label: "中文" },
];

export function SummerSchoolLocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((item) => item.code === locale) ?? OPTIONS[0];

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function buildHref(code: "en" | "zh") {
    const next = new URLSearchParams(searchParams.toString());
    next.set("lang", code);
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="locale-switcher" ref={ref} aria-label={label}>
      <button
        className="locale-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="locale-flag" aria-hidden="true">{current.flag}</span>
        <span className="locale-name">{current.label}</span>
        <span className="locale-chevron" aria-hidden="true" data-open={open}>▾</span>
      </button>

      {open && (
        <ul className="locale-dropdown" role="listbox" aria-label={label}>
          {OPTIONS.map((option) => (
            <li
              key={option.code}
              role="option"
              aria-selected={option.code === locale}
              className={option.code === locale ? "locale-option locale-option-active" : "locale-option"}
            >
              <Link href={buildHref(option.code)} onClick={() => setOpen(false)}>
                <span className="locale-flag" aria-hidden="true">{option.flag}</span>
                <span className="locale-name">{option.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
