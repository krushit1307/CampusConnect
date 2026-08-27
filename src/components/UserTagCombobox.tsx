import React from "react";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { HighlightText } from "@/components/ui/HighlightText";
import User from "lucide-react/dist/esm/icons/user";
import { createClient } from "@/lib/supabase/client";

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatar_url?: string;
  email?: string;
}

export interface UserTagComboboxProps {
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Pre-configured User Tagging Combobox component (#1735)
 * Queries user profiles by name or handle and displays results with text highlighting.
 */
export const UserTagCombobox: React.FC<UserTagComboboxProps> = ({
  onSelectUser,
  placeholder = "Tag a user e.g. @john or John Smith...",
  disabled = false,
  className,
}) => {
  const fetchUsers = async (query: string, signal?: AbortSignal): Promise<UserProfile[]> => {
    const cleanQuery = query.replace(/^@/, "").trim();
    if (!cleanQuery) return [];

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url, email")
        .or(`name.ilike.%${cleanQuery}%,handle.ilike.%${cleanQuery}%`)
        .limit(8)
        .abortSignal(signal || new AbortController().signal);

      if (error) {
        console.error("Error fetching profiles for combobox:", error);
        return [];
      }

      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name || u.handle || "Campus User",
        handle: u.handle || u.id.slice(0, 8),
        avatar_url: u.avatar_url,
        email: u.email,
      }));
    } catch (err: any) {
      if (err.name === "AbortError") return [];
      console.error("User search failed:", err);
      return [];
    }
  };

  return (
    <AsyncCombobox<UserProfile>
      fetchOptions={fetchUsers}
      onSelect={onSelectUser}
      getOptionLabel={(user) => user.name}
      getOptionValue={(user) => user.id}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      ariaLabel="Tag user combobox"
      renderOption={(user, searchQuery) => {
        const cleanQuery = searchQuery.replace(/^@/, "").trim();
        return (
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-cream border border-black flex items-center justify-center text-black shrink-0 font-bold">
                <User className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">
                <HighlightText text={user.name} highlight={cleanQuery} />
              </span>
              <span className="text-xs text-gray-500 font-mono truncate">
                @<HighlightText text={user.handle} highlight={cleanQuery} />
              </span>
            </div>
          </div>
        );
      }}
    />
  );
};
