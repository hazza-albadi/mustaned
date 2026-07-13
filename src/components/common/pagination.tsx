"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {pageCount}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
