import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
