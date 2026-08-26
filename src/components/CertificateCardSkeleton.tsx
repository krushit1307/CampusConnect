import { Skeleton } from "@/components/ui/skeleton";

export function CertificateCardSkeleton() {
  return (
    <div className="neu-border bg-white p-4">
      <Skeleton className="h-44 w-full rounded-md" />

      <Skeleton className="mt-4 h-5 w-3/4" />

      <Skeleton className="mt-2 h-4 w-32" />

      <Skeleton className="mt-4 h-9 w-full" />
    </div>
  );
}
