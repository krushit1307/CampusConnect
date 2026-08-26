/* eslint-disable @typescript-eslint/no-explicit-any */
import ArrowUpDown from "lucide-react/dist/esm/icons/arrow-up-down";
import Accessibility from "lucide-react/dist/esm/icons/accessibility";
import Users from "lucide-react/dist/esm/icons/users";
import Ear from "lucide-react/dist/esm/icons/ear";
import Flower from "lucide-react/dist/esm/icons/flower";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AccessibilityFeatures {
  has_elevator: boolean;
  wheelchair_ramp: boolean;
  gender_neutral_restrooms: boolean;
  hearing_loop: boolean;
  low_sensory_zone: boolean;
}

interface Override {
  feature: keyof AccessibilityFeatures;
  status: string;
  message: string;
}

interface AccessibilityBadgesProps {
  features: AccessibilityFeatures | null;
  overrides?: Override[];
}

export function AccessibilityBadges({ features, overrides = [] }: AccessibilityBadgesProps) {
  if (!features) return null;

  const getOverride = (feature: keyof AccessibilityFeatures) => {
    return overrides.find((o) => o.feature === feature);
  };

  const BadgeItem = ({
    featureKey,
    Icon,
    label,
    enabled,
  }: {
    featureKey: keyof AccessibilityFeatures;
    Icon: any;
    label: string;
    enabled: boolean;
  }) => {
    const override = getOverride(featureKey);
    const isActuallyEnabled = override ? override.status === "available" : enabled;
    const hasIssue = override && override.status !== "available";

    if (!isActuallyEnabled && !hasIssue) {
      return null;
    }

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex items-center justify-center p-2 rounded-full border-2 transition-colors ${
                hasIssue
                  ? "border-red-500 bg-red-100 text-red-700"
                  : "border-teal-500 bg-teal-100 text-teal-800"
              }`}
              aria-label={
                hasIssue ? `Issue with ${label}: ${override.message}` : `${label} available`
              }
              tabIndex={0}
            >
              {hasIssue ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-black text-white p-2 text-sm font-mono z-50">
            <p>{label}</p>
            {hasIssue && <p className="text-red-300 mt-1 font-bold">⚠️ {override.message}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <BadgeItem
        featureKey="has_elevator"
        Icon={ArrowUpDown}
        label="Elevator Access"
        enabled={features.has_elevator}
      />
      <BadgeItem
        featureKey="wheelchair_ramp"
        Icon={Accessibility}
        label="Wheelchair Accessible"
        enabled={features.wheelchair_ramp}
      />
      <BadgeItem
        featureKey="gender_neutral_restrooms"
        Icon={Users}
        label="Gender-Neutral Restrooms"
        enabled={features.gender_neutral_restrooms}
      />
      <BadgeItem
        featureKey="hearing_loop"
        Icon={Ear}
        label="Hearing Loop"
        enabled={features.hearing_loop}
      />
      <BadgeItem
        featureKey="low_sensory_zone"
        Icon={Flower}
        label="Low-Sensory Zone"
        enabled={features.low_sensory_zone}
      />
    </div>
  );
}
