import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { SiteShell } from "@/components/site/SiteShell";
import Search from "lucide-react/dist/esm/icons/search";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Filter from "lucide-react/dist/esm/icons/filter";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileSkillData {
  id: string;
  full_name: string;
  handle: string;
  avatar_url: string | null;
  college: string | null;
  bio: string | null;
  offered: string[];
  needed: string[];
}

interface MatchResult {
  matched_user_id: string;
  full_name: string;
  handle: string;
  avatar_url: string | null;
  skills_they_offer_i_need: string[];
  skills_i_offer_they_need: string[];
  match_score: number;
}

export default function SkillsBoard() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "matches">("board");
  
  const [selectedOfferFilter, setSelectedOfferFilter] = useState<string>("");
  const [selectedNeedFilter, setSelectedNeedFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user);
    });
  }, [supabase]);

  const { data: taxonomy = [] } = useQuery({
    queryKey: ["skills_taxonomy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills_taxonomy")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery<ProfileSkillData[]>({
    queryKey: ["skill_swap_profiles"],
    queryFn: async () => {
      const [profilesRes, offeredRes, neededRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, handle, avatar_url, college, bio"),
        supabase.from("user_offered_skills").select("user_id, skills_taxonomy (name)"),
        supabase.from("user_needed_skills").select("user_id, skills_taxonomy (name)"),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const offeredMap: Record<string, string[]> = {};
      (offeredRes.data || []).forEach((row: any) => {
        const uid = row.user_id;
        const name = row.skills_taxonomy?.name;
        if (name) {
          if (!offeredMap[uid]) offeredMap[uid] = [];
          offeredMap[uid].push(name);
        }
      });

      const neededMap: Record<string, string[]> = {};
      (neededRes.data || []).forEach((row: any) => {
        const uid = row.user_id;
        const name = row.skills_taxonomy?.name;
        if (name) {
          if (!neededMap[uid]) neededMap[uid] = [];
          neededMap[uid].push(name);
        }
      });

      return (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        handle: p.handle,
        avatar_url: p.avatar_url,
        college: p.college,
        bio: p.bio,
        offered: offeredMap[p.id] || [],
        needed: neededMap[p.id] || [],
      }));
    },
  });

  const { data: matches = [], isLoading: isLoadingMatches } = useQuery<MatchResult[]>({
    queryKey: ["skill_swap_matches", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase.rpc("get_skill_swap_matches", {
        p_user_id: currentUser.id,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (currentUser && p.id === currentUser.id) return false;

      if (selectedOfferFilter && !p.offered.includes(selectedOfferFilter)) return false;

      if (selectedNeedFilter && !p.needed.includes(selectedNeedFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.full_name?.toLowerCase().includes(q);
        const handleMatch = p.handle?.toLowerCase().includes(q);
        const bioMatch = p.bio?.toLowerCase().includes(q);
        if (!nameMatch && !handleMatch && !bioMatch) return false;
      }

      return true;
    });
  }, [profiles, currentUser, selectedOfferFilter, selectedNeedFilter, searchQuery]);

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-12 md:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="neu-border bg-[#dff25c] p-8 text-center space-y-4 shadow-[6px_6px_0_0_#000000] border-4 border-black">
            <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-black flex items-center justify-center gap-3">
              Skill Swap Board <Sparkles className="h-8 w-8 text-black fill-black" />
            </h1>
            <p className="font-mono text-sm md:text-base text-black/80 max-w-xl mx-auto">
              Find partners to barter skills on campus. Learn Graphic Design in exchange for tutoring Python, and swap your way to graduation!
            </p>
          </div>

          {currentUser && (
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("board")}
                className={`neu-border font-mono text-sm font-bold uppercase px-6 py-2.5 transition-all border-2 border-black ${
                  activeTab === "board"
                    ? "bg-black text-cream shadow-none translate-x-0.5 translate-y-0.5"
                    : "bg-white text-black shadow-[3px_3px_0_0_#000000] hover:-translate-y-0.5"
                }`}
              >
                All Offers & Needs
              </button>
              <button
                onClick={() => setActiveTab("matches")}
                className={`neu-border font-mono text-sm font-bold uppercase px-6 py-2.5 transition-all border-2 border-black flex items-center gap-2 ${
                  activeTab === "matches"
                    ? "bg-black text-cream shadow-none translate-x-0.5 translate-y-0.5"
                    : "bg-white text-black shadow-[3px_3px_0_0_#000000] hover:-translate-y-0.5"
                }`}
              >
                Smart Matches ✨
              </button>
            </div>
          )}

          {activeTab === "board" ? (
            <div className="space-y-6">
              <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000000] space-y-4 border-4 border-black">
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-black border-b-2 border-black pb-2">
                  <Filter size={18} /> Filters
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search name, bio..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 font-mono text-xs font-bold border-2 border-black focus:outline-none focus:bg-lime/20"
                    />
                  </div>

                  <select
                    value={selectedOfferFilter}
                    onChange={(e) => setSelectedOfferFilter(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono text-xs font-bold border-2 border-black focus:outline-none focus:bg-lime/20 bg-white"
                  >
                    <option value="">Offers: Any Skill</option>
                    {taxonomy.map((skill) => (
                      <option key={skill.id} value={skill.name}>
                        Offers: {skill.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedNeedFilter}
                    onChange={(e) => setSelectedNeedFilter(e.target.value)}
                    className="w-full px-3 py-2.5 font-mono text-xs font-bold border-2 border-black focus:outline-none focus:bg-lime/20 bg-white"
                  >
                    <option value="">Needs: Any Skill</option>
                    {taxonomy.map((skill) => (
                      <option key={skill.id} value={skill.name}>
                        Needs: {skill.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoadingProfiles ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-black" />
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="neu-border bg-white p-12 text-center shadow-[6px_6px_0_0_#000000] border-4 border-black">
                  <p className="font-mono text-sm text-gray-500 uppercase tracking-widest">No matching student skills found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AnimatePresence>
                    {filteredProfiles.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000000] flex flex-col justify-between border-4 border-black"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-black rounded-full">
                              <AvatarImage src={p.avatar_url || undefined} className="object-cover" />
                              <AvatarFallback className="bg-[#fb923c] text-white font-bold font-mono">
                                {p.full_name ? p.full_name[0].toUpperCase() : "S"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link to={`/profile/${p.handle}`} className="font-display text-lg font-bold hover:underline text-black">
                                {p.full_name}
                              </Link>
                              <p className="font-mono text-xs text-gray-600">@{p.handle}</p>
                            </div>
                          </div>

                          {p.bio && <p className="font-mono text-xs text-gray-700 line-clamp-3">{p.bio}</p>}

                          <div className="space-y-2">
                            {p.offered.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="font-mono text-[10px] font-bold text-gray-500 uppercase mr-1">Offers:</span>
                                {p.offered.map((sk) => (
                                  <span key={sk} className="neu-border bg-lime px-2 py-0.5 font-mono text-[10px] font-bold text-black border-2 border-black">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            )}
                            {p.needed.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="font-mono text-[10px] font-bold text-gray-500 uppercase mr-1">Needs:</span>
                                {p.needed.map((sk) => (
                                  <span key={sk} className="neu-border bg-[#fb923c] px-2 py-0.5 font-mono text-[10px] font-bold text-black border-2 border-black">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {currentUser && (
                          <div className="pt-4 flex justify-end">
                            <Link
                              to={`/messages?to=${p.id}&text=${encodeURIComponent(
                                `Hi ${p.full_name}!\n\nI saw on the Skill Board that you offer [${p.offered.join(
                                  ", "
                                )}] and need [${p.needed.join(
                                  ", "
                                )}]. Would you like to swap skills?`
                              )}`}
                              className="neu-border neu-press inline-flex items-center gap-1.5 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream border-2 border-black"
                            >
                              Propose Swap <ArrowRight size={12} />
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {isLoadingMatches ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-black" />
                </div>
              ) : matches.length === 0 ? (
                <div className="neu-border bg-white p-12 text-center shadow-[6px_6px_0_0_#000000] border-4 border-black">
                  <p className="font-mono text-sm text-gray-500 uppercase tracking-widest">No complimentary matches found.</p>
                  <p className="font-mono text-xs text-gray-400 mt-2">Add more skills you Offer/Need in Settings to get matched!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {matches.map((m) => (
                    <div
                      key={m.matched_user_id}
                      className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000000] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-4 border-black"
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border-2 border-black rounded-full shrink-0">
                          <AvatarImage src={m.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-lime text-black font-bold font-mono">
                            {m.full_name ? m.full_name[0].toUpperCase() : "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <div>
                            <Link to={`/profile/${m.handle}`} className="font-display text-lg font-bold hover:underline text-black">
                              {m.full_name}
                            </Link>
                            <p className="font-mono text-xs text-gray-600">@{m.handle}</p>
                          </div>

                          <div className="space-y-1 font-mono text-xs">
                            {m.skills_they_offer_i_need.length > 0 && (
                              <p className="text-gray-700">
                                🌟 They can teach you:{" "}
                                <strong className="text-black bg-lime/20 px-1 border border-black">{m.skills_they_offer_i_need.join(", ")}</strong>
                              </p>
                            )}
                            {m.skills_i_offer_they_need.length > 0 && (
                              <p className="text-gray-700">
                                🤝 You can teach them:{" "}
                                <strong className="text-black bg-orange/10 px-1 border border-black">{m.skills_i_offer_they_need.join(", ")}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/messages?to=${m.matched_user_id}&text=${encodeURIComponent(
                          `Hi ${m.full_name}!\n\nI matched with you on the Skill Board! I saw that you can teach [${m.skills_they_offer_i_need.join(
                            ", "
                          )}] and you need help with [${m.skills_i_offer_they_need.join(
                            ", "
                          )}].\n\nWould you like to barter skills?`
                        )}`}
                        className="neu-border neu-press inline-flex items-center gap-1.5 bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream self-end md:self-auto border-2 border-black"
                      >
                        Barter Skills <ArrowRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
