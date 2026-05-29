"use client";

interface Props {
  rows: Record<string, string | number | boolean | null | undefined>[];
  filename: string;
  label?: string;
}

function escapeCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function CsvExportButton({ rows, filename, label = "Export CSV" }: Props) {
  function handleExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map(escapeCell).join(","),
      ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button className="button button button-secondary" type="button" onClick={handleExport}>
      {label}
    </button>
  );
}
