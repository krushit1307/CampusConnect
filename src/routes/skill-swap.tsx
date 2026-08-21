import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Sparkles, MessageSquare, Check, X, ShieldAlert, BookOpen, HeartHandshake, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SkillSwapMarketplace() {
  const supabase = createClient();
  const [offering, setOffering] = useState("");
  const [requesting, setRequesting] = useState("");

  // 1. Fetch user session
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-for-swaps"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  // 2. Fetch all swap requests (to show global directory of what's available)
  const { data: allSwaps = [], isLoading: isSwapsLoading, refetch: refetchSwaps } = useQuery({
    queryKey: ["all-skill-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_swaps")
        .select(`
          *,
          profile:profiles (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // 3. Fetch current user matches
  const { data: matches = [], isLoading: isMatchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ["user-skill-matches", userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      const { data, error } = await supabase
        .from("skill_swap_matches")
        .select(`
          *,
          user_a:profiles!skill_swap_matches_user_a_id_fkey (first_name, last_name, handle),
          user_b:profiles!skill_swap_matches_user_b_id_fkey (first_name, last_name, handle)
        `)
        .or(`user_a_id.eq.${userProfile.id},user_b_id.eq.${userProfile.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userProfile?.id
  });

  // Mutations
  const createSwapMutation = useMutation({
    mutationFn: async () => {
      if (!userProfile?.id) throw new Error("Must be logged in.");
      if (!offering.trim() || !requesting.trim()) throw new Error("Both skills are required.");

      const { data, error } = await supabase
        .from("skill_swaps")
        .insert({
          user_id: userProfile.id,
          offering_skill: offering.trim(),
          requesting_skill: requesting.trim()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Skill swap request posted! Matching engine is scanning...");
      setOffering("");
      setRequesting("");
      refetchSwaps();
      refetchMatches();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to post swap.");
    }
  });

  const deleteSwapMutation = useMutation({
    mutationFn: async (swapId: string) => {
      const { error } = await supabase
        .from("skill_swaps")
        .delete()
        .eq("id", swapId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing removed.");
      refetchSwaps();
      refetchMatches();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove listing.");
    }
  });

  const acceptMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("accept_skill_swap_match", {
        p_match_id: matchId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match accepted!");
      refetchMatches();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to accept match.");
    }
  });

  const rejectMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("reject_skill_swap_match", {
        p_match_id: matchId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match declined.");
      refetchMatches();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to decline match.");
    }
  });

  const mySwaps = allSwaps.filter((s: any) => s.user_id === userProfile?.id);
  const otherSwaps = allSwaps.filter((s: any) => s.user_id !== userProfile?.id);

  return (
    <SiteShell>
      {/* Hero Banner */}
      <section className="border-b-2 border-black bg-[#a3e635] px-4 py-14 md:px-6 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow font-bold text-black flex items-center gap-1.5 uppercase font-mono">
                <HeartHandshake className="w-4 h-4" /> Peer-to-Peer Learning
              </p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl uppercase">
                Skill Swap Board
              </h1>
              <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-gray-950">
                Post your learning requests, declare what you teach in return, and let our bipartite matching engine connect you with compatible study partners campus-wide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Board Grid */}
      <section className="bg-cream px-4 py-12 md:px-6 min-h-[500px] text-black">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Post Swaps */}
          <div className="space-y-6 lg:col-span-1">
            <div className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] space-y-4">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-indigo-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                List Your Skill Offer
              </h2>
              
              <div className="space-y-3 font-mono text-xs text-gray-700">
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase">What can you teach?</label>
                  <input
                    type="text"
                    placeholder="e.g. Python, Guitar, Chess"
                    value={offering}
                    onChange={(e) => setOffering(e.target.value)}
                    className="neu-border bg-white p-2 font-mono text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase">What do you want to learn?</label>
                  <input
                    type="text"
                    placeholder="e.g. French, Cooking, React"
                    value={requesting}
                    onChange={(e) => setRequesting(e.target.value)}
                    className="neu-border bg-white p-2 font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={() => createSwapMutation.mutate()}
                  disabled={createSwapMutation.isPending || !offering.trim() || !requesting.trim()}
                  className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 w-full rounded-none font-bold uppercase py-3 shadow-[2px_2px_0_0_#000] mt-4 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Post swap offer
                </Button>
              </div>
            </div>

            {/* My Active Listings */}
            <div className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] space-y-4">
              <h3 className="font-display text-base font-bold uppercase">My Active Listings</h3>
              {mySwaps.length > 0 ? (
                <div className="space-y-2 font-mono text-xs">
                  {mySwaps.map((s: any) => (
                    <div key={s.id} className="border border-black p-3 bg-gray-50 flex justify-between items-center">
                      <div>
                        <p><span className="font-bold text-green-700">Offer:</span> {s.offering_skill}</p>
                        <p className="mt-1"><span className="font-bold text-indigo-700">Want:</span> {s.requesting_skill}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteSwapMutation.mutate(s.id)}
                        disabled={deleteSwapMutation.isPending}
                        className="rounded-none border border-black p-1 bg-red-100 hover:bg-red-200 text-red-700 shrink-0 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-xs text-gray-500 italic bg-gray-50 p-4 border border-dashed border-gray-300">
                  You haven't listed any skill swap offers yet.
                </p>
              )}
            </div>
          </div>

          {/* Right panel: Active Matches & Directory */}
          <div className="space-y-8 lg:col-span-2">
            
            {/* Matches Board Section */}
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black uppercase text-black flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-600" />
                Complementary Matches
              </h2>

              {isMatchesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                </div>
              ) : matches.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {matches.map((m: any) => {
                    const isUserA = m.user_a_id === userProfile?.id;
                    const partnerName = isUserA 
                      ? `${m.user_b?.first_name || ""} ${m.user_b?.last_name || ""}`.trim() || "Swap Partner"
                      : `${m.user_a?.first_name || ""} ${m.user_a?.last_name || ""}`.trim() || "Swap Partner";
                    
                    const mySkillText = isUserA ? m.skill_a_to_b : m.skill_b_to_a;
                    const partnerSkillText = isUserA ? m.skill_b_to_a : m.skill_a_to_b;

                    const myAccepted = isUserA ? m.user_a_accepted : m.user_b_accepted;
                    const partnerAccepted = isUserA ? m.user_b_accepted : m.user_a_accepted;

                    return (
                      <div
                        key={m.id}
                        className="neu-border bg-white p-5 shadow-[4px_4px_0_0_#000] space-y-4"
                      >
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div className="font-mono text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                                m.status === "accepted" ? "bg-green-100 border-green-200 text-green-800" :
                                m.status === "rejected" ? "bg-red-100 border-red-200 text-red-800" : "bg-yellow-100 border-yellow-200 text-yellow-800"
                              }`}>
                                {m.status === "accepted" ? "Connected 🤝" : m.status}
                              </span>
                              <span className="text-gray-500 font-bold uppercase">Perfect Bipartite Match</span>
                            </div>
                            <h3 className="text-base font-black text-black uppercase pt-1">
                              Match with {partnerName}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border border-black/10 p-4 font-mono text-xs rounded">
                          <div>
                            <span className="text-gray-400 uppercase font-bold block mb-1">What you teach</span>
                            <p className="text-sm font-bold text-green-800 uppercase">{mySkillText}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 uppercase font-bold block mb-1">What you learn</span>
                            <p className="text-sm font-bold text-indigo-800 uppercase">{partnerSkillText}</p>
                          </div>
                        </div>

                        {m.status === "matched" && (
                          <div className="flex items-center justify-between gap-4 pt-2">
                            <div className="font-mono text-[10px] text-gray-500">
                              {myAccepted ? "Awaiting partner..." : "Action required to connect"}
                            </div>
                            <div className="flex gap-2">
                              {!myAccepted && (
                                <>
                                  <Button
                                    onClick={() => acceptMatchMutation.mutate(m.id)}
                                    disabled={acceptMatchMutation.isPending}
                                    className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-bold uppercase rounded-none text-xs"
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" /> Accept
                                  </Button>
                                  <Button
                                    onClick={() => rejectMatchMutation.mutate(m.id)}
                                    disabled={rejectMatchMutation.isPending}
                                    variant="destructive"
                                    className="neu-border bg-red-500 text-white hover:bg-red-600 font-bold uppercase rounded-none text-xs"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {m.status === "accepted" && (
                          <div className="pt-2">
                            <Link
                              to="/messages"
                              className="neu-border bg-indigo-600 text-white hover:bg-indigo-500 px-4 py-2 font-mono text-xs font-bold uppercase rounded-none shadow-[2px_2px_0_0_#000] inline-flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Direct Message {partnerName}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="neu-border bg-white p-8 text-center shadow-[4px_4px_0_0_#000] italic font-mono text-sm text-gray-500">
                  No compatible skill pairings detected yet. Keep posting swap offers!
                </div>
              )}
            </div>

            {/* Global Swap Listings Directory */}
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-black uppercase text-black">
                Directory Board
              </h2>

              {isSwapsLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : otherSwaps.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {otherSwaps.map((s: any) => (
                    <div
                      key={s.id}
                      className="neu-border bg-white p-4 shadow-[4px_4px_0_0_#000] font-mono text-xs space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center text-gray-400 font-bold text-[10px] uppercase mb-1">
                          <span>Listing</span>
                          <span>{s.profile?.first_name || "A Student"}</span>
                        </div>
                        <p><span className="font-bold text-indigo-700">Wants to learn:</span> {s.requesting_skill}</p>
                        <p className="mt-1"><span className="font-bold text-green-700">Offers in return:</span> {s.offering_skill}</p>
                      </div>
                      
                      <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] text-gray-500">
                        <span>Posted {new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="neu-border bg-white p-8 text-center shadow-[4px_4px_0_0_#000] italic font-mono text-sm text-gray-500">
                  No other active listings found on the network.
                </div>
              )}
            </div>

          </div>

        </div>
      </section>
    </SiteShell>
  );
}
