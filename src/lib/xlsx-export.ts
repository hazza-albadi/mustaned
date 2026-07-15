// xlsx is a large library (100+ kB) only ever needed inside an onClick
// handler — a static top-level import bloats every page that imports this
// module into its initial JS bundle even though the export button is never
// clicked on most page loads. Loaded lazily instead, mirroring the same fix
// applied to @react-pdf/renderer in src/lib/pdf/submission-pdf.tsx.
export async function downloadXlsx(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    // Excel caps sheet names at 31 characters.
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
