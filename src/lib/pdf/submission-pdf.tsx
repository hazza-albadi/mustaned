import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { ResolvedFieldEntry } from "@/lib/submission-fields";

// Server-only module (rendered inside /api/generate-pdf) — safe to read the
// logo straight off disk instead of resolving it as a URL, which avoids any
// ambiguity between a relative browser path and a server-side file path.
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");
const logoBuffer = fs.readFileSync(LOGO_PATH);

// @react-pdf/renderer's default text layout only wraps at whitespace — a
// single long hyphen-joined token (a date like "22-07-2026", an item code,
// a SKU) has none, so it's treated as one unbreakable word. In a normal
// paragraph that's rarely visible, but inside a narrow table cell (many
// columns) it overflows the cell and visibly overlaps the next one instead
// of wrapping. Registering hyphens as valid break points fixes this at the
// source rather than just hoping cells stay wide enough.
Font.registerHyphenationCallback((word) => {
  if (!word.includes("-")) return [word];
  const parts = word.split("-");
  return parts.map((part, i) => (i < parts.length - 1 ? `${part}-` : part));
});

// UTAS brand palette — kept as literal hex since @react-pdf/renderer renders
// to a PDF canvas, not the DOM, so CSS custom properties aren't available.
const NAVY = "#2D348A";
const ORANGE = "#E46825";

