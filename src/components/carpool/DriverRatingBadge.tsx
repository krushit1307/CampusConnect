import { Star, AlertTriangle, ShieldAlert } from "lucide-react";
import { formatDriverRatingBadge } from "@/lib/carpoolDriverRating";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DriverRatingBadgeProps {
  rating: number | null;
  ratingCount: number;
  isBlocked?: boolean;
  size?: "sm" | "md";
}

export function DriverRatingBadge({
  rating,
  ratingCount,
  isBlocked = false,
  size = "sm",
}: DriverRatingBadgeProps) {
  const { displayText, badgeVariant, tooltip } = formatDriverRatingBadge(
    rating,
    ratingCount,
    isBlocked,
  );

  const isSmall = size === "sm";

  const colorStyles = {
    success: "bg-emerald-100 text-emerald-900 border-emerald-400",
    warning: "bg-amber-100 text-amber-900 border-amber-400",
    danger: "bg-red-100 text-red-900 border-red-500 font-black",
    neutral: "bg-gray-100 text-gray-700 border-gray-300",
  }[badgeVariant];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase transition-transform select-none ${
              isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
            } ${colorStyles}`}
          >
            {isBlocked ? (
              <ShieldAlert className={isSmall ? "h-3 w-3 text-red-600" : "h-4 w-4 text-red-600"} />
            ) : rating !== null && rating < 3.0 && ratingCount > 0 ? (
              <AlertTriangle
                className={isSmall ? "h-3 w-3 text-amber-600" : "h-4 w-4 text-amber-600"}
              />
            ) : rating !== null ? (
              <Star
                className={`${isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} fill-amber-400 text-amber-500`}
              />
            ) : null}
            <span>{displayText}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
