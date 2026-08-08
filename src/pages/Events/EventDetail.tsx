import { SiteShell } from "@/components/site/SiteShell";
import { PredictiveTurnout } from "@/components/events/PredictiveTurnout";
// import { LiveQA } from "@/components/events/LiveQA";
import { useEventViewerCount } from "@/hooks/useEventViewerCount";
import { incrementEventViews } from "@/lib/supabase/events";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, setQueryData } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, lazy, Suspense, useMemo, useCallback, useRef } from "react";
import { LazyMotion, m } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { uploadFileWithProgress } from "@/lib/supabase/uploadFileWithProgress";
import { useCommand } from "@/components/CommandPaletteProvider";
import { TableOfContents } from "@/components/events/TableOfContents";
import { buildOpenGraphTags } from "@/lib/seo/eventMeta";
import { NotFound } from "@/components/NotFound";
import LazyHydrate from "@/components/LazyHydrate";
import { User } from "@supabase/supabase-js";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { useBreadcrumbs } from "@/components/BreadcrumbsContext";
import { triggerConfetti } from "@/utils/confetti";
// Removed SiteShell import
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { MapSkeleton } from "@/components/ui/MapSkeleton";
import EventFeedbackForm from "@/components/EventFeedbackForm";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const EventMap = lazy(() => import("@/components/EventMap").then((m) => ({ default: m.EventMap })));
import { formatEventDateRange } from "@/lib/utils";
import { loadDomMax } from "@/lib/motionFeatures";
import { downloadIcs, getGoogleCalendarUrl } from "@/lib/calendarUtils";
import { EventCapacityGauge } from "@/components/events/EventCapacityGauge";
import { formatDateLong } from "@/lib/dateFormatter";
import { toast } from "sonner";
import { ShareMenu } from "@/components/ui/ShareMenu";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  MapPin,
  MapPinOff,
  Users,
  X,
  CheckCircle,
  Clock,
  RotateCcw,
  HelpCircle,
  Flag,
  Star,
  Calendar,
  Eye,
} from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { OptimizedImage } from "@/components/media/OptimizedImage";
import { LazyImage } from "@/components/ui/LazyImage";
import { parseCoordinates } from "@/lib/eventUtils";
import {
  buildKanbanColumns,
  buildRsvpStatus,
  buildFeedbackStatus,
  buildWaitlistInfo,
  buildGoogleMapsSearchUrl,
} from "@/lib/eventTransformUtils";
import { isCaptchaConfigured, shouldRequireCaptcha } from "@/lib/captcha";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { ActivePoll } from "@/components/polls/ActivePoll";
import { SteganographicQRScanner } from "@/components/SteganographicQRScanner";
import { CaptchaWidget } from "@/components/CaptchaWidget";
import { SeatingChart } from "@/components/events/SeatingChart";
import { useEventSeats } from "@/hooks/useEventSeats";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { GalleryCarousel, GallerySlide } from "@/components/ui/GalleryCarousel";

interface SimilarEventItem {
  id: string;
  title: string;
  category_id?: string;
  event_date?: string;
  banner_url?: string;
  description?: string;
}

