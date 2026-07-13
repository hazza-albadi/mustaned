import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types";

// Brand secondary colors (gold/olive) mark PENDING/APPROVED; text uses a
// color-mix'd darker shade of each so it stays readable at badge size — the
// raw brand tones are too light for AA contrast on their own tint. No brand
// color reads as "danger", so REJECTED keeps the standard red.
const STYLES: Record<SubmissionStatus, string> = {
  PENDING:
    "bg-utas-yellow/15 border-utas-yellow/40 text-[color-mix(in_oklch,var(--utas-yellow),black_45%)] hover:bg-utas-yellow/15",
  APPROVED:
    "bg-utas-olive/15 border-utas-olive/40 text-[color-mix(in_oklch,var(--utas-olive),black_35%)] hover:bg-utas-olive/15",
  REJECTED: "bg-red-100 text-red-800 border-red-300 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status, label }: { status: SubmissionStatus; label: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {label}
    </Badge>
  );
}
