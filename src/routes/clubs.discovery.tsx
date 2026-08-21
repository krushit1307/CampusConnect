import React, { useEffect, useState, useCallback } from "react";
import {
  createClient,
  SupabaseClient,
} from "@/lib/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FlipCard } from "@/components/ui/FlipCard";
import { LazyImage } from "@/components/ui/LazyImage";
import { OrganicSkeleton, TextSkeleton } from "@/components/ui/OrganicSkeleton";
import { ClubCardSkeleton } from "@/components/ui/ClubCardSkeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@/hooks/useReactQueryReplacement";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Calendar } from "lucide-react/dist/esm/icons/calendar";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  category: string | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

interface UserProfile {
  major: string | null;
}

const SWIPE_THRESHOLD = 80;
const PREFETCH_COUNT = 3;

export default function ClubDiscovery() {
  const supabase = createClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Session
  const { data: session, error: sessionError } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    enabled: true,
  });

  const userId = session?.user?.id;

  // User profile (major)
  const { data: profile, error: profileError } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("major")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-red-600">Failed to load user profile.</p>
      </div>
    );
  }

  // Fetch all approved clubs
  const { data: allClubs, error: clubsError } = useQuery({
    queryKey: ["all-clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select(
          `
          id, name, slug, description, banner_url, logo_url, category
        `
        )
        .eq("status", "approved")
        .neq("lifecycle_status", "hibernated")
        .neq("lifecycle_status", "decertified");
      if (error) throw error;
      return (data || []) as Club[];
    },
    staleTime: 1000 * 60 * 5,
  });

  if (clubsError) throw clubsError;

  // Fetch user's club subscriptions (for exclusion)
  const { data: subscriptions, error: subError } = useQuery({
    queryKey: ["user-subscriptions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("club_subscriptions")
        .select("club_id")
        .eq("user_id", userId)
        .eq("notify_events", true);
      if (error) throw error;
      return data.map((r: any) => r.club_id);
    },
    enabled: !!userId,
  });

  const subscribedClubIds = new Set(subscriptions || []);

  // Compute "this week" boundaries
  const now = new Date();
  const day = now.getDay();
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (day === 0 ? -1 : day) + 1,
    0,
    0,
    0,
    0
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Rank clubs: major match > this-week events > randomized remaining
  const [rankedClubs, setRankedClubs] = useState<Club[]>([]);

  useEffect(() => {
    if (!allClubs) {
      setRankedClubs([]);
      return;
    }

    const major = profile?.major;

    let majorMatching: Club[] = [];
    let remaining: Club[] = [];

    if (major && major.length > 0) {
      // Major matching mode: clubs matching user's major first
      allClubs.forEach((club) => {
        if (subscribedClubIds.has(club.id)) return;

        const categoryMatches =
          club.category?.toLowerCase() === major.toLowerCase();

        if (categoryMatches) {
          majorMatching.push(club);
        } else {
          remaining.push(club);
        }
      });
    } else {
      // No major: all clubs are "remaining"
      remaining = allClubs.filter((club) => !subscribedClubIds.has(club.id));
    }

    // Fetch events for remaining clubs to check "this week"
    if (remaining.length > 0) {
      const clubIds = remaining.map((c) => c.id);

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(
          `
          id, title, event_date, club_id
        `
        )
        .in("club_id", clubIds);

      if (eventsError) throw eventsError;

      const eventClubs = new Map<string, Event[]>();
      (events || []).forEach((e: any) => {
        const eventDate = new Date(e.event_date);
        const inWeek =
          eventDate >= weekStart && eventDate < weekEnd;
        if (!eventClubs.has(e.club_id)) eventClubs.set(e.club_id, []);
        if (inWeek) {
          eventClubs.get(e.club_id)!.push({
            id: e.id,
            title: e.title,
            event_date: e.event_date,
            location: e.location,
          });
        }
      });

      // Mark clubs with events this week
      remaining.forEach((club) => {
        const evts = eventClubs.get(club.id) || [];
        if (evts.length > 0) {
          ;(club as any).hasEventThisWeek = true;
        } else {
          ;(club as any).hasEventThisWeek = false;
        }
      });
    }

    // Split remaining into event-this-week and non-event clubs
    const eventThisWeek: Club[] = [];
    const remainingAfterEvents: Club[] = [];

    remaining.forEach((club) => {
      if ((club as any).hasEventThisWeek) {
        eventThisWeek.push(club);
      } else {
        remainingAfterEvents.push(club);
      }
    });

    // Shuffle each group once
    const shuffledEventThisWeek = [...eventThisWeek].sort(() => Math.random() - 0.5);
    const shuffledRemainingAfterEvents = [...remainingAfterEvents].sort(() => Math.random() - 0.5);

    setRankedClubs(
      majorMatching.length > 0
        ? [...majorMatching, ...shuffledEventThisWeek, ...shuffledRemainingAfterEvents]
        : [...shuffledEventThisWeek, ...shuffledRemainingAfterEvents]
    );
  }, [allClubs, profile, subscribedClubIds, weekStart, weekEnd]);

  // Image preload for next 3 cards
  useEffect(() => {
    if (rankedClubs.length === 0) return;

    const nextIndices = [1, 2, 3].filter((i) => i < rankedClubs.length);

    nextIndices.forEach((idx) => {
      const club = rankedClubs[idx];
      if (club?.banner_url) {
        const img = new Image();
        img.src = club.banner_url;
      }
      if (club?.logo_url) {
        const img = new Image();
        img.src = club.logo_url;
      }
    });
  }, [rankedClubs]);

  // State
  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );
  const [isUndoing, setIsUndoing] = useState(false);
  const [showExhaustion, setShowExhaustion] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentClub = rankedClubs[activeIndex];

