import React from "react";
import { Globe, Building2 } from "lucide-react";

interface FederatedEventBadgeProps {
  hostInstitution: string;
  originDomain?: string;
  className?: string;
}

export const FederatedEventBadge: React.FC<FederatedEventBadgeProps> = ({
  hostInstitution,
  originDomain,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm ${className}`}
      title={`Federated cross-campus event hosted by ${hostInstitution}${originDomain ? ` (${originDomain})` : ""}`}
    >
      <Globe className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
      <span className="flex items-center gap-1">
        <Building2 className="w-3 h-3 opacity-70" />
        Hosted by {hostInstitution}
      </span>
    </div>
  );
};
