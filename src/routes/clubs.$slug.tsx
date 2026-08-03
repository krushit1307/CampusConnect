import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
import { useBreadcrumbs } from "@/components/BreadcrumbsContext";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { parse } from "@/lib/markdown";
import type { MarkdownNodeChild, HeadingNode } from "@/lib/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPresenceBadgeClass, usePresence } from "@/hooks/usePresence";
import { ArrowLeft, Github, Loader2, CheckCircle, Flag } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { EmptyState } from "@/components/EmptyState";
import { VideoPlayer } from "@/components/VideoPlayer";
import { AudioReactiveBackground } from "@/components/media/AudioReactiveBackground";
import LazyHydrate from "@/components/LazyHydrate";
import { NotFound } from "@/components/NotFound";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CollaborativeEditor } from "@/components/notes/CollaborativeEditor";
import { createClubProfileQueryOptions } from "@/lib/clubProfileQuery";
import { ClubHeader } from "@/components/Clubs/ClubHeader";
import { ClubJobsSection } from "@/components/Clubs/ClubJobsSection";

interface ClubMemberProfile {
  full_name: string;
  avatar_url: string | null;
  handle: string;
}

interface ClubMember {
  id: string;
  role: string;
  status: string;
  user_id: string;
  profiles: ClubMemberProfile | ClubMemberProfile[];
}

interface ClubEvent {
  id: string;
  title: string;
  event_date: string | null;
}

interface MemberItem {
  name: string;
  handle: string;
  role: "admin" | "member" | "organizer" | "alumni";
  avatarUrl: string | null;
  userId: string;
}