// Mutation for subscribing (INSERT) on RIGHT swipe
  const subscribeMutation = useMutation({
    mutationFn: async (clubId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("club_subscriptions")
        .insert({
          user_id: userId,
          club_id: clubId,
          notify_events: true,
          notify_announcements: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["user-subscriptions"]);
    },
    onError: () => {
      toast.error("Failed to subscribe to club.");
    },
  });

  // Mutation for unsubscribing (DELETE) on undo
  const unsubscribeMutation = useMutation({
    mutationFn: async (clubId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("club_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("club_id", clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["user-subscriptions"]);
    },
    onError: () => {
      toast.error("Failed to unsubscribe from club.");
    },
  });

  // Handle exhaustion when reaching the last club
  useEffect(() => {
    if (activeIndex >= rankedClubs.length - 1 && rankedClubs.length > 0) {
      const timeout = setTimeout(() => {
        setShowExhaustion(true);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeIndex, rankedClubs.length]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p>Please log in to discover clubs.</p>
      </div>
    );
  }

  if (showExhaustion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-8">
        <Sparkles className="h-24 w-24 text-yellow-500 mb-6 animate-pulse" />
        <h2 className="text-4xl font-bold uppercase tracking-widest text-black mb-4">
          🎉 You've seen them all!
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          No more clubs to discover. Check out your personalized feed!
        </p>
        <button
          onClick={() => navigate("/feed")}
          className="font-mono text-xs font-bold uppercase border-2 border-black rounded-none bg-black text-white px-6 py-3 hover:bg-gray-800 transition-all"
        >
          Go to Feed →
        </button>
      </div>
    );
  }

  if (!currentClub) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <ClubCardSkeleton size="lg" />
        <div className="mt-6">
          <OrganicSkeleton width="200px" height="h-6" seed="club-title" />
          <OrganicSkeleton width="100px" height="h-4" seed="club-desc" />
        </div>
      </div>
    );
  }

  // Handle swipe end - animate card away and take action
  const handleSwipeEnd = useCallback(
    async (direction: "left" | "right") => {
      if (isUndoing) return;

      setSwipeDirection(direction);

      // Animate card away
      const card = document.querySelector(
        `.discovery-card[data-index="${activeIndex}"]`
      ) as HTMLElement;
      if (card) {
        if (direction === "right") {
          card.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
          card.style.transform = "translateX(100%) rotate(-10deg)";
          card.style.opacity = "0";
        } else {
          card.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
          card.style.transform = "translateX(-100%) rotate(10deg)";
          card.style.opacity = "0";
        }
      }

      // Perform action after animation
      setTimeout(() => {
        if (direction === "right" && userId) {
          // Subscribe to club using existing club_subscriptions mechanism
          subscribeMutation.mutate(clubId: string);
        } else if (direction === "left" && userId) {
          // No database mutation for left swipe (skip)
        }

        // Move to next card
        if (activeIndex + 1 < rankedClubs.length) {
          setActiveIndex((prev) => prev + 1);
        } else {
          setShowExhaustion(true);
        }

        setSwipeDirection(null);
      }, 300);
    },
    [activeIndex, rankedClubs, userId, subscribeMutation]
  );

  // Handle undo
  const handleUndo = useCallback(() => {
    if (isUndoing) return;
    setIsUndoing(true);

    if (swipeDirection === "right") {
      // Remove the subscription for the club that was swiped right
      unsubscribeMutation.mutate(currentClub.id);
    } else if (swipeDirection === "left") {
      // Restore the skipped club - go back to previous card
      if (activeIndex > 0) {
        setActiveIndex((prev) => prev - 1);
      }
    }

    setTimeout(() => {
      setIsUndoing(false);
    }, 300);
  }, [currentClub.id, isUndoing, swipeDirection]);

  // Drag gesture state
  const [dragStartX, setDragStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isUndoing) return;
      setIsDragging(true);
      const startX =
        e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      setDragStartX(startX);
      setDragDeltaX(0);
    },
    [isUndoing]
  );

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging || isUndoing) return;
      const currentX =
        e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      const delta = currentX - dragStartX;
      setDragDeltaX(delta);
    },
    [isDragging, isUndoing, dragStartX]
  );

  const handleDragEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging || isUndoing) return;
      setIsDragging(false);

      const delta = dragDeltaX;
      const direction = delta > SWIPE_THRESHOLD ? "right" : delta < -SWIPE_THRESHOLD ? "left" : null;

      if (direction) {
        handleSwipeEnd(direction);
      } else {
        // Snap back
        setDragDeltaX(0);
      }
    },
    [isDragging, isUndoing, SWIPE_THRESHOLD, handleSwipeEnd]
  );

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", () => {});
      document.removeEventListener("mouseup", () => {});
      document.removeEventListener("touchmove", () => {});
      document.removeEventListener("touchend", () => {});
    };
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p>Please log in to discover clubs.</p>
      </div>
    );
  }

  if (showExhaustion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-8">
        <Sparkles className="h-24 w-24 text-yellow-500 mb-6 animate-pulse" />
        <h2 className="text-4xl font-bold uppercase tracking-widest text-black mb-4">
          🎉 You've seen them all!
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          No more clubs to discover. Check out your personalized feed!
        </p>
        <button
          onClick={() => navigate("/feed")}
          className="font-mono text-xs font-bold uppercase border-2 border-black rounded-none bg-black text-white px-6 py-3 hover:bg-gray-800 transition-all"
        >
          Go to Feed →
        </button>
      </div>
    );
  }

  if (!currentClub) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <ClubCardSkeleton size="lg" />
        <div className="mt-6">
          <OrganicSkeleton width="200px" height="h-6" seed="club-title" />
          <OrganicSkeleton width="100px" height="h-4" seed="club-desc" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-black">
            Club Discovery
          </h1>
          {userId && profile.major ? (
            <p className="text-sm text-gray-500">
              Discover clubs matching your {profile.major} major
            </p>
          ) : (
            <p className="text-sm text-gray-500">Discover niche clubs</p>
          )}
        </div>

        {/* Card Stack */}
        {showExhaustion || rankedClubs.length === 0 ? (
          showExhaustion && rankedClubs.length === 0 ? (
            <div className="text-center my-12">
              <Sparkles className="h-12 w-12 text-yellow-500 mb-2 animate-pulse" />
              <h2 className="text-3xl font-bold uppercase tracking-widest text-black">
                🎉 You've seen them all!
              </h2>
              <p className="text-gray-600">No more clubs to discover.</p>
              <button
                onClick={() => navigate("/feed")}
                className="font-mono text-xs font-bold uppercase border-2 border-black rounded-none bg-black text-white px-6 py-3 hover:bg-gray-800 transition-all mt-4"
              >
                Go to Feed →
              </button>
            </div>
          ) : (
            <div>
              <EmptyState
                illustrationType="no-results"
                title="No clubs available"
                description="There are no clubs to discover at this time."
              />
            </div>
          ))
        } : (
          <div className="relative overflow-hidden space-y-2">
            {rankedClubs.map((club, i) => {
              const isActive = i === activeIndex;

              return (
                <motion.div
                  key={club.id}
                  data-testid={`discovery-card-${club.id}`}
                  data-index={i}
                  className={cn(
                    "discovery-card neu-border flex flex-col items-center justify-between bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all duration-300",
                    isActive && "z-10",
                    isActive && !swipeDirection ? "scale-100" : "scale-98"
                  )}
                  style={{ transition: "transform 0.2s ease" }}
                >
                  <div className="relative w-full h-64 mb-4">
                    {/* Banner image */}
                    <LazyImage
                      src={club.banner_url}
                      alt={club.name}
                      className="w-full h-full object-cover rounded-t-md"
                      loading="lazy"
                    />
                    {/* Logo */}
                    <LazyImage
                      src={club.logo_url}
                      alt={`${club.name} logo`}
                      className="absolute -top-2 -right-2 w-12 h-12 rounded-full object-cover border-2 border-black"
                      loading="lazy"
                    />
                    {/* Flip card wrapper */}
                    <FlipCard
                      ariaLabel={`View ${club.name} details`}
                      isFlipped={isFlipped}
                      onFlip={() => setIsFlipped((f) => !f)}
                    >
                      {/* Front face */}
                      <div className="relative w-full h-full rounded-t-md overflow-hidden">
                        <div className="absolute bottom-4 left-4 right-4">
                          <h2 className="text-xl font-bold font-display text-black mb-1">
                            {club.name}
                          </h2>
                          {club.description && (
                            <p className="text-sm text-gray-600 line-clamp-1">
                              {club.description.split(".")[0] + "."}
                            </p>
                          )}
                        </div>

                        {/* Category badge */}
                        {club.category && (
                          <div className="absolute top-4 left-4">
                            <span className="club-logo-badge border-2 border-black px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                              {club.category}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Back face */}
                      <div className="absolute inset-0 p-6">
                        <h3 className="font-bold text-lg uppercase tracking-wider text-black mb-4">
                          {club.name}
                        </h3>
                        <p className="text-gray-600 mb-4 line-clamp-3">
                          {club.description || "No description provided."}
                        </p>

                        {/* Upcoming events when flipped */}
                        {isFlipped && (
                          <>
                            {club.hasEventThisWeek ? (
                              <p className="text-sm text-gray-500 mb-2">
                                🎉 Has an event this week!
                              </p>
                            ) : (
                              <p className="text-gray-500 text-sm mb-2">
                                No events this week
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              {club.description || "No description available."}
                            </p>
                          </>
                        )}
                      </div>
                    </FlipCard>
                  </div>

                  {/* Swipe area */}
                  <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleDragStart}
                    onMouseDown={handleDragStart}
                    onTouchMove={handleDragMove}
                    onMouseMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseUp={handleDragEnd}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Undo control */}
          {swipeDirection && !isUndoing && activeIndex < rankedClubs.length - 1 && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleUndo}
                disabled={isUndoing}
                className="font-mono text-xs font-bold uppercase border-2 border-black rounded-none bg-white hover:bg-gray-100 text-black px-4 py-2 transition-all"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Undo
              </button>
              <span className="text-sm text-gray-500">
                {swipeDirection === "right"
                  ? "Subscription removed"
                  : "Club restored"}
              </span>
            </div>
          )}
        )}

        {/* Exhaustion state already handled above */}
      </div>
    </div>
  );
}