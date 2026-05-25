"use client";

import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { Locale } from "@/lib/site-content";

const LOCALE_OPTIONS = [
  { code: "en" as const, flag: "🇬🇧", label: "English" },
  { code: "zh" as const, flag: "🇨🇳", label: "中文" },
  { code: "fr" as const, flag: "🇫🇷", label: "Français" },
  { code: "de" as const, flag: "🇩🇪", label: "Deutsch" },
];

const LOCALE_SWITCH_PRESERVE_STORAGE_KEY = "locale-switch-preserve-path-v1";

function getLocaleIndependentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const knownLocales = new Set(["en", "zh", "fr", "de"]);
  const tail = knownLocales.has(segments[0]) ? segments.slice(1) : segments;
  return `/${tail.join("/")}`;
}

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract tail path (everything after the locale segment)
  const segments = pathname.split("/").filter(Boolean);
  const knownLocales = new Set(["en", "zh", "fr", "de"]);
  const tail = knownLocales.has(segments[0]) ? segments.slice(1) : segments;

  const current = LOCALE_OPTIONS.find((l) => l.code === locale) ?? LOCALE_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function markLocaleSwitchPreserve() {
    try {
      window.sessionStorage.setItem(LOCALE_SWITCH_PRESERVE_STORAGE_KEY, getLocaleIndependentPath(pathname));
    } catch {
      // Ignore storage write errors.
    }
  }

  return (
    <div className="locale-switcher" ref={ref} aria-label={label}>
      <button
        className="locale-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        type="button"
      >
        <span className="locale-flag" aria-hidden="true">{current.flag}</span>
        <span className="locale-name">{current.label}</span>
        <span className="locale-chevron" aria-hidden="true" data-open={open}>▾</span>
      </button>

      {open && (
        <ul className="locale-dropdown" role="listbox" aria-label={label}>
          {LOCALE_OPTIONS.map((opt) => {
            const href = `/${opt.code}${tail.length ? `/${tail.join("/")}` : ""}`;
            return (
              <li
                key={opt.code}
                role="option"
                aria-selected={opt.code === locale}
                className={opt.code === locale ? "locale-option locale-option-active" : "locale-option"}
              >
                <a href={href} onClick={() => { markLocaleSwitchPreserve(); setOpen(false); }}>
                  <span className="locale-flag" aria-hidden="true">{opt.flag}</span>
                  <span className="locale-name">{opt.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
