import React from "react";
import { Link } from "react-router-dom";
import Users from "lucide-react/dist/esm/icons/users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SharedClub } from "@/lib/sharedClubs";

export interface SharedClubsSectionProps {
  clubs: SharedClub[];
  isLoading?: boolean;
  targetUserName?: string;
}

function getInitials(name: string): string {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const SharedClubsSection: React.FC<SharedClubsSectionProps> = ({
  clubs,
  isLoading = false,
  targetUserName = "this user",
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4 font-mono">
        <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
          <Users size={24} className="text-purple-600" />
          <h2>Clubs in Common</h2>
        </div>
        <div className="animate-pulse flex items-center gap-3 bg-gray-100 p-4 border-2 border-black">
          <div className="h-10 w-10 bg-gray-300 rounded-none border border-black" />
          <div className="h-4 w-32 bg-gray-300" />
        </div>
      </div>
    );
  }

  if (!clubs || clubs.length === 0) {
    return (
      <div className="space-y-4 font-mono">
        <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
          <Users size={24} className="text-purple-600" />
          <h2>Clubs in Common</h2>
        </div>
        <p className="text-sm text-gray-500 italic">
          You and {targetUserName} don&apos;t share any clubs yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono" data-testid="shared-clubs-section">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <div className="flex items-center gap-2 text-xl font-bold font-display">
          <Users size={24} className="text-purple-600" />
          <h2>Clubs in Common</h2>
        </div>
        <span className="neu-border bg-lime px-2.5 py-0.5 text-xs font-bold text-black">
          {clubs.length} {clubs.length === 1 ? "Club" : "Clubs"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {clubs.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.slug}`}
            className="neu-border neu-press flex items-center gap-3 bg-purple-100 p-4 transition-transform hover:-translate-y-1"
          >
            <Avatar className="h-10 w-10 border-2 border-black rounded-none bg-white">
              <AvatarImage src={club.logo_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-none font-bold bg-lime text-black">
                {getInitials(club.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-bold font-mono text-sm truncate">{club.name}</div>
              {club.category && (
                <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                  {club.category}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
