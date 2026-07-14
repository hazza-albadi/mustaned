"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/config";

export function DownloadPdfButton({
  submissionId,
  size = "sm",
  variant = "outline",
}: {
  submissionId: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
}) {
  const { t, locale } = useI18n();
  const [generating, setGenerating] = useState(false);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, locale }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("common.error"));
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? `${submissionId}.pdf`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[DownloadPdfButton] PDF generation failed for submission", submissionId, err);
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className="gap-1"
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {t("common.downloadPdf")}
    </Button>
  );
}