function SimilarEvents({
  currentEventId,
  categoryId,
}: {
  currentEventId: string;
  categoryId?: string;
}) {
  const supabase = createClient();
  const [similarEvents, setSimilarEvents] = useState<SimilarEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    async function fetchSimilarEvents() {
      setLoading(true);
      try {
        // 1. Try pgvector similarity recommendation RPC first
        const { data, error } = await supabase.rpc("recommend_events", {
          p_event_id: currentEventId,
          p_limit: 3,
        });

        if (!error && data && data.length > 0) {
          setSimilarEvents(data as SimilarEventItem[]);
          setLoading(false);
          return;
        }

        // 2. Fallback to category matching if vector embeddings are not calculated yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("events")
          .select("id, title, category_id, event_date, banner_url, description")
          .eq("category_id", categoryId)
          .neq("id", currentEventId)
          .eq("status", "published")
          .limit(3);

        if (fallbackError) {
          console.error("Error fetching fallback similar events:", fallbackError);
        } else if (fallbackData) {
          setSimilarEvents(fallbackData as SimilarEventItem[]);
        }
      } catch (err) {
        console.error("Unexpected error fetching similar events:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSimilarEvents();
  }, [currentEventId, categoryId, supabase]);

  if (loading || similarEvents.length === 0) {
    return null;
  }
  return (
    <div className="mt-10 border-t-2 border-black pt-8">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-6">
        Similar Events You Might Like
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {similarEvents.map((evt) => (
          <Link
            key={evt.id}
            to={`/events/${evt.id}`}
            className="neu-border group block bg-white p-4 hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform"
          >
            {evt.banner_url ? (
              <LazyImage
                src={evt.banner_url}
                alt={evt.title}
                className="w-full h-32 object-cover border-2 border-black mb-3"
              />
            ) : (
              <div className="w-full h-32 bg-peach/30 border-2 border-black mb-3 flex items-center justify-center font-mono text-xs font-bold text-black/50">
                NO IMAGE
              </div>
            )}
            <h3 className="font-mono text-sm font-bold uppercase line-clamp-1 group-hover:underline">
              {evt.title}
            </h3>
            {evt.event_date && (
              <p className="font-mono text-xs text-black/60 mt-1">
                📅 {formatDateLong(evt.event_date)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function rsvpRowsToCsv(rows: { name: string; email: string; rsvp_date: string; status: string }[]) {
  const headers = ["User Name", "Email", "RSVP Date", "Status"];
  const escape = (val: string) => {
    const str = String(val ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, formatDateLong(r.rsvp_date), r.status].map(escape).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EventDetailsPage() {
  const { eventId = "", lang = "en" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();
  const { copyToClipboard: copyEventLink, isCopied: isEventLinkCopied } = useCopyToClipboard();
  const { copyToClipboard: copyEventId, isCopied: isEventIdCopied } = useCopyToClipboard();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const viewerCount = useEventViewerCount(eventId);
  const { setCustomTrail } = useBreadcrumbs();

  const {
    data: event,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      // Try to lookup by short_id first, then fall back to UUID for backwards compatibility
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, start_date, end_date, location, banner_url, created_by, short_id, max_attendees, requires_approval,
          profiles (full_name, email),
          clubs (name, slug),
          event_rsvps (id, user_id, status, checked_in, rsvp_at, profiles (first_name, last_name, avatar_url)),
          event_waitlist (id, user_id, created_at, profiles (first_name, last_name, avatar_url)),
          event_metrics (views)
        `,
        )
        .or(`short_id.eq.${eventId},id.eq.${eventId}`)
        .single();

      if (error) {
        // Fallback to mock data in development if db fails or doesn't exist
        if (import.meta.env.DEV && eventId.startsWith("mock-")) {
          return {
            id: eventId,
            category_id: "cat-1",
            created_by: "mock-user-1",
            title:
              eventId === "mock-1"
                ? "Hackathon 2024"
                : eventId === "mock-2"
                  ? "Watercolor Workshop"
                  : "Open Mic Night",
            description:
              eventId === "mock-1"
                ? "Annual college hackathon. Build something awesome in 24 hours!"
                : eventId === "mock-2"
                  ? "Learn the basics of watercolor painting with live demonstrations."
                  : "Showcase your music talent or just come to enjoy the acoustic performances.",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
            ).toISOString(),
            location:
              eventId === "mock-1"
                ? "Main Auditorium, Thapar Institute of Engineering and Technology, Patiala, Punjab"
                : eventId === "mock-2"
                  ? "Art Block, Jawaharlal Nehru University, New Delhi"
                  : "Student Activity Centre, IIT Bombay, Powai, Mumbai",
            banner_url: null as string | null,
            max_attendees: eventId === "mock-1" ? 1 : null,
            latitude: eventId === "mock-1" ? 30.3564 : eventId === "mock-2" ? 28.5355 : 19.076,
            longitude: eventId === "mock-1" ? 76.3647 : eventId === "mock-2" ? 77.209 : 72.8777,
            clubs: [
              {
                name:
                  eventId === "mock-1"
                    ? "Tech Club"
                    : eventId === "mock-2"
                      ? "Art & Design"
                      : "Music Society",
                slug:
                  eventId === "mock-1"
                    ? "tech-club"
                    : eventId === "mock-2"
                      ? "art-design"
                      : "music-society",
              },
            ],
            requires_approval: true,
            event_rsvps:
              eventId === "mock-1"
                ? [
                    {
                      id: "rsvp-1",
                      user_id: "user-1",
                      status: "approved",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "John", last_name: "Doe", avatar_url: null },
                    },
                    {
                      id: "rsvp-2",
                      user_id: "user-2",
                      status: "waitlisted",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "Alice", last_name: "Smith", avatar_url: null },
                    },
                    {
                      id: "rsvp-3",
                      user_id: "user-3",
                      status: "rejected",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "Bob", last_name: "Johnson", avatar_url: null },
                    },
                  ]
                : [],
            event_waitlist:
              eventId === "mock-1"
                ? [
                    {
                      id: "wait-1",
                      user_id: "user-4",
                      created_at: new Date().toISOString(),
                      profiles: { first_name: "Emma", last_name: "Brown", avatar_url: null },
                    },
                  ]
                : [],
            attendee_count: eventId === "mock-1" ? 1 : 0,
            profiles: { full_name: "Mock Organizer", email: "mock@example.com" },
            event_metrics: { views: 0 },
          };
        }
        throw error;
      }
      return data;
    },
  });

  // Safe window URL handling for SSR / hydration safety
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!event) {
      const skeleton = (
        <span className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700 inline-block align-middle" />
      );
      setCustomTrail([
        { label: "Home", path: `/${lang}` },
        { label: "Clubs", path: `/${lang}/clubs` },
        { label: skeleton },
        { label: "Events", path: `/${lang}/events` },
        { label: skeleton },
      ]);
      return;
    }

    const clubObj = event.clubs
      ? Array.isArray(event.clubs)
        ? event.clubs[0]
        : event.clubs
      : null;
    const trail = [
      { label: "Home", path: `/${lang}` },
      { label: "Clubs", path: `/${lang}/clubs` },
    ];

    if (clubObj) {
      trail.push({
        label: clubObj.name,
        path: `/${lang}/clubs/${clubObj.slug}`,
      });
    }

    trail.push({
      label: "Events",
      path: `/${lang}/events`,
    });

    trail.push({
      label: (event as any).title,
    });

    setCustomTrail(trail);

    return () => {
      setCustomTrail(null);
    };
  }, [event, lang, setCustomTrail]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  // Increment persistent view count in event_metrics once per page load.
  // Skipped for mock/dev events (no real DB row).
  //
  // We store the canonical event UUID (event.id) rather than a boolean so that:
  // - Short-id URLs resolve to their UUID before incrementing (avoids wrong PK)
  // - Navigating between events while the component stays mounted still
  //   increments each new event exactly once
  const viewIncrementedRef = useRef<string | null>(null);
  useEffect(() => {
    // Wait until the query has resolved and we have the canonical UUID
    const canonicalId = (event as any)?.id as string | undefined;
    if (!canonicalId || canonicalId.startsWith("mock-")) return;
    if (viewIncrementedRef.current === canonicalId) return;
    viewIncrementedRef.current = canonicalId;

    incrementEventViews(canonicalId).then(({ error }) => {
      if (error) {
        console.warn("[event view] increment failed silently:", error);
        return;
      }
      // Refresh the cached query so the displayed view count is up-to-date.
      // setQueryData updates the in-memory cache with the incremented value
      // without triggering a full network re-fetch.
      const cached = (event as any);
      if (cached?.event_metrics) {
        const currentViews =
          (cached.event_metrics as { views: number } | null)?.views ?? 0;
        setQueryData(["event", eventId], {
          ...cached,
          event_metrics: { views: currentViews + 1 },
        });
      }
    });
  }, [(event as any)?.id, eventId]);

  // Listen for Service Worker background sync messages for offline RSVP reconciliation
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_RSVP_SYNC_SUCCESS") {
        toast.success("Your offline RSVP was synchronized successfully!");
        refetch();
      } else if (event.data?.type === "OFFLINE_RSVP_SYNC_ERROR") {
        toast.error(
          `Offline RSVP sync failed: ${event.data.reason || "Event capacity reached or conflict occurred."}`,
        );
        refetch(); // Refetch to reset optimistic UI to server ground truth
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, [refetch]);

  // Gallery States and Queries
  interface UploadingFile {
    id: string;
    name: string;
    objectUrl: string;
    progress: number;
    status: "uploading" | "success" | "error" | "cancelled";
    errorMsg?: string;
    abortController?: AbortController;
    file?: File;
  }

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data: galleryPhotos = [], refetch: refetchGallery } = useQuery<string[]>({
    queryKey: ["eventGallery", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-")) return [];
      const { data, error } = await supabase.storage.from("event-gallery").list(eventId);
      if (error) {
        console.error("Failed to list gallery files", error);
        return [];
      }
      if (!data) return [];

      return data
        .filter((file) => file.name !== ".emptyFolderPlaceholder")
        .map((file) => {
          return supabase.storage.from("event-gallery").getPublicUrl(`${eventId}/${file.name}`).data
            .publicUrl;
        });
    },
    enabled: !!eventId,
  });

  // Extract headings from HTML description for TOC
  const tocItems = useMemo(() => {
    if (!event?.description) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString((event as any).description, "text/html");
    const headings = doc.querySelectorAll("h2, h3");

    return Array.from(headings).map((heading) => {
      const text = heading.textContent || "";
      // Simple slugify for ID
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return { id, text, level: heading.tagName === "H2" ? 2 : 3 };
    });
  }, [event?.description]);

  // Inject IDs into the rendered DOM nodes so the TOC can scroll to them
  useEffect(() => {
    const container = document.getElementById("event-description-container");
    if (!container) return;

    const headings = container.querySelectorAll("h2, h3");
    headings.forEach((heading) => {
      const text = heading.textContent || "";
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      heading.id = id;
    });
  }, [event?.description]);

  useEffect(() => {
    if (!lightboxSrc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxSrc(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxSrc]);

  useEffect(() => {
    return () => {
      uploadingFiles.forEach((file) => URL.revokeObjectURL(file.objectUrl));
    };
  }, [uploadingFiles]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 10) {
      toast.error("You can upload a maximum of 10 photos at once.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You must be logged in to upload photos.");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const newUploads: UploadingFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      objectUrl: URL.createObjectURL(file),
      progress: 0,
      status: "uploading",
      abortController: new AbortController(),
      file,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    const uploadPromises = newUploads.map((uploadItem) => {
      const fileExt = uploadItem.file!.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${eventId}/${fileName}`;

      return uploadFileWithProgress(
        supabaseUrl,
        session.access_token,
        "event-gallery",
        filePath,
        uploadItem.file!,
        (percent) => {
          setUploadingFiles((prev) =>
            prev.map((item) => (item.id === uploadItem.id ? { ...item, progress: percent } : item)),
          );
        },
        uploadItem.abortController?.signal,
      )
        .then(() => {
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === uploadItem.id ? { ...item, status: "success", progress: 100 } : item,
            ),
          );
        })
        .catch((error) => {
          if (error.message === "Upload cancelled") {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadItem.id ? { ...item, status: "cancelled", progress: 0 } : item,
              ),
            );
            toast.info(`Upload cancelled for ${uploadItem.name}`);
          } else {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadItem.id
                  ? { ...item, status: "error", progress: 0, errorMsg: error.message }
                  : item,
              ),
            );
            toast.error(`Failed to upload ${uploadItem.name}: ${error.message}`);
          }
        });
    });

    await Promise.all(uploadPromises);

    refetchGallery();
    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((item) => item.status !== "success" && item.status !== "cancelled"),
      );
    }, 2000);
  };

  const handleCancelUpload = (id: string) => {
    setUploadingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file && file.status === "uploading" && file.abortController) {
        file.abortController.abort();
      }
      return prev;
    });
  };

  const handleRetryUpload = async (id: string) => {
    // Cannot access latest uploadingFiles reliably from closure if not using functional update
    // We'll extract it using a ref or just grab the file from the state directly
    setUploadingFiles((prev) => {
      const fileItem = prev.find((f) => f.id === id);
      if (!fileItem || !fileItem.file) return prev;

      // Perform async operations outside
      retryUploadTask(fileItem);

      return prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "uploading",
              progress: 0,
              errorMsg: undefined,
              abortController: new AbortController(),
            }
          : item,
      );
    });
  };

  const retryUploadTask = async (fileItem: UploadingFile) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // We need the newly created abortController, so we get it from the latest state
    let abortSignal: AbortSignal | undefined;
    setUploadingFiles((prev) => {
      const updatedItem = prev.find((f) => f.id === fileItem.id);
      abortSignal = updatedItem?.abortController?.signal;
      return prev;
    });

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fileExt = fileItem.file!.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${eventId}/${fileName}`;

    uploadFileWithProgress(
      supabaseUrl,
      session.access_token,
      "event-gallery",
      filePath,
      fileItem.file!,
      (percent) => {
        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === fileItem.id ? { ...item, progress: percent } : item)),
        );
      },
      abortSignal,
    )
      .then(() => {
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileItem.id ? { ...item, status: "success", progress: 100 } : item,
          ),
        );
        refetchGallery();
        setTimeout(() => {
          setUploadingFiles((prev) =>
            prev.filter((item) => item.status !== "success" && item.status !== "cancelled"),
          );
        }, 2000);
      })
      .catch((error) => {
        if (error.message === "Upload cancelled") {
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === fileItem.id ? { ...item, status: "cancelled", progress: 0 } : item,
            ),
          );
        } else {
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === fileItem.id
                ? { ...item, status: "error", progress: 0, errorMsg: error.message }
                : item,
            ),
          );
        }
      });
  };

  const toggleWaitlist = useMutation({
    mutationFn: async ({ isOnWaitlist }: { isOnWaitlist: boolean }) => {
      if (!user) throw new Error("Please log in to join waitlist");
      if (eventId.startsWith("mock-")) {
        return;
      }

      if (isOnWaitlist) {
        const { error } = await supabase
          .from("event_waitlist")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_waitlist")
          .insert({ event_id: eventId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update waitlist status. Please try again.");
    },
  });

  const toggleRsvp = useMutation({
    mutationFn: async ({
      eventId,
      hasRsvpd,
      captchaToken,
    }: {
      eventId: string;
      hasRsvpd: boolean;
      captchaToken?: string;
    }) => {
      if (!user) throw new Error("Please log in to RSVP");
      if (eventId.startsWith("mock-")) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd, captchaToken },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
    },
    onMutate: async ({ hasRsvpd }) => {
      // Snapshot the previous value
      const previousEvent = event;

      // Optimistically update the cache
      if (event) {
        const eventRsvps = Array.isArray((event as any).event_rsvps)
          ? (event as any).event_rsvps
          : [];
        const updatedRsvps = hasRsvpd
          ? eventRsvps.filter((r: any) => r.user_id !== user?.id)
          : [...eventRsvps, { id: `temp-${Date.now()}`, user_id: user?.id || "" }];

        const updatedEvent = {
          ...event,
          event_rsvps: updatedRsvps,
          attendee_count: hasRsvpd
            ? (((event as Record<string, unknown>).attendee_count as number) || 0) - 1
            : (((event as Record<string, unknown>).attendee_count as number) || 0) + 1,
        };

        setQueryData(["event", eventId], updatedEvent);
      }

      // Return context with previous data for rollback
      return { previousEvent };
    },
    onError: (
      error: unknown,
      _variables: unknown,
      context: { previousEvent: unknown } | undefined,
    ) => {
      // Rollback to previous value on error
      if (context?.previousEvent) {
        setQueryData(["event", eventId], context.previousEvent);
      }

      const err = error as Record<string, unknown>;
      if (
        (typeof err?.message === "string" && err.message.includes("Rate limit")) ||
        (typeof err?.details === "string" && err.details.includes("Rate limit")) ||
        (typeof err?.context === "string" && err.context.includes("Rate limit")) ||
        (typeof error === "string" && error.includes("Rate limit"))
      ) {
        toast.error("Please wait a minute before toggling RSVP again.");
      } else {
        toast.error((err?.message as string) || "Failed to update RSVP. Please try again.");
      }
    },
    onSuccess: (_data, variables) => {
      // Refetch to ensure server state matches
      refetch();
      if (!variables.hasRsvpd) {
        triggerConfetti();
      }
      // Reserve selected seats after successful RSVP
      if (hasSeats && selectedSeats.length > 0) {
        selectedSeats.forEach((seatId) => {
          supabase.rpc("reserve_seat", { p_seat_id: seatId });
        });
      }

      // Eagerly cache event banner if they just RSVP'd
      if (!variables.hasRsvpd && event?.banner_url && "caches" in window) {
        window.caches.open("supabase-images-cache").then((cache) => {
          cache.add((event as any).banner_url!).catch((err) => {
            console.error("Failed to eagerly cache banner image", err);
          });
        });
      }
    },
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("export-event-rsvps", {
        body: { eventId: event!.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("We will email you shortly");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to export RSVP list.");
    },
  });

  const checkInRsvp = useMutation({
    mutationFn: async ({ rsvpId }: { rsvpId: string }) => {
      if (!user) throw new Error("Please log in to check in attendees");
      if (!event || eventId.startsWith("mock-")) {
        return { alreadyCheckedIn: false };
      }

      const { data: existingRsvp, error: fetchError } = await supabase
        .from("event_rsvps")
        .select("checked_in")
        .eq("id", rsvpId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (existingRsvp?.checked_in) {
        return { alreadyCheckedIn: true };
      }

      const { error } = await supabase
        .from("event_rsvps")
        .update({ checked_in: true })
        .eq("id", rsvpId)
        .eq("event_id", eventId);

      if (error) throw error;

      try {
        await supabase.from("event_attendance_logs").insert({
          rsvp_id: rsvpId,
          recorded_by: user.id,
        });
      } catch {
        // Attendance logging is optional if the table is unavailable in the current environment.
      }

      return { alreadyCheckedIn: false };
    },
    onSuccess: (result) => {
      if (result?.alreadyCheckedIn) {
        toast.success("This attendee is already checked in.");
      } else {
        toast.success("Attendee checked in successfully.");
      }
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to check in attendee.");
    },
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to submit feedback");
      if (feedbackRating === 0) throw new Error("Please select a rating");
      if (eventId.startsWith("mock-")) return;

      const { error } = await supabase.from("event_feedbacks").insert({
        event_id: eventId,
        user_id: user.id,
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thank you for your feedback!");
      setFeedbackOpen(false);
      setFeedbackRating(0);
      setFeedbackComment("");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit feedback. Please try again.");
    },
  });

  useEffect(() => {
    if (!eventId || eventId.startsWith("mock-") || !event) return;

    const channel = supabase
      .channel(`event-rsvps-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          if (isOrganizer) {
            toast.success("New RSVP received!");
          }
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, event?.created_by, user?.id, supabase, refetch]);

  const isOrganizer = Boolean(user && event?.created_by === user.id);

  // Delete the current event. Exposed as a contextual Command Palette action
  // while this page is mounted (see useCommand below).
  const handleDeleteEvent = useCallback(async () => {
    if (!event) return;
    const { error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", event.id)
      .is("deleted_at", null);
    if (error) {
      toast.error(error.message || "Failed to delete event.");
      return;
    }
    toast.success("Event deleted successfully.");
    navigate("/events");
  }, [event, supabase, navigate]);

  // Register an organizer-only contextual command. It is automatically removed
  // from the global palette when this page unmounts.
  useCommand(
    isOrganizer && event
      ? {
          id: "event-delete",
          title: "Delete Event",
          keywords: ["delete", "remove", "trash"],
          action: handleDeleteEvent,
        }
      : null,
  );

  // Local state for optimistic updates during dragging
  const [columns, setColumns] = useState<{
    waitlisted: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId?: string;
    }[];
    approved: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId: string;
    }[];
    rejected: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId: string;
    }[];
  }>({ waitlisted: [], approved: [], rejected: [] });

  useEffect(() => {
    if (!event) return;

    const typedEvent = event as unknown as {
      event_waitlist: unknown[];
      event_rsvps: unknown[];
    };

    setColumns(
      buildKanbanColumns(
        (typedEvent as any).event_waitlist || [],
        (typedEvent as any).event_rsvps || [],
      ) as unknown as typeof columns,
    );
  }, [event]);

  const updateRsvpStatus = useMutation({
    mutationFn: async ({
      userId,
      rsvpId,
      newStatus,
    }: {
      userId: string;
      rsvpId?: string;
      newStatus: "waitlisted" | "approved" | "rejected";
    }) => {
      if (eventId.startsWith("mock-")) {
        return;
      }

      if (newStatus === "approved") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "approved" })
            .eq("id", rsvpId);
          if (error) throw error;
        } else {
          // Promote from event_waitlist to approved
          const { error: insertError } = await supabase
            .from("event_rsvps")
            .insert({ event_id: eventId, user_id: userId, status: "approved" });
          if (insertError) throw insertError;

          const { error: deleteError } = await supabase
            .from("event_waitlist")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", userId);
          if (deleteError) throw deleteError;
        }
      } else if (newStatus === "rejected") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "rejected" })
            .eq("id", rsvpId);
          if (error) throw error;
        } else {
          // Promote from event_waitlist to rejected
          const { error: insertError } = await supabase
            .from("event_rsvps")
            .insert({ event_id: eventId, user_id: userId, status: "rejected" });
          if (insertError) throw insertError;

          const { error: deleteError } = await supabase
            .from("event_waitlist")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", userId);
          if (deleteError) throw deleteError;
        }
      } else if (newStatus === "waitlisted") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "waitlisted" })
            .eq("id", rsvpId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("RSVP status updated!");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP status.");
      refetch();
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;

    const sourceColId = source.droppableId as keyof typeof columns;
    const destColId = destination.droppableId as keyof typeof columns;

    const sourceList = Array.from(columns[sourceColId]);
    const destList = Array.from(columns[destColId]);

    const [movedCard] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, movedCard);

    setColumns({
      ...columns,
      [sourceColId]: sourceList,
      [destColId]: destList,
    });

    updateRsvpStatus.mutate({
      userId: movedCard.userId,
      rsvpId: movedCard.rsvpId,
      newStatus: destColId as "waitlisted" | "approved" | "rejected",
    });
  };

  if (isLoading) {
    return <SkeletonEventDetails />;
  }

  if (!event) {
    return (
      <>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="mx-auto max-w-md neu-border bg-white p-8 text-center">
            <h1 className="text-3xl font-black">Event Not Found</h1>
            <p className="mt-4 font-mono text-sm leading-6">
              The event you are looking for does not exist, has been removed, or the link is
              incorrect.
            </p>
            <Link
              to="/events"
              className="neu-press mt-6 inline-flex items-center gap-2 border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft size={14} /> Back to Events
            </Link>
          </div>
        </section>
      </>
    );
  }

  const rsvps = Array.isArray((event as any).event_rsvps)
    ? ((event as any).event_rsvps as any[])
    : [];
  const { hasRsvpd, isCheckedIn, hasEnded } = buildRsvpStatus(
    rsvps,
    user?.id,
    (event as any).end_date,
  );
  const rawFeedbacks = (event as Record<string, unknown>).event_feedbacks;
  const { hasSubmittedFeedback } = buildFeedbackStatus(
    Array.isArray(rawFeedbacks) ? (rawFeedbacks as { user_id: string }[]) : undefined,
    user?.id,
  );

  const rawWaitlist = (event as Record<string, unknown>).event_waitlist;
  const { waitlist, isOnWaitlist, waitlistPosition } = buildWaitlistInfo(rawWaitlist, user?.id);

  const {
    seats: seatData,
    reservedSeatIds,
    selectedSeats,
    toggleSeat,
    hasSeats,
    isLoading: isSeatsLoading,
  } = useEventSeats(
    event?.id && !(event as any).id.startsWith("mock-") ? (event as any).id : undefined,
  );

  const club = event.clubs ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
  const coordsCheck = (event as any).location
    ? parseCoordinates((event as any).location)
    : { isCoordinates: false, isValid: true };

  const googleCalendarUrl = getGoogleCalendarUrl({
    title: (event as any).title,
    description: (event as any).description || "",
    event_date: event.event_date || "",
    start_date: event.start_date,
    end_date: (event as any).end_date,
    location: (event as any).location || "",
  });

  const captchaSiteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY || import.meta.env.VITE_HCAPTCHA_SITE_KEY;
  const captchaSecretKey =
    import.meta.env.VITE_TURNSTILE_SECRET_KEY || import.meta.env.VITE_HCAPTCHA_SECRET_KEY;
  const captchaEnabled = isCaptchaConfigured(captchaSiteKey, captchaSecretKey);
  const captchaProvider = import.meta.env.VITE_TURNSTILE_SITE_KEY ? "turnstile" : "hcaptcha";

  const handleRsvpClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }
    if (!emailVerified) {
      toast.error("Please verify your email to RSVP");
      return;
    }
    if (hasRsvpd) {
      setConfirmOpen(true);
      return;
    }

    if (captchaEnabled && !shouldRequireCaptcha(captchaSiteKey, captchaSecretKey, captchaToken)) {
      toast.error("Please complete the CAPTCHA challenge to RSVP.");
      return;
    }

    if (hasSeats && selectedSeats.length === 0) {
      toast.error("Please select at least one seat before RSVPing.");
      return;
    }

    toggleRsvp.mutate({ eventId: (event as any).id, hasRsvpd: false, captchaToken });
  };

  const handleCopyLink = async () => {
    if (await copyEventLink(shareUrl || window.location.href)) {
      toast.success("Event link copied to clipboard!");
    } else {
      toast.error("Failed to copy link.");
    }
  };

  const handleCopyEventId = async () => {
    if (await copyEventId((event as any).id)) {
      toast.success("Event ID copied to clipboard!");
    } else {
      toast.error("Failed to copy event ID.");
    }
  };
  const handleConfirmCancel = () => {
    toggleRsvp.mutate({ eventId: (event as any).id, hasRsvpd: true });
    setConfirmOpen(false);
  };

  const attendeeCount =
    ((event as Record<string, unknown>).attendee_count as number) ?? rsvps.length;
  const maxAttendees = (event as Record<string, unknown>).max_attendees as
    number | null | undefined;
  const isAtCapacity =
    maxAttendees !== null &&
    maxAttendees !== undefined &&
    maxAttendees > 0 &&
    attendeeCount >= maxAttendees;

  // Issue #1904: dynamic OpenGraph / Twitter Card meta tags so sharing an
  // event link on Discord / iMessage / Twitter renders a rich preview with
  // the actual event banner + title + date.
  //
  // Edge case from the spec: og:image should be 1200x630 to satisfy
  // Twitter / Facebook crop heuristics. We resize the banner via Supabase
  // Storage's render/image-public transform when a banner exists; fall
  // back to the raw URL if the transform cannot be derived.
  //
  // The pure helper lives in src/lib/seo/eventMeta.ts so it can be unit
  // tested without React / Supabase / react-helmet-async.
  const og = buildOpenGraphTags({
    title: (event as any).title,
    description: (event as any).description,
    bannerUrl: (event as any).banner_url,
    eventDate: event.event_date,
    location: (event as any).location,
    url: shareUrl || (typeof window !== "undefined" ? window.location.href : null),
    // Issue #1515: pass the event UUID so buildOpenGraphTags prefers the
    // og-image Edge Function URL (generates a rich branded card on-the-fly).
    eventId: event.id,
  });

  return (
    <LazyMotion features={loadDomMax} strict={import.meta.env.DEV}>
      <Helmet>
        {/* OpenGraph (Facebook / Discord / iMessage) */}
        <meta property="og:type" content="event" />
        {og.ogUrl && <meta property="og:url" content={og.ogUrl} />}
        <meta property="og:title" content={og.ogTitle} />
        <meta property="og:description" content={og.ogDescription} />
        {og.ogImage && <meta property="og:image" content={og.ogImage} />}
        {og.ogImage && <meta property="og:image:width" content="1200" />}
        {og.ogImage && <meta property="og:image:height" content="630" />}
        {og.eventStartTime && <meta property="event:start_time" content={og.eventStartTime} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={og.ogTitle} />
        <meta name="twitter:description" content={og.ogDescription} />
        {og.ogImage && <meta name="twitter:image" content={og.ogImage} />}
      </Helmet>
      <SiteShell>
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden border-b-2 border-black bg-peach/30">
          {(event as any).banner_url ? (
            <m.div layoutId={`event-image-${(event as any).id}`} className="absolute inset-0">
              <OptimizedImage
                src={(event as any).banner_url}
                alt={`${(event as any).title} event banner`}
                className="h-full w-full object-cover"
                width={1344}
                height={700}
                responsiveWidths={[448, 672, 896, 1344]}
                sizes="100vw"
                priority
                fallback={
                  <div className="h-full w-full bg-linear-to-br from-peach via-pink-200 to-lime/40" />
                }
              />
              <div className="absolute inset-0 bg-black/50" />
            </m.div>
          ) : (
            <m.div
              layoutId={`event-image-${(event as any).id}`}
              className="absolute inset-0 bg-linear-to-br from-peach via-pink-200 to-lime/40"
            />
          )}

          <div className="relative mx-auto flex min-h-[50vh] max-w-4xl flex-col justify-end px-4 py-16 md:min-h-[60vh] md:px-6 md:py-24">
            <div className="mb-4">
              <span className="neu-border inline-block bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black">
                Event Details
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1
                className={`text-4xl font-black tracking-tight md:text-6xl ${(event as any).banner_url ? "text-white" : "text-black"}`}
              >
                {(event as any).title}
              </h1>
              <ShareMenu url={shareUrl} title={(event as any).title} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCopyEventId}
                      variant="outline"
                      size="icon"
                      className="neu-border rounded-2xl h-8 w-8 shrink-0 bg-black text-white transition-all duration-300 hover:scale-105 active:scale-95"
                      aria-label="Copy Event ID"
                    >
                      {isEventIdCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy Event ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {club && (
              <p
                className={`mt-4 font-mono text-base font-bold ${(event as any).banner_url ? "text-white/90" : "text-black/80"}`}
              >
                Organized by:{" "}
                <Link to={`/clubs/${club.slug}`} className="underline hover:opacity-80">
                  {club.name}
                </Link>
              </p>
            )}

            {!club && event.profiles && (
              <div
                className={`mt-4 font-mono text-base font-bold ${(event as any).banner_url ? "text-white/90" : "text-black/80"} flex items-center gap-4`}
              >
                <span>Organized by: {(event.profiles as { full_name: string }).full_name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    import("@/lib/vcardUtils").then(({ downloadVCard }) => {
                      downloadVCard(event.profiles as { full_name: string; email: string });
                    });
                  }}
                  className="neu-border h-8 bg-white/20 hover:bg-white/40 text-xs px-3"
                >
                  <Download className="mr-2 h-3 w-3" />
                  Download Contact (vCard)
                </Button>
              </div>
            )}

            <div
              className={`mt-8 flex flex-wrap gap-4 font-mono text-sm font-bold sm:gap-8 ${(event as any).banner_url ? "text-white" : "text-black"}`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{formatEventDateRange(event)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>{(event as any).location || "TBA"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{attendeeCount} RSVP&apos;d</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                <span>
                  {(
                    ((event as any).event_metrics as { views: number } | null)?.views ?? 0
                  ).toLocaleString()}{" "}
                  views
                </span>
              </div>
            </div>

            <div className="mt-6 max-w-md">
              <EventCapacityGauge
                eventId={(event as any).id}
                initialCapacity={attendeeCount}
                maxAttendees={maxAttendees || null}
                showDetails={true}
              />
            </div>

            <div className="mt-8 hidden items-center gap-4 md:flex">
              {hasRsvpd ? (
                <Button
                  onClick={handleRsvpClick}
                  disabled={toggleRsvp.isPending}
                  variant="secondary"
                  size="lg"
                >
                  {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
                </Button>
              ) : isAtCapacity ? (
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={() => {
                      if (!user) {
                        toast.error("Please log in to join the waitlist");
                        return;
                      }
                      if (!emailVerified) {
                        toast.error("Please verify your email to join the waitlist");
                        return;
                      }
                      toggleWaitlist.mutate({ isOnWaitlist });
                    }}
                    disabled={toggleWaitlist.isPending}
                    variant={isOnWaitlist ? "secondary" : "primary"}
                    size="lg"
                  >
                    {toggleWaitlist.isPending
                      ? "Updating..."
                      : isOnWaitlist
                        ? "On Waitlist ✓"
                        : "Join Waitlist"}
                  </Button>
                  {isOnWaitlist && waitlistPosition > 0 && (
                    <span
                      className={`font-mono text-xs font-bold ${(event as any).banner_url ? "text-white" : "text-black"}`}
                    >
                      You are #{waitlistPosition} on the waitlist
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleRsvpClick}
                    disabled={toggleRsvp.isPending}
                    variant="primary"
                    size="lg"
                  >
                    {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
                  </Button>
                  {captchaEnabled && (
                    <div className="flex flex-col gap-2">
                      <span
                        className={`font-mono text-xs font-bold ${(event as any).banner_url ? "text-white/80" : "text-black/60"}`}
                      >
                        Verification required before RSVP
                      </span>
                      <CaptchaWidget
                        siteKey={captchaSiteKey}
                        provider={captchaProvider}
                        onToken={(token) => setCaptchaToken(token)}
                        onError={() => setCaptchaToken(undefined)}
                        onExpire={() => setCaptchaToken(undefined)}
                      />
                    </div>
                  )}
                </div>
              )}
              <span
                className={`font-mono text-sm font-bold ${(event as any).banner_url ? "text-white/80" : "text-black/60"}`}
              >
                {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} people going
                {isAtCapacity && !hasRsvpd && " (At Capacity)"}
              </span>
            </div>
          </div>
        </section>

        {/* Details Container */}
        <section className="bg-cream px-4 py-12 md:px-6">
          <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
            {/* Action buttons (Copy Link / Add to Calendar) */}
            <div className="flex flex-wrap items-center gap-4 border-b-2 border-black pb-8">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      {isEventLinkCopied ? (
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                      ) : (
                        <LinkIcon className="mr-2 h-4 w-4" />
                      )}
                      {isEventLinkCopied ? "Copied! ✓" : "Copy Link"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy Event Link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {isOrganizer && (
                <>
                  <Button
                    onClick={() => navigate(`/events/${eventId}/gantt`)}
                    variant="outline"
                    className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Gantt Chart
                  </Button>
                  <Button
                    onClick={() => exportCsv.mutate()}
                    disabled={exportCsv.isPending}
                    variant="outline"
                    className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exportCsv.isPending ? "Exporting..." : "Export CSV"}
                  </Button>
                  <CreatePollDialog
                    eventId={eventId}
                    user={user!}
                    onPollCreated={() => refetch()}
                  />
                </>
              )}

              {googleCalendarUrl && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="neu-border h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Add to Calendar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="neu-border font-mono text-sm">
                    <DropdownMenuItem asChild>
                      <a
                        href={googleCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Calendar className="h-4 w-4" />
                        Google Calendar
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => downloadIcs(event)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      Download .ics
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {user && !isOrganizer && (
                <Button
                  onClick={() => setIsReportDialogOpen(true)}
                  variant="outline"
                  className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Flag className="h-4 w-4" />
                  Report Event
                </Button>
              )}

              {isCheckedIn && hasEnded && (
                <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                  <DialogTrigger asChild>
                    <Button
                      disabled={hasSubmittedFeedback}
                      variant="primary"
                      className="neu-border neu-press h-12 px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      <Star className="mr-2 h-4 w-4" />
                      {hasSubmittedFeedback ? "Feedback Submitted \u2713" : "Submit Feedback"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md neu-border">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase text-xl text-blue-900">
                        Event Feedback
                      </DialogTitle>
                      <DialogDescription className="font-mono text-sm">
                        How was {(event as any).title}? Share your experience!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 py-4">
                      <div className="flex flex-col items-center gap-3">
                        <Label className="font-mono font-bold">Rating</Label>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFeedbackRating(star)}
                              aria-label={`Rate ${star} out of 5 stars`}
                              aria-pressed={feedbackRating === star}
                              className="transition-transform hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                            >
                              <Star
                                className={`h-8 w-8 ${feedbackRating >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="comment" className="font-mono font-bold">
                          Comment (Optional)
                        </Label>
                        <Textarea
                          id="comment"
                          placeholder="Tell us what you liked or what could be improved..."
                          className="neu-border font-mono text-sm min-h-25"
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => submitFeedback.mutate()}
                        disabled={submitFeedback.isPending || feedbackRating === 0}
                        variant="primary"
                        className="font-mono font-bold uppercase w-full sm:w-auto"
                      >
                        {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Active Poll */}
            <div className="mt-8">
              <ActivePoll eventId={eventId} userId={user?.id} />
            </div>
            {/* Description */}
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                About the Event
              </h2>
              <div className="flex flex-col gap-8 lg:flex-row">
                <main className="flex-1 min-w-0">
                  {(event as any).description ? (
                    <p className="mt-4 whitespace-pre-line text-base leading-7 text-black/80">
                      {(event as any).description}
                    </p>
                  ) : (
                    <p className="mt-4 font-mono text-sm italic text-black/40">
                      No description provided for this event.
                    </p>
                  )}

                  <div
                    id="event-description-container"
                    className="prose prose-lg max-w-none dark:prose-invert prose-headings:scroll-mt-24"
                    dangerouslySetInnerHTML={{ __html: (event as any).description }}
                  />
                </main>
                <aside className="lg:w-64 shrink-0">
                  <TableOfContents items={tocItems} />
                </aside>
              </div>
            </div>

            {/* FAQ Section */}
            {Array.isArray((event as Record<string, unknown>).faqs) &&
              ((event as Record<string, unknown>).faqs as { question: string; answer: string }[])
                .length > 0 && (
                <div className="mt-8">
                  <PredictiveTurnout
                    rsvpCount={attendeeCount}
                    latitude={(event as Record<string, unknown>).latitude as number | null}
                    longitude={(event as Record<string, unknown>).longitude as number | null}
                    location={(event as any).location || ""}
                    clubName={club?.name || ""}
                  />
                </div>
              )}

            {/* Active Poll */}
            <div className="mt-8">
              <ActivePoll eventId={eventId} userId={user?.id} />
            </div>

            {/* Live Q&A */}
            <div className="mt-8">
              {/* <LiveQA eventId={eventId} userId={user?.id} isOrganizer={isOrganizer} /> */}
            </div>
            {/* Description */}
            <div className="mt-8 flex flex-col lg:flex-row gap-8">
              <main className="flex-1 min-w-0">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                  About the Event
                </h2>

                {(event as any).description ? (
                  <div
                    id="event-description-container"
                    className="prose prose-lg max-w-none dark:prose-invert prose-headings:scroll-mt-24 mt-4"
                    dangerouslySetInnerHTML={{ __html: (event as any).description }}
                  />
                ) : (
                  <p className="mt-4 font-mono text-sm italic text-black/40">
                    No description provided for this event.
                  </p>
                )}

                {/* Map Section */}
                {coordsCheck.isCoordinates &&
                  coordsCheck.isValid &&
                  coordsCheck.lat != null &&
                  coordsCheck.lng != null && (
                    <div className="mt-8">
                      <h3 className="font-display text-lg font-bold uppercase tracking-tight text-black mb-4">
                        Location Map
                      </h3>
                      <LazyHydrate
                        height="300px"
                        placeholder={<MapSkeleton className="h-[300px] w-full" />}
                      >
                        <Suspense fallback={<MapSkeleton className="h-[300px] w-full" />}>
                          <EventMap
                            lat={coordsCheck.lat}
                            lng={coordsCheck.lng}
                            locationName={(event as any).location}
                          />
                        </Suspense>
                      </LazyHydrate>
                      <a
                        href={buildGoogleMapsSearchUrl((event as any).location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-mono text-xs font-bold underline text-blue-500"
                      >
                        Open in Google Maps ↗
                      </a>
                    </div>
                  )}
                {coordsCheck.isCoordinates && !coordsCheck.isValid && (
                  <div className="neu-border mt-8 flex items-start gap-4 bg-peach/20 p-5">
                    <div className="shrink-0 rounded-none border-2 border-black bg-white p-2 text-destructive">
                      <MapPinOff className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-display text-lg font-bold text-black">
                        Unable to load map preview
                      </h3>
                      <p className="mb-3 font-mono text-xs leading-relaxed text-gray-700">
                        The coordinates provided (<code>{(event as any).location}</code>) are
                        invalid. Latitude must be between -90 and 90, and Longitude between -180 and
                        180.
                      </p>
                    </div>
                  </div>
                )}
              </main>
              <aside className="lg:w-64 shrink-0">
                <TableOfContents items={tocItems} />
              </aside>
            </div>

            {/* FAQ Section */}
            {Array.isArray((event as Record<string, unknown>).faqs) &&
              ((event as Record<string, unknown>).faqs as { question: string; answer: string }[])
                .length > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                    Frequently Asked Questions
                  </h2>
                  <Accordion type="single" collapsible className="mt-4 space-y-2">
                    {(
                      (event as Record<string, unknown>).faqs as {
                        question: string;
                        answer: string;
                      }[]
                    ).map((faq, index) => (
                      <AccordionItem
                        key={index}
                        value={`faq-${index}`}
                        className="neu-border bg-white"
                      >
                        <AccordionTrigger className="px-4 font-mono text-sm font-bold text-black hover:no-underline">
                          <div className="flex items-center gap-2 text-left">
                            <HelpCircle className="h-4 w-4 shrink-0 text-blue-900" />
                            {faq.question}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 font-mono text-sm text-black/70">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

            {/* Interactive Map */}
            {(event as any).location && (event as any).location.toLowerCase() !== "online" && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                  Location
                </h2>
                {coordsCheck.isCoordinates &&
                coordsCheck.isValid &&
                coordsCheck.lat != null &&
                coordsCheck.lng != null ? (
                  <>
                    <LazyHydrate
                      height="300px"
                      placeholder={<MapSkeleton className="mt-4 h-[300px] w-full" />}
                    >
                      <Suspense fallback={<MapSkeleton className="mt-4 h-[300px] w-full" />}>
                        <EventMap
                          lat={coordsCheck.lat}
                          lng={coordsCheck.lng}
                          locationName={(event as any).location}
                        />
                      </Suspense>
                    </LazyHydrate>
                    <a
                      href={buildGoogleMapsSearchUrl((event as any).location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block font-mono text-xs font-bold underline text-blue-500"
                    >
                      Open in Google Maps ↗
                    </a>
                  </>
                ) : coordsCheck.isCoordinates && !coordsCheck.isValid ? (
                  <div className="neu-border mt-4 flex items-start gap-4 bg-peach/20 p-5">
                    <div className="shrink-0 rounded-none border-2 border-black bg-white p-2 text-destructive">
                      <MapPinOff className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-display text-lg font-bold text-black">
                        Unable to load map preview
                      </h3>
                      <p className="mb-3 font-mono text-xs leading-relaxed text-gray-700">
                        The coordinates provided (<code>{(event as any).location}</code>) are
                        invalid. Latitude must be between -90 and 90, and Longitude between -180 and
                        180.
                      </p>
                      <a
                        href={buildGoogleMapsSearchUrl((event as any).location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold underline hover:no-underline text-black"
                      >
                        Search location on Google Maps anyway ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <a
                    href={buildGoogleMapsSearchUrl((event as any).location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neu-border mt-4 inline-flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <MapPin className="h-4 w-4" />
                    Open &quot;{(event as any).location}&quot; in Google Maps ↗
                  </a>
                )}
              </div>
            )}

            {/* Event Feedback (Only if ended and user RSVP'd) */}
            {user &&
              hasRsvpd &&
              (event as any).end_date &&
              new Date((event as any).end_date).getTime() < Date.now() && (
                <div className="mt-10">
                  <EventFeedbackForm eventId={(event as any).id} user={user} />
                </div>
              )}

            {/* Event Gallery */}
            <div className="mt-8 border-t-2 border-black pt-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                    Event Gallery
                  </h2>
                  <p className="font-mono text-xs text-black/60 mt-1">
                    Photos shared from this event
                  </p>
                </div>
                {isOrganizer && (
                  <div>
                    <input
                      type="file"
                      id="bulk-gallery-upload"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <Button
                      onClick={() => document.getElementById("bulk-gallery-upload")?.click()}
                      variant="outline"
                      className="neu-border neu-press h-12 bg-lime text-black px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      📸 Upload Photos
                    </Button>
                  </div>
                )}
              </div>

              {/* Optimistic UI & Progress for Uploading Files */}
              {uploadingFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 mb-6">
                  {uploadingFiles.map((file) => (
                    <div
                      key={file.id}
                      className="relative neu-border bg-white p-2 flex flex-col justify-between"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-cream relative">
                        <img
                          src={file.objectUrl}
                          alt="Uploading..."
                          className="h-full w-full object-cover opacity-60"
                        />
                        {file.status === "uploading" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 p-2 group">
                            <span className="font-mono text-xs font-bold text-white mb-2">
                              {file.progress}%
                            </span>
                            <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden mb-2">
                              <div
                                className="bg-lime h-full transition-all duration-200"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                            <button
                              onClick={() => handleCancelUpload(file.id)}
                              className="bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Cancel upload"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        {file.status === "success" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-lime/80 text-black font-display font-black text-sm uppercase">
                            Uploaded ✓
                          </div>
                        )}
                        {file.status === "error" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/90 text-white p-2">
                            <span className="font-display font-black text-xs uppercase text-center">
                              Failed
                            </span>
                            <span className="font-mono text-[9px] text-center mt-1 truncate w-full mb-2">
                              {file.errorMsg}
                            </span>
                            <button
                              onClick={() => handleRetryUpload(file.id)}
                              className="bg-white text-red-500 rounded-full p-1 hover:bg-gray-200 transition-colors"
                              aria-label="Retry upload"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        )}
                        {file.status === "cancelled" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-500/90 text-white p-2">
                            <span className="font-display font-black text-xs uppercase text-center">
                              Cancelled
                            </span>
                            <button
                              onClick={() => handleRetryUpload(file.id)}
                              className="mt-2 bg-white text-gray-700 rounded-full p-1 hover:bg-gray-200 transition-colors"
                              aria-label="Retry upload"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-black/70 truncate mt-2">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Gallery Images List */}
              {galleryPhotos.length === 0 && uploadingFiles.length === 0 ? (
                <div className="neu-border bg-cream p-8 text-center font-mono text-sm text-black/50 italic">
                  No photos uploaded yet for this event.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {galleryPhotos.map((url, idx) => (
                    <div
                      key={url}
                      className="neu-border bg-white p-2 hover:scale-[1.02] transition-transform duration-300 group cursor-zoom-in"
                      onClick={() => {
                        setLightboxSrc(url);
                      }}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-cream">
                        <img
                          src={url}
                          alt={`Event gallery photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Social Share */}
            <div className="mt-10 border-t-2 border-black pt-6">
              <h3 className="font-mono text-xs font-bold uppercase text-blue-900">
                Share with Friends
              </h3>
              <div className="mt-4">
                <ShareMenu
                  url={shareUrl}
                  title={(event as any).title}
                  text={`Check out this event: ${(event as any).title}`}
                />
              </div>
            </div>

            {/* Kanban Board for Organizer */}
            {isOrganizer && (
              <div className="mt-12 border-t-4 border-black pt-10">
                <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black mb-6">
                  Attendee Manager
                </h2>
                <div className="mb-8 rounded-2xl border-4 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-black uppercase tracking-tight text-black">
                        QR Check-in
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Verify a signed ticket from the camera or an uploaded image to mark the
                        attendee as checked in.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <SteganographicQRScanner
                      onVerificationSuccess={(payload) => {
                        checkInRsvp.mutate({ rsvpId: payload.rsvpId });
                      }}
                    />
                  </div>
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Waitlisted Column */}
                    <div className="flex flex-col border-4 border-black bg-amber-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock size={18} className="text-amber-600" /> Waitlisted
                        </span>
                        <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                          {columns.waitlisted.length}
                        </span>
                      </h3>
                      <Droppable droppableId="waitlisted">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                              snapshot.isDraggingOver ? "bg-amber-100/50" : ""
                            }`}
                          >
                            {columns.waitlisted.map((card, index) => (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                      snapshot.isDragging
                                        ? "rotate-2 scale-105 z-50 bg-amber-50/90"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {card.avatarUrl ? (
                                        <img
                                          src={card.avatarUrl}
                                          alt={card.name}
                                          className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                        />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                          {card.name.substring(0, 2)}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-sm font-bold text-black">
                                          {card.name}
                                        </p>
                                        <p className="font-mono text-[9px] text-black/60 uppercase">
                                          {card.rsvpId ? "Requested" : "Waitlist"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-emerald-50 hover:bg-emerald-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "approved",
                                                })
                                              }
                                            >
                                              <CheckCircle size={14} className="text-emerald-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Approve RSVP</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-rose-50 hover:bg-rose-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "rejected",
                                                })
                                              }
                                            >
                                              <X size={14} className="text-rose-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Reject RSVP</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>

                    {/* Approved Column */}
                    <div className="flex flex-col border-4 border-black bg-emerald-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle size={18} className="text-emerald-600" /> Approved
                        </span>
                        <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                          {columns.approved.length}
                        </span>
                      </h3>
                      <Droppable droppableId="approved">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                              snapshot.isDraggingOver ? "bg-emerald-100/50" : ""
                            }`}
                          >
                            {columns.approved.map((card, index) => (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                      snapshot.isDragging
                                        ? "rotate-2 scale-105 z-50 bg-emerald-50/90"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {card.avatarUrl ? (
                                        <img
                                          src={card.avatarUrl}
                                          alt={card.name}
                                          className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                        />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                          {card.name.substring(0, 2)}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-sm font-bold text-black">
                                          {card.name}
                                        </p>
                                        <p className="font-mono text-[9px] text-black/60 uppercase">
                                          Approved
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-amber-50 hover:bg-amber-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "waitlisted",
                                                })
                                              }
                                            >
                                              <Clock size={14} className="text-amber-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Move to Waitlist</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-rose-50 hover:bg-rose-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "rejected",
                                                })
                                              }
                                            >
                                              <X size={14} className="text-rose-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Reject RSVP</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>

                    {/* Rejected Column */}
                    <div className="flex flex-col border-4 border-black bg-rose-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <X size={18} className="text-rose-600" /> Rejected
                        </span>
                        <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                          {columns.rejected.length}
                        </span>
                      </h3>
                      <Droppable droppableId="rejected">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                              snapshot.isDraggingOver ? "bg-rose-100/50" : ""
                            }`}
                          >
                            {columns.rejected.map((card, index) => (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                      snapshot.isDragging
                                        ? "rotate-2 scale-105 z-50 bg-rose-50/90"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {card.avatarUrl ? (
                                        <img
                                          src={card.avatarUrl}
                                          alt={card.name}
                                          className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                        />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                          {card.name.substring(0, 2)}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-sm font-bold text-black">
                                          {card.name}
                                        </p>
                                        <p className="font-mono text-[9px] text-black/60 uppercase">
                                          Rejected
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-amber-50 hover:bg-amber-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "waitlisted",
                                                })
                                              }
                                            >
                                              <Clock size={14} className="text-amber-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Move to Waitlist</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-7 w-7 border border-black rounded-none bg-emerald-50 hover:bg-emerald-200"
                                              onClick={() =>
                                                updateRsvpStatus.mutate({
                                                  userId: card.userId,
                                                  rsvpId: card.rsvpId,
                                                  newStatus: "approved",
                                                })
                                              }
                                            >
                                              <CheckCircle size={14} className="text-emerald-700" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Approve RSVP</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                </DragDropContext>
              </div>
            )}
          </div>
        </section>

        {/* Sticky Mobile RSVP Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-2 border-black bg-white p-4 pb-6 shadow-lg md:hidden">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold uppercase text-black/60">
              {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} going
            </span>
            {isOnWaitlist && waitlistPosition > 0 && (
              <span className="font-mono text-[10px] font-bold text-amber-700">
                Waitlist position: #{waitlistPosition}
              </span>
            )}
          </div>
          {hasRsvpd ? (
            <Button onClick={handleRsvpClick} disabled={toggleRsvp.isPending} variant="secondary">
              {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
            </Button>
          ) : isAtCapacity ? (
            <Button
              onClick={() => {
                if (!user) {
                  toast.error("Please log in to join waitlist");
                  return;
                }
                toggleWaitlist.mutate({ isOnWaitlist });
              }}
              disabled={toggleWaitlist.isPending}
              variant={isOnWaitlist ? "secondary" : "primary"}
            >
              {toggleWaitlist.isPending
                ? "Updating..."
                : isOnWaitlist
                  ? "On Waitlist ✓"
                  : "Join Waitlist"}
            </Button>
          ) : (
            <Button onClick={handleRsvpClick} disabled={toggleRsvp.isPending} variant="primary">
              {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
            </Button>
          )}
        </div>
      </SiteShell>
      {/* RSVP Cancel Confirmation Modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Cancel RSVP"
        description="Are you sure you want to cancel your RSVP for this event? Your spot will be released."
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmOpen(false)}
      />
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        targetType="event"
        targetId={(event as any).id}
      />
      {lightboxSrc && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close enlarged image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => setLightboxSrc(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
              e.preventDefault();
              setLightboxSrc(null);
            }
          }}
        >
          <img
            src={lightboxSrc}
            alt="Enlarged gallery photo"
            className="max-h-full max-w-full object-contain neu-border border-white"
          />
        </div>
      )}
    </LazyMotion>
  );
}
