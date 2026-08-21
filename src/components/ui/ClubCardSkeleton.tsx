import { OrganicSkeleton, TextSkeleton } from "@/components/ui/OrganicSkeleton";

const DESCRIPTION_LINES: Record<"sm" | "md" | "lg", number> = {
  sm: 1,
  md: 2,
  lg: 4,
};

export function ClubCardSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const lines = DESCRIPTION_LINES[size];

  return (
    <div className="neu-border flex h-full flex-col justify-between bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <OrganicSkeleton width="70px" height="h-5" className="border-2 border-black" />
        </div>
        <OrganicSkeleton width="75%" height="h-6" className="mb-4" seed={`club-title-${size}`} />
        <div className="mb-6">
          <TextSkeleton lines={lines} lineHeight="h-3" seed={`club-desc-${size}`} />
        </div>
      </div>
      <div>
        <div className="my-3 border-t-2 border-black" />
        <div className="flex items-center justify-between">
          <OrganicSkeleton width="90px" height="h-4" seed={`club-meta-1-${size}`} />
          <OrganicSkeleton width="75px" height="h-4" seed={`club-meta-2-${size}`} />
        </div>
      </div>
    </div>
  );
}
