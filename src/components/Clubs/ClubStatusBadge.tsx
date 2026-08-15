import React from "react";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/supabase";

type ClubStatus = Database["public"]["Enums"]["club_status"];

interface ClubStatusBadgeProps {
  status: ClubStatus | null | undefined;
}

export function ClubStatusBadge({ status }: ClubStatusBadgeProps) {
  if (!status) return null;

  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
          Active
        </Badge>
      );
    case "pending_renewal":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
          Pending Renewal
        </Badge>
      );
    case "suspended":
      return <Badge variant="destructive">Suspended</Badge>;
    case "hibernating":
      return (
        <Badge variant="outline" className="border-indigo-500 text-indigo-700">
          Hibernating
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline" className="border-gray-500 text-gray-700 bg-gray-100">
          Archived
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