// Small building block for the skeleton below. Deliberately a plain div
// (not the shared ui/skeleton component) to keep this change self-contained.
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-none bg-black/10 ${className}`} />;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (typeof children === "object" && "props" in children) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

function extractAstText(children: MarkdownNodeChild[]): string {
  return children
    .map((child) => (typeof child === "string" ? child : extractAstText(child.children ?? [])))
    .join("");
}

// Mimics the club header + events/members layout below while data is fetched
// from Supabase, so navigating to a club doesn't flash an empty/blank page.
function ClubProfileSkeletonContent() {
  return (
    <>
      <section className="border-b-2 border-black px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Bone className="h-4 w-16" />
          <Bone className="mt-3 h-12 w-2/3 max-w-md md:h-16" />
          <Bone className="mt-4 h-4 w-full max-w-xl" />
          <Bone className="mt-2 h-4 w-2/3 max-w-md" />

          {/* Members list skeleton loader */}
          <div className="mt-8 max-w-2xl">
            <Bone className="h-6 w-24 mb-3" />
            <Bone className="h-4 w-32 mb-2" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="neu-border bg-white flex items-center gap-3 p-3">
                  <Bone className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1">
                    <Bone className="h-4 w-2/3" />
                  </div>
                  <Bone className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Bone className="h-9 w-32" />
            <Bone className="h-9 w-24" />
          </div>
        </div>
      </section>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="neu-border bg-white p-6">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold text-indigo-900">
              Upcoming events
            </h2>
            <div className="divide-y-2 divide-black">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <Bone className="h-9 w-14" />
                  <Bone className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ClubProfileSkeleton() {
  return (
    <SiteShell>
      <ClubProfileSkeletonContent />
    </SiteShell>
  );
}

export default function ClubProfile() {
  const { slug } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const { presenceMap } = usePresence(user?.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isClubBookmarked, setIsClubBookmarked] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const { setLabel } = useBreadcrumbs();

  interface BulkEmailJob {
    id: string;
    club_id: string;
    template_id: string | null;
    status: "pending" | "processing" | "completed" | "failed";
    processed_count: number;
    total_count: number;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  }

  const [latestJob, setLatestJob] = useState<BulkEmailJob | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
  }, [supabase]);

  // Check if this club is already bookmarked
  useEffect(() => {
    if (!user || !club) return;
    supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("club_id", club.id)
      .maybeSingle()
      .then(({ data }) => setIsClubBookmarked(!!data));
  }, [user, club, supabase]);

  const handleClubBookmark = async () => {
    if (!user) return void toast.error("Please sign in first");
    if (!club) return;
    setBookmarkPending(true);
    const next = !isClubBookmarked;
    setIsClubBookmarked(next); // optimistic
    try {
      await toggleBookmark(user.id, "club", club.id, !next);
      toast.success(next ? "Club bookmarked!" : "Bookmark removed.");
    } catch {
      setIsClubBookmarked(!next); // revert
      toast.error("Failed to update bookmark.");
    } finally {
      setBookmarkPending(false);
    }
  };

  const {
    data: club,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...createClubProfileQueryOptions(supabase, slug ?? ""),
    enabled: Boolean(slug),
  });

  useEffect(() => {
    if (club?.name && slug) {
      setLabel(slug, club.name);
    }
  }, [club?.name, slug, setLabel]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user || !club) throw new Error("Must be logged in");
      const isPublic = (club as { visibility?: string }).visibility === "public";
      const { error } = await supabase.from("club_members").insert({
        club_id: club.id,
        user_id: user.id,
        status: isPublic ? "approved" : "pending",
      });
      if (error) throw error;
      return { isPublic };
    },
    onSuccess: ({ isPublic }) => {
      setIsJoinDialogOpen(false);
      setJoinSuccess(true);
      toast.success(isPublic ? "You have joined the club!" : "Join request submitted!");
      refetch();
      if (!isPublic) {
        setTimeout(() => setJoinSuccess(false), 2000);
      }
    },
    onError: () => {
      toast.error("Failed to submit join request. Please try again.");
    },
  });
  const membership =
    user && club && Array.isArray(club.club_members)
      ? club.club_members.find(
          (m: { user_id: string; role: string; status: string }) => m.user_id === user.id,
        )
      : null;
  const isAdmin = membership && (membership.role === "admin" || membership.role === "organizer");

  useEffect(() => {
    if (!isAdmin || !club) return;
    const fetchLatestJob = async () => {
      const { data } = await supabase
        .from("bulk_email_jobs")
        .select("*")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLatestJob(data[0]);
      }
    };
    fetchLatestJob();
  }, [isAdmin, club, supabase]);

  useEffect(() => {
    if (
      !isAdmin ||
      !club ||
      !latestJob ||
      (latestJob.status !== "pending" && latestJob.status !== "processing")
    )
      return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("bulk_email_jobs")
        .select("*")
        .eq("id", latestJob.id)
        .single();
      if (data) {
        setLatestJob(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAdmin, club, latestJob, supabase]);

  const sendNewsletterMutation = useMutation({
    mutationFn: async () => {
      if (!club) throw new Error("Club not loaded");
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { clubId: club.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Newsletter queued successfully!");
      setLatestJob({
        id: data.jobId,
        club_id: club!.id,
        template_id: null,
        status: "pending",
        processed_count: 0,
        total_count: 0,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to trigger newsletter");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !club) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("club_members")
        .delete()
        .match({ club_id: club.id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You have left the club.");
      refetch();
    },
    onError: () => {
      toast.error("Failed to leave club. Please try again.");
    },
  });

  const headings = useMemo(() => {
    if (!club?.description) return [];
    const ast = parse(club.description);
    return ast.children
      .filter((node): node is HeadingNode => node.type === "heading" && node.depth <= 3)
      .map((node) => ({
        id: slugify(extractAstText(node.children)),
        text: extractAstText(node.children),
        depth: node.depth,
      }))
      .filter((h) => h.id);
  }, [club?.description]);

  if (isLoading) return <ClubProfileSkeleton />;
  if (error || !club) return <NotFound />;

  const members = Array.isArray(club.club_members)
    ? club.club_members.filter((m: ClubMember) => m.status === "approved")
    : [];
  const memberList = members.map((m: ClubMember) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      name: profile?.full_name || "Unknown User",
      handle: profile?.handle || "",
      role: m.role as "admin" | "member" | "organizer" | "alumni",
      avatarUrl: profile?.avatar_url || null,
      userId: m.user_id,
    };
  });

  const filteredMembers = memberList.filter((m: MemberItem) => {
    const query = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(query) || m.handle.toLowerCase().includes(query);
  });

  const displayedMembers = isExpanded ? filteredMembers : filteredMembers.slice(0, 10);

  const events = Array.isArray(club.events) ? club.events : [];

  const clubName = club.name || "Club";
  const clubDescription = (
    club.description
      ? club.description.replace(/[#*_`>[\]()~-]/g, "").trim()
      : "Check out this club on CampusConnect."
  ).slice(0, 160);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const copyInvite = async () => {
    const invite = `# ${club.name}

  ${club.description || "Join this club on CampusConnect."}

  Join here: ${currentUrl}`;

    try {
      await navigator.clipboard.writeText(invite);
      toast.success("Markdown invite copied!");
    } catch {
      toast.error("Failed to copy invite.");
    }
  };

  // Renders the primary membership action (Join / Leave / Pending / Joined).
  // Shared by the sticky ClubHeader so the button can shrink alongside the
  // rest of the header once the user scrolls past the threshold.
  const renderJoinAction = (isCompact: boolean) => {
    const sizeClasses = isCompact ? "px-3 py-1.5 text-[10px]" : "px-5 py-2 text-xs";

    if (membership?.status === "approved") {
      return (
        <button
          onClick={() => {
            if (!user) return void toast.error("Please sign in first");
            leaveMutation.mutate();
          }}
          disabled={leaveMutation.isPending}
          className={`neu-border neu-press inline-flex items-center gap-2 bg-gray-200 font-mono font-bold uppercase tracking-wider hover:bg-red-100 disabled:opacity-50 transition-all duration-300 ${sizeClasses}`}
        >
          {leaveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Leave Club
        </button>
      );
    }

    if (membership?.status === "pending") {
      return (
        <button
          disabled
          className={`neu-border font-mono font-bold uppercase tracking-wider bg-gray-300 cursor-not-allowed transition-all duration-300 ${sizeClasses}`}
        >
          Request Pending
        </button>
      );
    }

    if (joinSuccess) {
      return (
        <button
          disabled
          className={`neu-border inline-flex items-center gap-2 bg-lime font-mono font-bold uppercase tracking-wider transition-all duration-300 ${sizeClasses}`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Member ✓
        </button>
      );
    }

    return (
      <AlertDialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            onClick={() => {
              if (!user) return void toast.error("Please sign in first");
              setIsJoinDialogOpen(true);
            }}
            className={`neu-border neu-press inline-flex items-center gap-2 bg-black font-mono font-bold uppercase tracking-wider text-cream transition-all duration-300 ${sizeClasses}`}
          >
            Join Club
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="neu-border bg-white rounded-none p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold">
              Submit join request?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm text-gray-700">
              Do you want to submit a join request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="neu-border rounded-none font-mono text-xs font-bold uppercase bg-white text-black hover:bg-cream">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                joinMutation.mutate();
              }}
              disabled={joinMutation.isPending}
              className="neu-border bg-black text-cream hover:bg-cream hover:text-black rounded-none font-mono text-xs font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2"
            >
              {joinMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {joinMutation.isPending ? "Submitting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <>
      <Helmet>
        <title>{clubName} | CampusConnect</title>
        <meta name="description" content={clubDescription} />

        {/* OpenGraph / Social Embed Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:title" content={clubName} />
        <meta property="og:description" content={clubDescription} />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={clubName} />
        <meta name="twitter:description" content={clubDescription} />
      </Helmet>

      <SiteShell>
        <AnimatePresence mode="sync">
          {isLoading || !club ? (
            <motion.div
              key="club-profile-skeleton"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <ClubProfileSkeletonContent />
            </motion.div>
          ) : (
            <motion.div
              key="club-profile-loaded"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {/* Sticky header: shrinks the massive banner/logo away and pins the
                  club name + Join button to the top as the user scrolls the feed. */}
              <ClubHeader
                clubName={club.name}
                logoInitials={getInitials(club.name)}
                eyebrow={<p className="eyebrow font-bold text-blue-900">Club</p>}
                banner={
                  <AudioReactiveBackground
                    className="h-64 md:h-80 border-2 border-black rounded-lg shadow-xl"
                    defaultPreset="neonPulse"
                    interactive={true}
                  />
                }
                secondaryActions={
                  <>
                    {membership && (
                      <Link
                        to={`/clubs/${club.slug}/tasks`}
                        className="neu-border neu-press bg-brand-blue-base text-white px-5 py-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 inline-block shrink-0 text-center"
                      >
                        Tasks
                      </Link>
                    )}
                    {membership && (
                      <Link
                        to={`/clubs/${club.slug}/notes`}
                        className="neu-border neu-press bg-lime px-5 py-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 inline-block shrink-0 text-center"
                      >
                        Meeting Notes
                      </Link>
                    )}
                    <Link
                      to={`/clubs/${club.slug}/articles`}
                      className="neu-border neu-press bg-peach px-5 py-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 inline-block shrink-0 text-center"
                    >
                      Club News
                    </Link>
                    {membership?.role === "admin" && (
                      <Link
                        to={`/clubs/${club.slug}/manage`}
                        className="neu-border neu-press bg-brand-yellow-base px-5 py-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 inline-block shrink-0 text-center"
                      >
                        Manage Club
                      </Link>
                    )}
                  </>
                }
                actions={renderJoinAction}
              />

              <section className="relative border-b-2 border-black px-4 pb-8 md:px-6 bg-slate-950 overflow-hidden">
                <div className="mx-auto max-w-6xl">
                  <div className="markdown-content mt-4 max-w-2xl font-mono text-sm md:text-base leading-relaxed border-b-2 border-black pb-6">
                    {headings.length > 1 && (
                      <nav
                        className="mb-4 border-2 border-black bg-cream p-4"
                        aria-label="Table of contents"
                      >
                        <p className="font-bold text-xs uppercase tracking-wider mb-2">
                          Table of Contents
                        </p>
                        <ul className="space-y-1">
                          {headings.map((h) => (
                            <li key={h.id} style={{ paddingLeft: (h.depth - 1) * 16 }}>
                              <a
                                href={`#${h.id}`}
                                onClick={(e) => handleTocClick(e, h.id)}
                                className="text-blue-900 underline hover:text-black"
                              >
                                {h.text}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    )}
                    <ReactMarkdown components={mdComponents}>
                      {club.description || ""}
                    </ReactMarkdown>
                  </div>

                  {club.promo_video_url && (
                    <div className="mt-8 max-w-2xl">
                      <h3 className="font-display text-xl font-bold text-indigo-900 uppercase tracking-tight">
                        Featured Club Promo
                      </h3>
                      <div className="neu-border bg-black aspect-video mt-4 overflow-hidden">
                        <LazyHydrate height="360px">
                          <VideoPlayer src={club.promo_video_url} title="Club Promo" />
                        </LazyHydrate>
                      </div>{" "}
                    </div>
                  )}

          {user && membership && membership.status === "approved" && (
            <div className="mt-12 max-w-2xl">
              <h3 className="font-display text-xl font-bold text-indigo-900 uppercase tracking-tight mb-4">
                Collaborative Group Notes
              </h3>
              <div className="neu-border bg-white p-6">
                <CollaborativeEditor
                  groupId={club.id}
                  user={{
                    id: user.id,
                    name: user.user_metadata?.full_name || user.email || "Member",
                  }}
                />
              </div>
            </div>
          )}

                  {/* Members section below the description */}
                  <div className="mt-8 max-w-2xl">
                    <h3 className="font-display text-lg font-bold text-blue-900">Members</h3>
                    <p className="font-mono text-xs text-black mt-1 mb-3">
                      {memberList.length} members total
                    </p>
                    {memberList.length === 0 ? (
                      <EmptyState
                        illustration="no-members"
                        title="No members yet."
                        description="Be the first to join this club and help it grow."
                      />
                    ) : (
                      <>
                        <div className="mb-4">
                          <input
                            type="text"
                            placeholder="Search members by name or handle..."
                            aria-label="Search members by name or handle"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/10"
                          />
                        </div>
                        {filteredMembers.length === 0 ? (
                          <EmptyState
                            illustration="no-results"
                            title="No members match your search."
                          />
                        ) : (
                          <>
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {displayedMembers.map((m: MemberItem, i: number) => (
                                <li
                                  key={m.handle || `${m.name}-${i}`}
                                  className="neu-border bg-white flex items-center gap-3 p-3 font-mono text-sm"
                                >
                                  {m.handle ? (
                                    <Link
                                      to={`/profile/${m.handle}`}
                                      className="relative h-10 w-10 shrink-0"
                                    >
                                      <Avatar className="h-10 w-10 border-2 border-black rounded-full transition-transform hover:scale-105">
                                        <AvatarImage
                                          src={m.avatarUrl || undefined}
                                          alt={m.name}
                                          className="rounded-full"
                                        />
                                        <AvatarFallback className="rounded-full bg-brand-blue-light text-black font-bold">
                                          {getInitials(m.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-white p-0.5">
                                        <span
                                          className={getPresenceBadgeClass(
                                            presenceMap[m.userId]?.status ?? "offline",
                                          )}
                                          aria-hidden="true"
                                        />
                                      </span>
                                    </Link>
                                  ) : (
                                    <div className="relative h-10 w-10 shrink-0">
                                      <Avatar className="h-10 w-10 border-2 border-black rounded-full">
                                        <AvatarImage
                                          src={m.avatarUrl || undefined}
                                          alt={m.name}
                                          className="rounded-full"
                                        />
                                        <AvatarFallback className="rounded-full bg-brand-blue-light text-black font-bold">
                                          {getInitials(m.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-white p-0.5">
                                        <span
                                          className={getPresenceBadgeClass(
                                            presenceMap[m.userId]?.status ?? "offline",
                                          )}
                                          aria-hidden="true"
                                        />
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {m.handle ? (
                                      <Link to={`/profile/${m.handle}`} className="hover:underline">
                                        <p className="font-bold truncate" title={m.name}>
                                          {m.name}
                                        </p>
                                      </Link>
                                    ) : (
                                      <p className="font-bold truncate" title={m.name}>
                                        {m.name}
                                      </p>
                                    )}
                                  </div>
                                  <RoleBadge role={m.role} />
                                </li>
                              ))}
                            </ul>
                            {filteredMembers.length > 10 && (
                              <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="neu-border neu-press mt-4 bg-cream px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-cream transition-colors"
                              >
                                {isExpanded ? "View less" : "View all"}
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={handleClubBookmark}
                      disabled={bookmarkPending}
                      className="neu-border neu-press inline-flex items-center gap-2 bg-white px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-lime disabled:opacity-50"
                    >
                      <Bookmark className="h-3.5 w-3.5" fill={isClubBookmarked ? "black" : "none"} />
                      {isClubBookmarked ? "Bookmarked" : "Bookmark"}
                    </button>
                    <button
                      onClick={() => toast.info("Follow feature coming soon!")}
                      className="neu-border neu-press bg-cream px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider"
                    >
                      Follow
                    </button>
                    <button
                      onClick={() => setIsReportDialogOpen(true)}
                      className="neu-border neu-press bg-white hover:bg-peach px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                    >
                      <Flag size={12} />
                      Report
                    </button>
                    {club.github_repo_url && (
                      <a
                        href={club.github_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neu-border neu-press inline-flex items-center gap-2 bg-white px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-lime/20"
                      >
                        <Github className="h-4 w-4" />
                        GitHub Repo
                      </a>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="neu-border mt-8 border-2 border-black bg-white p-6 dark:bg-zinc-900 dark:border-cream">
                      <h3 className="font-display text-xl font-bold uppercase tracking-tight text-indigo-900 dark:text-indigo-400">
                        Club Newsletter Dispatcher
                      </h3>
                      <p className="mt-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                        Send a bulk announcement/newsletter to all {memberList.length} members. This will be
                        processed asynchronously in the background to prevent server timeouts.
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <button
                          onClick={() => sendNewsletterMutation.mutate()}
                          disabled={sendNewsletterMutation.isPending}
                          className="neu-border neu-press bg-lime px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50"
                        >
                          {sendNewsletterMutation.isPending ? "Queuing..." : "Send Newsletter Now"}
                        </button>

                        {latestJob && (
                          <div className="flex flex-col gap-1 border-l-2 border-black pl-4 font-mono text-xs dark:border-cream">
                            <div>
                              Status:{" "}
                              <span
                                className={`font-bold uppercase ${
                                  latestJob.status === "completed"
                                    ? "text-emerald-600"
                                    : latestJob.status === "failed"
                                      ? "text-rose-600"
                                      : "text-amber-500 animate-pulse"
                                }`}
                              >
                                {latestJob.status}
                              </span>
                            </div>
                            {latestJob.total_count > 0 && (
                              <div>
                                Progress:{" "}
                                <span className="font-bold">
                                  {latestJob.processed_count} / {latestJob.total_count}
                                </span>{" "}
                                emails sent
                              </div>
                            )}
                            {latestJob.error_message && (
                              <div className="text-rose-600 text-[10px]">
                                Error: {latestJob.error_message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="px-4 py-12 md:px-6">
                <div className="mx-auto max-w-6xl">
                  <div className="neu-border bg-white p-6">
                    <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold text-black">
                      Upcoming events
                    </h2>
                    {events.length === 0 ? (
                      <EmptyState
                        illustration="no-events"
                        title="No upcoming events."
                        description="Check back soon — this club hasn't scheduled anything yet."
                      />
                    ) : (
                      <ul className="divide-y-2 divide-black">
                        {events.map((e: ClubEvent) => (
                          <li key={e.id} className="flex items-center gap-4 py-4">
                            <div className="neu-border bg-gray-100 px-3 py-2 font-mono text-xs font-bold text-gray-700">
                              {e.event_date
                                ? new Date(e.event_date)
                                    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                    .toUpperCase()
                                : "TBA"}
                            </div>
                            <p className="flex-1 font-display font-bold">{e.title}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <ReportDialog
                isOpen={isReportDialogOpen}
                onClose={() => setIsReportDialogOpen(false)}
                targetType="club"
                targetId={club.id}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </SiteShell>
    </>
>>>>>>> upstream/main
  );
}
