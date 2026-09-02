import React, { useState } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { AttendeeMapNode } from "./AttendeeVenueMap";
import { Users, Crown, Search, CheckCircle, XCircle } from "lucide-react";

export function VIPSeatingDashboard({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: nodes, isLoading: isLoadingNodes } = useQuery({
    queryKey: ["map_nodes", eventId],
    queryFn: async () => {
      const { data: mapData } = await supabase
        .from("venue_maps")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!mapData) return [];

      const { data, error } = await supabase
        .from("map_nodes")
        .select("*")
        .eq("map_id", mapData.id)
        .in("type", ["table", "booth"])
        .order("entity_name");

      if (error) throw error;
      return data as AttendeeMapNode[];
    },
  });

  const { data: rsvps, isLoading: isLoadingRsvps } = useQuery({
    queryKey: ["event_rsvps_assigned", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select(
          "id, status, assigned_map_node_id, profiles(first_name, last_name, avatar_url), ticket_tier_id",
        )
        .eq("event_id", eventId)
        .not("assigned_map_node_id", "is", null);

      if (error) throw error;
      return data;
    },
  });

  if (isLoadingNodes || isLoadingRsvps) {
    return <div className="p-4 font-mono">Loading VIP Seating Data...</div>;
  }

  const seatingMap = new Map<string, any[]>();
  rsvps?.forEach((rsvp) => {
    if (!rsvp.assigned_map_node_id) return;
    if (!seatingMap.has(rsvp.assigned_map_node_id)) {
      seatingMap.set(rsvp.assigned_map_node_id, []);
    }
    seatingMap.get(rsvp.assigned_map_node_id)!.push(rsvp);
  });

  const filteredNodes = nodes?.filter(
    (node) =>
      node.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.required_ticket_tier_id ? "vip" : "ga").includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 bg-white p-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            VIP & GA Seating Manager
          </h2>
          <p className="font-mono text-sm text-gray-600 mt-1">
            Monitor table assignments and VIP allocations across your venue layout.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search tables..."
            className="w-full pl-9 pr-3 py-2 border-2 border-black focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNodes?.map((node) => {
          const assignedAttendees = seatingMap.get(node.id) || [];
          const isVip = !!node.required_ticket_tier_id;

          return (
            <div
              key={node.id}
              className={`border-2 border-black flex flex-col ${isVip ? "bg-amber-50 shadow-[4px_4px_0_0_#d97706]" : "bg-gray-50 shadow-[4px_4px_0_0_#000]"}`}
            >
              <div
                className={`p-3 border-b-2 border-black flex items-center justify-between ${isVip ? "bg-amber-200" : "bg-gray-200"}`}
              >
                <div className="flex items-center gap-2">
                  {isVip && <Crown className="w-4 h-4 text-amber-700" />}
                  <h3 className="font-mono font-bold uppercase truncate max-w-[150px]">
                    {node.entity_name || `Unnamed ${node.type}`}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-1 border border-black ${isVip ? "bg-amber-400 text-black" : "bg-white text-gray-600"}`}
                >
                  {isVip ? "VIP TABLE" : "GA TABLE"}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-mono text-gray-700">
                  <Users className="w-4 h-4" />
                  <span>{assignedAttendees.length} Assigned Attendees</span>
                </div>

                {assignedAttendees.length > 0 ? (
                  <ul className="flex flex-col gap-2 mt-2">
                    {assignedAttendees.map((rsvp) => (
                      <li
                        key={rsvp.id}
                        className="flex items-center gap-2 bg-white p-2 border border-gray-300"
                      >
                        {rsvp.profiles?.avatar_url ? (
                          <img
                            src={rsvp.profiles.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full border border-black"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 border border-black flex items-center justify-center">
                            <span className="text-[8px] font-bold">?</span>
                          </div>
                        )}
                        <span className="font-mono text-xs font-semibold truncate flex-1">
                          {rsvp.profiles?.first_name} {rsvp.profiles?.last_name}
                        </span>
                        {rsvp.ticket_tier_id === node.required_ticket_tier_id ? (
                          <span title="Valid Ticket">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          </span>
                        ) : isVip ? (
                          <span title="Missing VIP Ticket">
                            <XCircle className="w-3 h-3 text-red-500" />
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 mt-2 bg-white/50">
                    <span className="font-mono text-xs text-gray-500 p-4 text-center">
                      No attendees assigned to this table.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredNodes?.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
            <Search className="w-8 h-8 text-gray-400 mb-3" />
            <h3 className="font-display font-bold text-xl uppercase">No Tables Found</h3>
            <p className="font-mono text-sm text-gray-500 mt-2">Try adjusting your search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
