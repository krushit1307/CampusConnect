import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ClubHibernationBannerProps {
  clubId: string;
  clubName: string;
  isArchived: boolean;
}

export function ClubHibernationBanner({
  clubId,
  clubName,
  isArchived,
}: ClubHibernationBannerProps) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-indigo-900">
            {isArchived ? "This club is archived." : "This club is hibernating."}
          </h3>
          <p className="text-sm text-indigo-700 mt-1">
            {clubName} has been inactive and is currently frozen. If you're a student interested in
            taking over leadership, you can petition to revive it.
          </p>
        </div>
      </div>
      <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
        <Link to={`/clubs/${clubId}/revive`}>Petition to Revive</Link>
      </Button>
    </div>
  );
}