const styles = StyleSheet.create({
  page: { padding: 40, paddingTop: 46, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: ORANGE },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: { maxWidth: "70%" },
  title: { fontSize: 18, fontWeight: 700, color: NAVY },
  meta: { fontSize: 9, color: "#6B7280", marginTop: 3 },
  // Actual logo asset is portrait (345x500) — size it to the header height and
  // let width follow the aspect ratio instead of forcing a wide box.
  logoImage: { width: 40, height: 58, objectFit: "contain" },
  statusRow: { marginTop: 10 },
  statusLabel: { fontSize: 11, fontWeight: 700, color: "#059669" },
  employeeSection: { marginTop: 4, marginBottom: 4 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: NAVY,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  employeeRow: { flexDirection: "row", marginBottom: 2 },
  employeeLabel: { fontSize: 9, color: "#6B7280", width: 90 },
  employeeValue: { fontSize: 10, color: "#111827" },
  divider: { borderBottomWidth: 2, borderBottomColor: NAVY, opacity: 0.25, marginVertical: 14 },
  approversSection: { marginTop: 4, marginBottom: 4 },
  approverRow: { marginBottom: 6 },
  approverNameLine: { flexDirection: "row", justifyContent: "space-between" },
  approverName: { fontSize: 10, fontWeight: 700, color: "#111827" },
  approverDate: { fontSize: 8, color: "#6B7280" },
  approverPosition: { fontSize: 9, color: "#6B7280", marginTop: 1 },
  fieldRow: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValueBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    paddingBottom: 4,
    minHeight: 16,
  },
  fieldValue: { fontSize: 11 },
  sectionHeadingBlock: { marginTop: 6, marginBottom: 12 },
  sectionHeadingText: { fontSize: 13, fontWeight: 700, color: NAVY },
  sectionHeadingDesc: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  sectionHeadingRule: { borderBottomWidth: 2, borderBottomColor: ORANGE, marginTop: 8 },
  imageBlock: { alignItems: "center", marginVertical: 10 },
  blockImage: { maxWidth: 300, maxHeight: 200, objectFit: "contain" },
  imageCaption: { fontSize: 8, color: "#6B7280", marginTop: 4 },
  tableFieldBlock: { marginBottom: 14 },
  tableWrap: { borderWidth: 1, borderColor: "#9CA3AF" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: NAVY },
  tableHeaderCell: {
    flex: 1,
    padding: 4,
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableHeaderCellBorder: { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.25)" },
  // wrap=false keeps a single row's cells from being split across a page
  // break — the table itself (tableWrap) is left splittable so a long
  // table still flows onto the next page instead of overflowing.
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  tableCell: { flex: 1, padding: 4, fontSize: 9, color: "#111827" },
  tableCellBorder: { borderRightWidth: 1, borderRightColor: "#E5E7EB" },
  tableEmpty: { padding: 8, fontSize: 9, color: "#6B7280", fontStyle: "italic" },
  filesSection: { marginTop: 8 },
  filesTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4, color: NAVY },
  fileItem: { fontSize: 9, color: "#374151", marginBottom: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

export type SubmissionPdfApprover = {
  name: string;
  positionLabel: string | null;
  date: string | null;
};

export type SubmissionPdfData = {
  formTitle: string;
  submissionId: string;
  submittedAt: string;
  employeeName: string;
  employeePositionLabel: string | null;
  employeeEmail: string;
  approvers: SubmissionPdfApprover[];
  fields: ResolvedFieldEntry[];
  files: { name: string }[];
};

function SubmissionPdfDocument({ data }: { data: SubmissionPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{data.formTitle}</Text>
            <Text style={styles.meta}>Submission ID: {data.submissionId}</Text>
            <Text style={styles.meta}>Submitted on: {data.submittedAt}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status: APPROVED</Text>
            </View>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this isn't a DOM <img> */}
          <Image src={logoBuffer} style={styles.logoImage} />
        </View>

        <View style={styles.employeeSection}>
          <Text style={styles.sectionTitle}>Employee Information</Text>
          <View style={styles.employeeRow}>
            <Text style={styles.employeeLabel}>Full Name:</Text>
            <Text style={styles.employeeValue}>{data.employeeName}</Text>
          </View>
          <View style={styles.employeeRow}>
            <Text style={styles.employeeLabel}>Position:</Text>
            <Text style={styles.employeeValue}>{data.employeePositionLabel ?? "—"}</Text>
          </View>
          <View style={styles.employeeRow}>
            <Text style={styles.employeeLabel}>Email:</Text>
            <Text style={styles.employeeValue}>{data.employeeEmail}</Text>
          </View>
        </View>

        {data.approvers.length > 0 && (
          <View style={styles.approversSection}>
            <Text style={styles.sectionTitle}>Approved By</Text>
            {data.approvers.map((approver, i) => (
              <View style={styles.approverRow} key={i}>
                <View style={styles.approverNameLine}>
                  <Text style={styles.approverName}>{approver.name}</Text>
                  {approver.date && <Text style={styles.approverDate}>{approver.date}</Text>}
                </View>
                {approver.positionLabel && (
                  <Text style={styles.approverPosition}>{approver.positionLabel}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {data.fields.map((field) => {
          if (field.kind === "section_heading") {
            return (
              <View style={styles.sectionHeadingBlock} key={field.id}>
                <Text style={styles.sectionHeadingText}>{field.heading}</Text>
                {field.description && <Text style={styles.sectionHeadingDesc}>{field.description}</Text>}
                <View style={styles.sectionHeadingRule} />
              </View>
            );
          }
          if (field.kind === "image_block") {
            return (
              <View style={styles.imageBlock} key={field.id}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop */}
                {field.imageUrl && <Image src={field.imageUrl} style={styles.blockImage} />}
                {field.caption && <Text style={styles.imageCaption}>{field.caption}</Text>}
              </View>
            );
          }
          if (field.kind === "table") {
            return (
              <View style={styles.tableFieldBlock} key={field.id}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {field.rows.length === 0 ? (
                  <View style={styles.tableWrap}>
                    <Text style={styles.tableEmpty}>No rows submitted</Text>
                  </View>
                ) : (
                  <View style={styles.tableWrap}>
                    <View style={styles.tableHeaderRow}>
                      {field.columns.map((col, i) => (
                        <Text
                          key={col}
                          style={[
                            styles.tableHeaderCell,
                            i < field.columns.length - 1 ? styles.tableHeaderCellBorder : {},
                          ]}
                        >
                          {col}
                        </Text>
                      ))}
                    </View>
                    {field.rows.map((row, rowIndex) => (
                      <View style={styles.tableRow} key={rowIndex} wrap={false}>
                        {field.columns.map((col, i) => (
                          <Text
                            key={col}
                            style={[styles.tableCell, i < field.columns.length - 1 ? styles.tableCellBorder : {}]}
                          >
                            {row[col] || "—"}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }
          return (
            <View style={styles.fieldRow} key={field.id}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValue}>{field.value}</Text>
              </View>
            </View>
          );
        })}

        {data.files.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={styles.filesTitle}>Attachments</Text>
            {data.files.map((file) => (
              <Text style={styles.fileItem} key={file.name}>
                • {file.name}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          This document was generated by the UTAS Internal Forms System — Generated on{" "}
          {new Date().toLocaleString()}
        </Text>
      </Page>
    </Document>
  );
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSubmissionPdfFileName(formTitle: string, submissionId: string): string {
  return `${sanitizeFileNamePart(formTitle) || "form"}-${submissionId}.pdf`;
}

export async function renderSubmissionPdf(data: SubmissionPdfData): Promise<Blob> {
  return pdf(<SubmissionPdfDocument data={data} />).toBlob();
}
