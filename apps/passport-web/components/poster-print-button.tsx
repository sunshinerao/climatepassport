"use client";

export function PosterPrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "0.75rem 1.5rem",
        background: "#16a34a",
        color: "#fff",
        border: "none",
        borderRadius: "0.5rem",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "var(--cp-text-small)",
      }}
      type="button"
    >
      {label}
    </button>
  );
}
