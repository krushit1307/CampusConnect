import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EventGuestListProps {
  eventId: string;
}

export function EventGuestList({ eventId }: EventGuestListProps) {
  const { data: guests, isLoading } = useQuery({
    queryKey: ["public_event_guests", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_event_guests", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="mt-8 border-t-2 border-black pt-8">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-4">
          Who's Going
        </h2>
        <div className="flex flex-wrap gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded-full bg-gray-200 border-2 border-black"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!guests || guests.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 border-t-2 border-black pt-8">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-4">
        Who's Going ({guests.length})
      </h2>
      <div className="flex flex-wrap gap-3">
        {guests.map((guest: any, i: number) => {
          const isAnonymous = !guest.user_id; // RLS/RPC masks user_id to NULL
          const name = guest.display_name || "Anonymous Student";
          const initials = isAnonymous ? "?" : name.substring(0, 2).toUpperCase();

          return (
            <div key={guest.user_id || `anon-${i}`} title={name}>
              <Avatar className="h-12 w-12 border-2 border-black hover:scale-105 transition-transform bg-white">
                {!isAnonymous && guest.avatar_url && (
                  <AvatarImage src={guest.avatar_url} className="object-cover" />
                )}
                <AvatarFallback
                  className={
                    isAnonymous
                      ? "bg-gray-300 text-gray-600 font-mono font-bold"
                      : "bg-lime text-black font-mono font-bold"
                  }
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          );
        })}
      </div>
    </div>
  );
}
