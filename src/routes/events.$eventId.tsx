import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, setQueryData } from "@/hooks/useReactQueryReplacement";
import { queueRsvpSubmission } from "@/lib/events/offlineRsvpSync";
import {
  consentChoiceToNoMediaConsent,
  getMediaConsentValidationMessage,
  MEDIA_CONSENT_COPY,
  type MediaConsentChoice,
} from "@/lib/mediaConsent";
import { useOfflineRsvpSync } from "@/hooks/useOfflineRsvpSync";
import { incrementEventViews } from "@/lib/supabase/events";
import { uploadImageWithSignedUrl } from "@/lib/supabase/signedUpload";
import { lazy, Suspense, useMemo, useRef } from "react";
import { TableOfContents } from "@/components/events/TableOfContents";
import { NotFound } from "@/components/NotFound";
import { AttendeeVenueMap } from "@/components/events/AttendeeVenueMap";
import LazyHydrate from "@/components/LazyHydrate";
import { User } from "@supabase/supabase-js";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { SiteShell } from "@/components/site/SiteShell";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { EventSeatingManager } from "@/components/events/EventSeatingManager";
import { InteractiveSeatingChart } from "@/components/events/InteractiveSeatingChart";
import { SeatSwapMarketplace } from "@/components/events/SeatSwapMarketplace";
import { formatEventDateRange, getGoogleCalendarUrl } from "@/lib/utils";
import { useBannerColor } from "@/hooks/useBannerColor";
import { MapSkeleton } from "@/components/ui/MapSkeleton";
import { useGeofencedCheckIn } from "@/hooks/useGeofencedCheckIn";
import { calculateHaversineDistance } from "@/lib/scavengerHunt";
import { Helmet } from "react-helmet-async";
import { buildOpenGraphTags } from "@/lib/seo/eventMeta";
const EventMap = lazy(() => import("@/components/EventMap").then((m) => ({ default: m.EventMap })));
import { AddToCalendarDropdown } from "@/components/events/AddToCalendarDropdown";
import { EventCapacityGauge } from "@/components/events/EventCapacityGauge";
import { formatDateLong } from "@/lib/dateFormatter";
import { getRsvpIdempotencyKey, clearRsvpIdempotencyKey } from "@/lib/rsvpIdempotency";
import { toast } from "sonner";
import { ShareMenu } from "@/components/ui/ShareMenu";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import Download from "lucide-react/dist/esm/icons/download";
import LinkIcon from "lucide-react/dist/esm/icons/link";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import MapPinOff from "lucide-react/dist/esm/icons/map-pin-off";
import Users from "lucide-react/dist/esm/icons/users";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import X from "lucide-react/dist/esm/icons/x";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Star from "lucide-react/dist/esm/icons/star";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import Flag from "lucide-react/dist/esm/icons/flag";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import Eye from "lucide-react/dist/esm/icons/eye";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import LiveQA from "@/components/qa/LiveQA";
import { CarpoolMatchingSection } from "@/components/events/carpool/CarpoolMatchingSection";
import { EventLiveChat } from "@/components/events/EventLiveChat";
import { EventSubmissions } from "@/components/EventSubmissions";
import { ReportDialog } from "@/components/ReportDialog";
import { GeofencedCheckInButton } from "@/components/GeofencedCheckInButton";
import Ticket from "lucide-react/dist/esm/icons/ticket";
import { useTicketDownload } from "@/hooks/useTicketDownload";
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
import { SeatingCanvas } from "@/components/events/SeatingCanvas";
import { CrowdDensityMeter } from "@/components/events/CrowdDensityMeter";
import { EventLogisticsChecklist } from "@/components/events/EventLogisticsChecklist";
import { SponsorManager } from "@/components/events/SponsorManager";
import { SteganographicQRScanner } from "@/components/events/SteganographicQRScanner";
import { EventGuestList } from "@/components/events/EventGuestList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/media/OptimizedImage";
import { ImageWithBlur } from "@/components/ui/ImageWithBlur";
import { parseCoordinates } from "@/lib/eventUtils";
import { EventFaqSection } from "@/components/events/EventFaqSection";
import { EventMenuSection } from "@/components/events/EventMenuSection";
import { AccessibilityBadges } from "@/components/events/AccessibilityBadges";
import { ReportAccessibilityIssueDialog } from "@/components/events/ReportAccessibilityIssueDialog";
import { ManageAccessibilityOverridesDialog } from "@/components/events/ManageAccessibilityOverridesDialog";
import EventFeedbackForm from "@/components/EventFeedbackForm";
import EventMetricRatingForm from "@/components/events/EventMetricRatingForm";
import { EventPhotoGallery } from "@/components/EventPhotoGallery";
import SafeEventImage from "@/components/SafeEventImage";
import { PredictiveTurnout } from "@/components/events/PredictiveTurnout";
import { TournamentBracket } from "@/components/events/TournamentBracket";
import {
  buildKanbanColumns,
  buildRsvpStatus,
  buildFeedbackStatus,
  buildWaitlistInfo,
  buildGoogleMapsSearchUrl,
  type EventRsvp,
  type EventWaitlist,
} from "@/lib/eventTransformUtils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DynamicQRCode from "@/components/events/DynamicQRCode";
import { isCaptchaConfigured, shouldRequireCaptcha } from "@/lib/captcha";
import { EditEventDialog } from "@/components/EditEventDialog";
import { DynamicEventPoster } from "@/components/events/DynamicEventPoster";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { ActivePoll } from "@/components/polls/ActivePoll";
import { CaptchaWidget } from "@/components/CaptchaWidget";
import { Blurhash } from "react-blurhash";
import { isValidBlurhash, DEFAULT_FALLBACK_BLURHASH } from "@/lib/blurhashUtils";
import { EventDescriptionTranslation } from "@/components/events/EventDescriptionTranslation";
import { TicketPricingTimeline } from "@/components/events/TicketPricingTimeline";

import { LiveNowBadge } from "@/components/events/LiveNowBadge";
import { isEventLive } from "@/lib/utils";
import { LiveGPSBusTracker } from "@/components/events/LiveGPSBusTracker";

/**
 * Hero banner for the event detail page.
 * Shows a BlurHash placeholder immediately, then cross-fades to the full
 * OptimizedImage once it loads.  OptimizedImage is kept so we retain its
 * AVIF/WebP/responsive-srcset capabilities on the large hero image.
 */
function EventHeroBanner({
  bannerUrl,
  blurhash,
  title,
}: {
  bannerUrl: string;
  blurhash?: string | null;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const { gradientStyle } = useBannerColor(bannerUrl);
  const hash = isValidBlurhash(blurhash) ? (blurhash as string) : DEFAULT_FALLBACK_BLURHASH;

  return (
    <>
      {/* Dynamic Banner Color Overlay (#1744) */}
      <div
        data-testid="banner-dynamic-gradient"
        className="absolute inset-0 z-1 pointer-events-none transition-all duration-700 opacity-80"
        style={{ background: gradientStyle }}
      />
      {/* BlurHash canvas — removed from DOM once real image loads */}
      {!loaded && (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <Blurhash
            hash={hash}
            width="100%"
            height="100%"
            resolutionX={32}
            resolutionY={32}
            punch={1}
          />
        </div>
      )}
      <OptimizedImage
        src={bannerUrl}
        alt={`${title} event banner`}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        width={1344}
        height={700}
        responsiveWidths={[448, 672, 896, 1344]}
        sizes="100vw"
        priority
        onLoad={() => setLoaded(true)}
        fallback={
          <div className="h-full w-full bg-linear-to-br from-peach via-pink-200 to-lime/40" />
        }
      />
    </>
  );
}

interface SimilarEventItem {
  id: string;
  title: string;
  category_id?: string;
  event_date?: string;
  banner_url?: string;
  blurhash?: string | null;
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

        if (!error && Array.isArray(data) && data.length > 0) {
          setSimilarEvents(data as unknown as SimilarEventItem[]);
          setLoading(false);
          return;
        }

        // 2. Fallback to category matching if vector embeddings are not calculated yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("events")
          .select("id, title, category_id, event_date, banner_url, blurhash, description")
          .eq("category_id", categoryId!)
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
              <ImageWithBlur
                src={evt.banner_url}
                blurhash={evt.blurhash}
                alt={evt.title}
                aspectRatio="video"
                className="border-2 border-black mb-3"
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
interface EventSignature {
  id: string;
  event_id: string;
  signer_role: string;
  signer_name: string;
  signer_email: string;
  signature_token: string;
  signed_at: string | null;
  ip_address: string | null;
}

export default function EventDetailsPage() {
  const { eventId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref");
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();
  const [copied, setCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [needAccommodations, setNeedAccommodations] = useState(false);
  const [mediaConsent, setMediaConsent] = useState<MediaConsentChoice | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const hasAttemptedAutoCheckInRef = useRef(false);
  const { checkIn: performAutoCheckIn } = useGeofencedCheckIn();
  const [accommodationsText, setAccommodationsText] = useState("");
  const [validationError, setValidationError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecryptedModalOpen, setIsDecryptedModalOpen] = useState(false);
  const { downloadTicket, isGenerating: isTicketGenerating } = useTicketDownload();

  const handleViewAccommodation = async (rsvpId: string) => {
    setIsDecrypting(true);
    setDecryptError(null);
    setDecryptedText(null);
    setIsDecryptedModalOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("decrypt-accommodation", {
        body: { rsvpId },
      });

      if (error) {
        throw new Error(error.message || "Failed to decrypt accommodation request.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setDecryptedText(data?.decrypted || "No accommodations requested or empty.");
    } catch (err: any) {
      console.error("Failed to decrypt accommodation:", err);
      setDecryptError(err.message || "An unexpected error occurred during decryption.");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Safe window URL handling for SSR / hydration safety
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  // Gallery States and Queries
  interface UploadingFile {
    id: string;
    name: string;
    objectUrl: string;
    progress: number;
    status: "uploading" | "success" | "error";
    errorMsg?: string;
  }

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data: galleryPhotos = [], refetch: refetchGallery } = useQuery<
    { id: string; image_url: string; is_nsfw: boolean }[]
  >({
    queryKey: ["eventGallery", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-")) return [];
      const { data, error } = await supabase
        .from("event_gallery")
        .select("id, image_url, is_nsfw")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch gallery records", error);
        return [];
      }
      return data || [];
    },
    enabled: !!eventId,
  });

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

    const newUploads: UploadingFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      objectUrl: URL.createObjectURL(file),
      progress: 0,
      status: "uploading",
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    const uploadPromises = Array.from(files).map((file, index) => {
      const uploadItem = newUploads[index];
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${eventId}/${fileName}`;

      return new Promise<void>((resolve) => {
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) =>
            prev.map((item) => {
              if (item.id === uploadItem.id && item.status === "uploading" && item.progress < 90) {
                return { ...item, progress: item.progress + 10 };
              }
              return item;
            }),
          );
        }, 200);

        uploadImageWithSignedUrl("event-gallery", filePath, file)
          .then(async () => {
            clearInterval(progressInterval);

            // Insert into event_gallery to trigger moderation
            const publicUrl = supabase.storage.from("event-gallery").getPublicUrl(filePath)
              .data.publicUrl;
            await supabase.from("event_gallery").insert({
              event_id: eventId,
              club_id: event.club_id,
              image_url: publicUrl,
            });

            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadItem.id ? { ...item, status: "success", progress: 100 } : item,
              ),
            );
          })
          .catch((err: unknown) => {
            clearInterval(progressInterval);
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadItem.id
                  ? { ...item, status: "error", progress: 0, errorMsg: errMsg }
                  : item,
              ),
            );
            toast.error(`Error uploading ${file.name}`);
          })
          .finally(() => {
            resolve();
          });
      });
    });

    await Promise.all(uploadPromises);

    refetchGallery();
    setTimeout(() => {
      setUploadingFiles((prev) => prev.filter((item) => item.status !== "success"));
    }, 2000);
  };

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
          id, title, description, event_date, start_date, end_date, location, banner_url, created_by, venue_id, accessibility_features,
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main
          is_high_risk, status, short_id, max_attendees, requires_approval, category_id, tags, version, version_vector, blurhash,

 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 main
          has_photography, is_high_risk, status, short_id, max_attendees, waitlist_capacity, waitlist_count, requires_approval, category_id, tags, version, version_vector, blurhash,
 main
          latitude, longitude, geofencing_enabled, geofence_radius_meters, accommodation_deadline, prerequisite_event_id,
          prerequisite_event:events!prerequisite_event_id(id, title),
          rating_metrics,
          profiles (full_name, email),
          clubs (name, slug, logo_url, primary_color, secondary_color),
          event_rsvps (id, user_id, checked_in, status),
          attendee_count,
          event_metrics (views),
          venues (
            name, building, capacity, accessibility_features, latitude, longitude, geofence_radius_meters
          )
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
            waitlist_capacity: eventId === "mock-1" ? 50 : null,
            waitlist_count: eventId === "mock-1" ? 0 : null,
            latitude: eventId === "mock-1" ? 30.3564 : eventId === "mock-2" ? 28.5355 : 19.076,
            longitude: eventId === "mock-1" ? 76.3647 : eventId === "mock-2" ? 77.209 : 72.8777,
            geofencing_enabled: eventId === "mock-1",
            geofence_radius_meters: 100,
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
            attendee_count: eventId === "mock-1" ? 1 : 0,
            profiles: { full_name: "Mock Organizer", email: "mock@example.com" },
            accommodation_deadline: null,
            event_metrics: { views: 0 },
          };
        }
        throw error;
      }
      return data;
    },
  });

  const { data: venueMapData } = useQuery({
    queryKey: ["eventVenueMap", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      if (!event?.id || event.id.startsWith("mock-")) return { map: null, nodes: [] };

      const { data: mapData, error: mapError } = await supabase
        .from("venue_maps")
        .select("id, background_image_url")
        .eq("event_id", event.id)
        .maybeSingle();

      if (mapError) throw mapError;
      if (!mapData) return { map: null, nodes: [] };

      const { data: nodesData, error: nodesError } = await supabase
        .from("map_nodes")
        .select("id, entity_name, type, x_coord, y_coord, width, height, rotation")
        .eq("map_id", mapData.id);

      if (nodesError) throw nodesError;

      return {
        map: mapData,
        nodes: (nodesData || []).map((node) => ({
          id: node.id,
          entity_name: node.entity_name,
          type: node.type as "table" | "stage" | "boundary" | "booth",
          x_coord: Number(node.x_coord),
          y_coord: Number(node.y_coord),
          width: Number(node.width),
          height: Number(node.height),
          rotation: node.rotation,
        })),
      };
    },
  });

  interface EventSignature {
    id: string;
    event_id: string;
    signer_role: string;
    signer_name: string;
    signer_email: string;
    signature_token: string;
    signed_at: string | null;
    ip_address: string | null;
  }

  const { data: overrides } = useQuery({
    queryKey: ["venue_overrides", event?.venue_id],
    queryFn: async () => {
      if (!event?.venue_id) return [];
      const { data, error } = await supabase
        .from("venue_accessibility_overrides")
        .select("*")
        .eq("venue_id", event.venue_id)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!event?.venue_id,
  });

  const { data: signatures = [], refetch: refetchSignatures } = useQuery({
    queryKey: ["event_signatures", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_signatures")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data || []) as EventSignature[];
    },
    enabled: !!eventId,
  });

  const { data: myRsvp, refetch: refetchMyRsvp } = useQuery({
    queryKey: ["my_rsvp", eventId, user?.id],
    queryFn: async () => {
      if (!user?.id || eventId.startsWith("mock-")) return null;
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!eventId,
  });

  const { data: adminRsvps, refetch: refetchAdminRsvps } = useQuery({
    queryKey: ["admin_rsvps", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-") || !isOrganizer) return [];
      const { data, error } = await supabase
        .from("event_rsvps")
        .select(
          "id, user_id, status, checked_in, rsvp_at, accommodations_requested, profiles (first_name, last_name, avatar_url)",
        )
        .eq("event_id", eventId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId && !!isOrganizer,
  });

  const { data: adminWaitlist, refetch: refetchAdminWaitlist } = useQuery({
    queryKey: ["admin_waitlist", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-") || !isOrganizer) return [];
      const { data, error } = await supabase
        .from("event_waitlist")
        .select("id, user_id, created_at, profiles (first_name, last_name, avatar_url)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId && !!isOrganizer,
  });

  const { data: publicGuests, refetch: refetchPublicGuests } = useQuery({
    queryKey: ["public_event_guests", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-")) return [];
      const { data, error } = await supabase.rpc("get_public_event_guests", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  const { waitlist, isOnWaitlist, waitlistPosition } = useMemo(() => {
    return buildWaitlistInfo(adminWaitlist || [], user?.id);
  }, [adminWaitlist, user]);

  const { data: waitlistScore } = useQuery({
    queryKey: ["waitlist_score", eventId, user?.id],
    queryFn: async () => {
      if (!user?.id || eventId.startsWith("mock-")) return null;
      const { data, error } = await supabase.rpc("get_waitlist_score", {
        p_event_id: eventId,
        p_user_id: user.id,
      });
      if (error) {
        console.error("Error fetching waitlist score:", error);
        return null;
      }
      return data?.[0] || null;
    },
    enabled: !!user?.id && !!eventId && isOnWaitlist,
  });

  const { data: waitlistChurnPrediction } = useQuery({
    queryKey: ["waitlist_churn_prediction", eventId, waitlistPosition],
    queryFn: async () => {
      if (!eventId || waitlistPosition <= 0) return null;
      const { data, error } = await supabase.rpc("predict_waitlist_success", {
        p_event_id: eventId,
        p_user_waitlist_position: waitlistPosition,
      });
      if (error) {
        console.error("Error predicting waitlist churn:", error);
        return null;
      }
      return data?.[0] || null;
    },
    enabled: !!eventId && isOnWaitlist && waitlistPosition > 0,
  });

  // Extract headings from HTML description for TOC
  const tocItems = useMemo(() => {
    if (!event?.description) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(event.description, "text/html");
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

  // Increment persistent view count in event_metrics once per page load.
  // Skipped for mock/dev events (no real DB row).
  //
  // We store the canonical event UUID (event.id) rather than a boolean so that:
  // - Short-id URLs resolve to their UUID before incrementing (avoids wrong PK)
  // - Navigating between events while the component stays mounted still
  //  increments each new event exactly once
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
      const cached = event as any;
      if (cached?.event_metrics) {
        const currentViews = (cached.event_metrics as { views: number } | null)?.views ?? 0;
        setQueryData(["event", eventId], {
          ...cached,
          event_metrics: { views: currentViews + 1 },
        });
      }
    });
  }, [(event as any)?.id, eventId]);

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
      accommodationsRequested,
      mediaConsent,
      referredBy,
    }: {
      eventId: string;
      hasRsvpd: boolean;
      captchaToken?: string;
      accommodationsRequested?: string | null;
      mediaConsent?: MediaConsentChoice | null;
      referredBy?: string | null;
    }) => {
      if (!user) throw new Error("Please log in to RSVP");
      if (eventId.startsWith("mock-")) {
        return;
      }

      const idempotencyKey = getRsvpIdempotencyKey(eventId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      let funcError = null;
      try {
        const { error } = await supabase.functions.invoke("toggle-rsvp", {
          body: {
            eventId,
            hasRsvpd,
            captchaToken,
            accommodationsRequested,
            noMediaConsent:
              mediaConsent === null ? undefined : consentChoiceToNoMediaConsent(mediaConsent),
            referredBy,
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Idempotency-Key": idempotencyKey,
          },
        });
        funcError = error;
      } catch (err: any) {
        if (
          !navigator.onLine ||
          err.message.includes("fetch") ||
          err.message.includes("network") ||
          err.message.includes("Failed to fetch")
        ) {
          await queueRsvpSubmission({
            eventId,
            hasRsvpd,
            captchaToken,
            accommodationsRequested,
            noMediaConsent:
              mediaConsent === null ? undefined : consentChoiceToNoMediaConsent(mediaConsent),
            idempotencyKey,
            queuedAt: Date.now(),
          });
          // Throw a specific error to show offline toast
          throw new Error("OFFLINE_SAVED");
        } else {
          throw err;
        }
      }
      if (funcError) throw funcError;

      if (error) throw error;
      clearRsvpIdempotencyKey(eventId);
    },
    onMutate: async ({ hasRsvpd }) => {
      // Snapshot the previous value
      const previousEvent = event;

      // Optimistically update the cache
      if (event) {
        const eventRsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
        const updatedRsvps = hasRsvpd
          ? eventRsvps.filter((r: any) => r.user_id !== user?.id)
          : [...eventRsvps, { id: `temp-${Date.now()}`, user_id: user?.id || "" }];

        const updatedEvent = {
          ...event,
          event_rsvps: updatedRsvps,
          attendee_count: hasRsvpd
            ? ((event as { attendee_count?: number }).attendee_count || 0) - 1
            : ((event as { attendee_count?: number }).attendee_count || 0) + 1,
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
      if (err?.message === "OFFLINE_SAVED" || error?.message === "OFFLINE_SAVED") {
        toast.success(
          "You're offline. Your RSVP is saved and will sync automatically when you reconnect.",
          { duration: 5000 },
        );
      } else if (
        (typeof err?.message === "string" && err.message.includes("Rate limit")) ||
        (typeof err?.details === "string" && err.details.includes("Rate limit")) ||
        (typeof err?.context === "string" && err.context.includes("Rate limit")) ||
        (typeof error === "string" && error.includes("Rate limit"))
      ) {
        toast.error("Please wait a minute before toggling RSVP again.");
      } else {
        toast.error(
          (err?.message as string) ||
            (error as Error)?.message ||
            "Failed to update RSVP. Please try again.",
        );
      }
    },
    onSuccess: () => {
      // Refetch to ensure server state matches
      refetch();
      setRsvpDialogOpen(false);
      setNeedAccommodations(false);
      setAccommodationsText("");
      setMediaConsent(null);
      setValidationError("");
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

      // Ensure we have a Blob
      return data instanceof Blob ? data : new Blob([data], { type: "text/csv" });
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event_${event!.id}_rsvps.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("RSVP list downloaded successfully!");
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
          // Distinguishes this manual/QR-adjacent organizer action from an
          // attendee's own GPS-verified self check-in (see check_in_via_geofence).
          verification_method: "organizer_override",
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

  const isOrganizer = user && event?.created_by === user.id;

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
  }, [eventId, event?.created_by, user?.id, supabase, refetch, isOrganizer]);

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
      rsvpId?: string;
    }[];
    rejected: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId?: string;
    }[];
  }>({ waitlisted: [], approved: [], rejected: [] });

  useEffect(() => {
    setColumns(buildKanbanColumns((adminWaitlist as any) || [], (adminRsvps as any) || []));
  }, [adminWaitlist, adminRsvps]);

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
      refetchMyRsvp();
      refetchAdminRsvps();
      refetchPublicGuests();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP status.");
      refetchMyRsvp();
      refetchAdminRsvps();
      refetchPublicGuests();
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
      <SiteShell>
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
      </SiteShell>
    );
  }

  const rsvps = adminRsvps || [];
  const hasRsvpd = !!myRsvp && (myRsvp.status === "attending" || myRsvp.status === "waitlisted");
  const isCheckedIn = !!myRsvp && myRsvp.checked_in;
  const hasEnded = new Date().getTime() > new Date(event.end_date).getTime();
  const myRsvpId = myRsvp?.id;
  const rawFeedbacks = (event as Record<string, unknown>).event_feedbacks;
  const { hasSubmittedFeedback } = buildFeedbackStatus(
    Array.isArray(rawFeedbacks) ? (rawFeedbacks as { user_id: string }[]) : undefined,
    user?.id,
  );
  const eventUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${import.meta.env.VITE_SITE_URL ?? ""}/events/${event.short_id ?? event.id}`;

  const ogTags = buildOpenGraphTags({
    title: event.title,
    description: event.description,
    bannerUrl: event.banner_url,
    eventDate: event.event_date,
    location: event.location,
    url: eventUrl,
    eventId: event.id,
  });

  const rawWaitlist = adminWaitlist || [];

  const club = event.clubs ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
  const coordsCheck = event.location
    ? parseCoordinates(event.location)
    : { isCoordinates: false, isValid: true };

  const isWithinCheckInWindow = useMemo(() => {
    if (!event?.start_date) return false;
    const now = new Date().getTime();
    const startTime = new Date(event.start_date).getTime();
    return now >= startTime - 60 * 60 * 1000 && !hasEnded;
  }, [event?.start_date, hasEnded]);

  const triggerAutoCheckIn = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const venueObj = Array.isArray(event.venues) ? event.venues[0] : event.venues;
        const targetLat = venueObj?.latitude ?? event.latitude;
        const targetLng = venueObj?.longitude ?? event.longitude;
        const targetRadius =
          venueObj?.geofence_radius_meters ?? event.geofence_radius_meters ?? 100;

        if (targetLat != null && targetLng != null) {
          const distance = calculateHaversineDistance(latitude, longitude, targetLat, targetLng);
          if (distance <= targetRadius) {
            try {
              const res = await performAutoCheckIn(myRsvpId!);
              if (res.status === "success" || res.status === "already_checked_in") {
                toast.success("Welcome! You have been automatically checked in.");
                refetch();
              }
            } catch (err) {
              console.error("Auto check-in verification failed:", err);
            }
          } else {
            toast.error(
              `You are too far from the venue to check in (${Math.round(distance)}m away).`,
            );
          }
        }
      },
      (error) => {
        toast.error("Location access failed. Please check your browser location permissions.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [event, myRsvpId, performAutoCheckIn, refetch]);

  useEffect(() => {
    if (
      event?.geofencing_enabled &&
      hasRsvpd &&
      myRsvpId &&
      !isCheckedIn &&
      isWithinCheckInWindow &&
      !hasAttemptedAutoCheckInRef.current
    ) {
      hasAttemptedAutoCheckInRef.current = true;
      setShowLocationPrompt(true);
    }
  }, [event?.geofencing_enabled, hasRsvpd, myRsvpId, isCheckedIn, isWithinCheckInWindow]);

  const captchaSiteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY || import.meta.env.VITE_HCAPTCHA_SITE_KEY;
  const captchaSecretKey =
    import.meta.env.VITE_TURNSTILE_SECRET_KEY || import.meta.env.VITE_HCAPTCHA_SECRET_KEY;
  const captchaEnabled = isCaptchaConfigured(captchaSiteKey, captchaSecretKey);
  const captchaProvider = import.meta.env.VITE_TURNSTILE_SITE_KEY ? "turnstile" : "hcaptcha";

  const isAfterDeadline = useMemo(() => {
    if (!event?.accommodation_deadline) return false;
    return new Date().getTime() > new Date(event.accommodation_deadline).getTime();
  }, [event?.accommodation_deadline]);

  const [isWalletDownloading, setIsWalletDownloading] = useState(false);

  const handleAddToAppleWallet = async () => {
    if (!user || !event) return;
    setIsWalletDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${getSupabaseUrl()}/functions/v1/generate-wallet-pass?type=apple&passType=event&eventId=${event.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate Apple Wallet pass");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${event.id}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Wallet ticket downloaded successfully!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download Wallet ticket");
    } finally {
      setIsWalletDownloading(false);
    }
  };

  const handleAddToGoogleWallet = async () => {
    if (!user || !event) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${getSupabaseUrl()}/functions/v1/generate-wallet-pass?type=google&passType=event&eventId=${event.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate Google Wallet ticket");
      }

      const data = await response.json();
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Google Wallet link opened!");
      } else {
        throw new Error("No URL returned");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate Google Wallet ticket",
      );
    }
  };

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

    // Open accommodations dialog instead of immediate submit
    setNeedAccommodations(false);
    setAccommodationsText("");
    setMediaConsent(null);
    setValidationError("");
    setRsvpDialogOpen(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl || window.location.href);
      setCopied(true);
      toast.success("Event link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(event.id);
      setIdCopied(true);
      toast.success("Event ID copied to clipboard!");
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      toast.error("Failed to copy event ID.");
    }
  };
  const handleConfirmCancel = () => {
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: true });
    setConfirmOpen(false);
  };

  const attendeeCount =
    ((event as Record<string, unknown>).attendee_count as number) ?? (publicGuests?.length || 0);
  const maxAttendees = (event as Record<string, unknown>).max_attendees as
    number | null | undefined;
  const isAtCapacity =
    maxAttendees !== null &&
    maxAttendees !== undefined &&
    maxAttendees > 0 &&
    attendeeCount >= maxAttendees;

  const waitlistCapacity = (event as Record<string, unknown>).waitlist_capacity as
    number | null | undefined;
  const waitlistCount =
    ((event as Record<string, unknown>).waitlist_count as number) ?? (rawWaitlist?.length || 0);
  const isWaitlistFull =
    waitlistCapacity !== null &&
    waitlistCapacity !== undefined &&
    waitlistCapacity > 0 &&
    waitlistCount >= waitlistCapacity;

  const isLive = isEventLive(event);

  return (
    <>
      <Helmet>
        <title>{ogTags.ogTitle}</title>

        <meta name="description" content={ogTags.ogDescription} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTags.ogTitle} />
        <meta property="og:description" content={ogTags.ogDescription} />
        <meta property="og:url" content={ogTags.ogUrl} />

        {ogTags.ogImage && (
          <>
            <meta property="og:image" content={ogTags.ogImage} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:type" content="image/png" />
          </>
        )}

        {ogTags.eventStartTime && (
          <meta property="event:start_time" content={ogTags.eventStartTime} />
        )}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTags.ogTitle} />
        <meta name="twitter:description" content={ogTags.ogDescription} />

        {ogTags.ogImage && <meta name="twitter:image" content={ogTags.ogImage} />}
      </Helmet>

      <SiteShell>
        {" "}
        {/* Breadcrumb nav */}
        <nav className="border-b-2 border-black bg-white px-4 py-4 md:px-6" aria-label="Breadcrumb">
          <div className="mx-auto max-w-4xl">
            {/* Mobile: simple back link */}
            <Link
              to="/events"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider hover:underline sm:hidden"
            >
              <ArrowLeft size={14} /> Events
            </Link>
            {/* sm+: full breadcrumb */}
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/" className="font-mono text-xs font-bold uppercase">
                      Home
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/events" className="font-mono text-xs font-bold uppercase">
                      Events
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-mono text-xs font-bold uppercase">
                    {event.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </nav>
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden border-b-2 border-black bg-peach/30">
          {event.banner_url ? (
            <div className="absolute inset-0">
              <EventHeroBanner
                bannerUrl={event.banner_url}
                blurhash={(event as { blurhash?: string | null }).blurhash}
                title={event.title}
              />
              <div className="absolute inset-0 bg-black/50" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-peach via-pink-200 to-lime/40" />
          )}

          <div className="relative mx-auto flex min-h-[50vh] max-w-4xl flex-col justify-end px-4 py-16 md:min-h-[60vh] md:px-6 md:py-24">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="neu-border inline-block bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black">
                Event Details
              </span>
              {isLive && <LiveNowBadge>Live Now</LiveNowBadge>}
            </div>

            <div className="flex items-center gap-3">
              <h1
                className={`text-4xl font-black tracking-tight md:text-6xl ${event.banner_url ? "text-white" : "text-black"}`}
              >
                {event.title}
              </h1>
              <ShareMenu url={shareUrl} title={event.title} eventId={event.id} />
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
                      {idCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                className={`mt-4 font-mono text-base font-bold ${event.banner_url ? "text-white/90" : "text-black/80"}`}
              >
                Organized by:{" "}
                <Link to={`/clubs/${club.slug}`} className="underline hover:opacity-80">
                  {club.name}
                </Link>
              </p>
            )}

            {!club && event.profiles && (
              <div
                className={`mt-4 font-mono text-base font-bold ${event.banner_url ? "text-white/90" : "text-black/80"} flex items-center gap-4`}
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
              className={`mt-8 flex flex-wrap gap-4 font-mono text-sm font-bold sm:gap-8 ${event.banner_url ? "text-white" : "text-black"}`}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>{formatEventDateRange(event)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>{event.location || "TBA"}</span>
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
                eventId={event.id}
                initialCapacity={attendeeCount}
                maxAttendees={maxAttendees || null}
                showDetails={true}
              />
            </div>

            <div className="mt-6 max-w-md">
              <TicketPricingTimeline eventId={event.id} />
            </div>

            {hasRsvpd && myRsvpId && !isCheckedIn && !hasEnded && (
              <div className="mt-6 max-w-md">
                <GeofencedCheckInButton
                  rsvpId={myRsvpId}
                  geofencingEnabled={Boolean((event as any).geofencing_enabled)}
                  onCheckedIn={() => refetch()}
                />
              </div>
            )}

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
                <Button
                  onClick={() => {
                    if (!user) {
                      toast.error("Please log in to join waitlist");
                      return;
                    }
                    if (!prereqMet) {
                      toast.error(`You must attend '${prereqTitle}' before joining waitlist.`);
                      return;
                    }
                    toggleWaitlist.mutate({ isOnWaitlist });
                  }}
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main

 main
                  disabled={toggleWaitlist.isPending || !prereqMet}
                  variant={isOnWaitlist ? "secondary" : "primary"}
                  size="lg"
                  title={!prereqMet ? `You must attend '${prereqTitle}' before registering for this event.` : undefined}
                  className={!prereqMet ? "opacity-50 cursor-not-allowed" : ""}

 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 main
                  disabled={
                    toggleWaitlist.isPending || !prereqMet || (!isOnWaitlist && isWaitlistFull)
                  }
                  variant={isOnWaitlist ? "secondary" : "primary"}
                  size="lg"
                  title={
                    !prereqMet
                      ? `You must attend '${prereqTitle}' before registering for this event.`
                      : undefined
                  }
                  className={
                    !prereqMet || (!isOnWaitlist && isWaitlistFull)
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }
 main
                >
                  {toggleWaitlist.isPending
                    ? "Updating..."
                    : isOnWaitlist
                      ? "On Waitlist ✓"
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main

 main
                      : "Join Waitlist"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!prereqMet && !hasRsvpd) {
                      toast.error(`You must attend '${prereqTitle}' before registering for this event.`);
                      return;
                    }
                    handleRsvpClick();
                  }}
                  disabled={toggleRsvp.isPending || !prereqMet}
                  variant="primary"
                  size="lg"
                  title={!prereqMet && !hasRsvpd ? `You must attend '${prereqTitle}' before registering for this event.` : undefined}
                  className={!prereqMet && !hasRsvpd ? "opacity-50 cursor-not-allowed relative group" : ""}
                >
                  {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
                </Button>
              )}
                  {isOnWaitlist && (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded bg-amber-50 p-4 border-2 border-amber-300">
                      <p className="font-mono text-sm font-bold text-amber-900">
                        Priority Score: {waitlistScore?.total_score || "..."}
                      </p>
 feature/club-lifecycle-monitor-3610

                      {waitlistChurnPrediction && (
                        <p className={`font-mono text-xs font-bold ${
                          waitlistChurnPrediction.probability_percentage >= 70 ? "text-emerald-700" :
                          waitlistChurnPrediction.probability_percentage >= 30 ? "text-amber-700" :
                          "text-rose-700"
                        }`}>
                          {waitlistChurnPrediction.message}
                        </p>
                      )} main
                      <p className="text-center text-xs text-amber-800/80 max-w-xs leading-relaxed">
                        Your position is determined by:
                        <br />
                        • Time on waitlist
                        <br />
                        • Club membership
                        <br />
                        • Attendance streak
                        <br />• Graduation status
                      </p>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs border-amber-400 text-amber-900 hover:bg-amber-100 font-bold tracking-tight"
                          >
                            View Score Breakdown
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md border-4 border-black shadow-[8px_8px_0_0_#000]">
                          <DialogHeader>
                            <DialogTitle className="font-display uppercase text-2xl tracking-tight text-black">
                              Priority Score Breakdown
                            </DialogTitle>
                            <DialogDescription className="font-mono text-gray-600">
                              How your waitlist priority is calculated.
                            </DialogDescription>
                          </DialogHeader>
                          {waitlistScore ? (
                            <div className="flex flex-col gap-3 font-mono text-sm my-4 text-black">
                              <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                                <span>Time on waitlist ({waitlistScore.waitlist_hours}h)</span>
                                <span className="font-bold text-blue-600">
                                  +{waitlistScore.time_score}
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                                <span>Active club member</span>
                                <span className="font-bold text-lime-600">
                                  +{waitlistScore.membership_score}
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                                <span>Attendance streak</span>
                                <span className="font-bold text-orange-600">
                                  +{waitlistScore.streak_score}
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b-2 border-black pb-2">
                                <span>Graduating senior</span>
                                <span className="font-bold text-purple-600">
                                  +{waitlistScore.senior_score}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-2 text-lg font-black uppercase">
                                <span>Total Score</span>
                                <span>{waitlistScore.total_score}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 text-center font-mono text-gray-500">
                              Loading score...
                            </div>
                          )}
                          <DialogFooter className="sm:justify-start">
                            <Button
                              variant="outline"
                              className="w-full font-bold uppercase border-2 border-black shadow-[4px_4px_0_0_#000]"
                            >
                              Close
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={() => {
                      if (!prereqMet && !hasRsvpd) {
                        toast.error(`You must attend '${prereqTitle}' before registering for this event.`);
                        return;
                      }
                      handleRsvpClick();
                    }}
                    disabled={toggleRsvp.isPending || !prereqMet}
                    variant="primary"
                    size="lg"
                    title={!prereqMet && !hasRsvpd ? `You must attend '${prereqTitle}' before registering for this event.` : undefined}
                    className={!prereqMet && !hasRsvpd ? "opacity-50 cursor-not-allowed relative group" : ""}
                  >
                    {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
                  </Button>
                  {captchaEnabled && (
                    <div className="flex flex-col gap-2">
                      <span
                        className={`font-mono text-xs font-bold ${event.banner_url ? "text-white/80" : "text-black/60"}`}

                      : isWaitlistFull
                        ? "Waitlist Full"
                        : "Join Waitlist"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!prereqMet && !hasRsvpd) {
                      toast.error(
                        `You must attend '${prereqTitle}' before registering for this event.`,
                      );
                      return;
                    }
                    handleRsvpClick();
                  }}
                  disabled={toggleRsvp.isPending || !prereqMet}
                  variant="primary"
                  size="lg"
                  title={
                    !prereqMet && !hasRsvpd
                      ? `You must attend '${prereqTitle}' before registering for this event.`
                      : undefined
                  }
                  className={
                    !prereqMet && !hasRsvpd ? "opacity-50 cursor-not-allowed relative group" : ""
                  }
                >
                  {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
                </Button>
              )}
              {isOnWaitlist && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded bg-amber-50 p-4 border-2 border-amber-300">
                  <p className="font-mono text-sm font-bold text-amber-900">
                    Priority Score: {waitlistScore?.total_score || "..."}
                  </p>
                  <p className="text-center text-xs text-amber-800/80 max-w-xs leading-relaxed">
                    Your position is determined by:
                    <br />
                    • Time on waitlist
                    <br />
                    • Club membership
                    <br />
                    • Attendance streak
                    <br />• Graduation status
                  </p>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs border-amber-400 text-amber-900 hover:bg-amber-100 font-bold tracking-tight"
 main
                      >
                        View Score Breakdown
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md border-4 border-black shadow-[8px_8px_0_0_#000]">
                      <DialogHeader>
                        <DialogTitle className="font-display uppercase text-2xl tracking-tight text-black">
                          Priority Score Breakdown
                        </DialogTitle>
                        <DialogDescription className="font-mono text-gray-600">
                          How your waitlist priority is calculated.
                        </DialogDescription>
                      </DialogHeader>
                      {waitlistScore ? (
                        <div className="flex flex-col gap-3 font-mono text-sm my-4 text-black">
                          <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                            <span>Time on waitlist ({waitlistScore.waitlist_hours}h)</span>
                            <span className="font-bold text-blue-600">
                              +{waitlistScore.time_score}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                            <span>Active club member</span>
                            <span className="font-bold text-lime-600">
                              +{waitlistScore.membership_score}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                            <span>Attendance streak</span>
                            <span className="font-bold text-orange-600">
                              +{waitlistScore.streak_score}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b-2 border-black pb-2">
                            <span>Graduating senior</span>
                            <span className="font-bold text-purple-600">
                              +{waitlistScore.senior_score}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 text-lg font-black uppercase">
                            <span>Total Score</span>
                            <span>{waitlistScore.total_score}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center font-mono text-gray-500">
                          Loading score...
                        </div>
                      )}
                      <DialogFooter className="sm:justify-start">
                        <Button
                          variant="outline"
                          className="w-full font-bold uppercase border-2 border-black shadow-[4px_4px_0_0_#000]"
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              <span
                className={`font-mono text-sm font-bold ${event.banner_url ? "text-white/80" : "text-black/60"}`}
              >
                {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} people going
                {isAtCapacity && !hasRsvpd && " (At Capacity)"}
              </span>
            </div>
          </div>
        </section>
        <section className="bg-cream px-4 py-8 md:px-6">
          <TournamentBracket />
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
                      {copied ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <LinkIcon className="mr-2 h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy Link"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy Event Link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Download Ticket — visible to confirmed attendees of upcoming/ongoing events */}
              {hasRsvpd && !hasEnded && (
                <Button
                  onClick={() =>
                    downloadTicket({
                      ...event,
                      noMediaConsent: myRsvp?.no_media_consent === true,
                    })
                  }
                  disabled={isTicketGenerating}
                  variant="outline"
                  className="neu-border neu-press h-12 bg-lime px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  {isTicketGenerating ? "Generating…" : "Download Ticket"}
                </Button>
              )}

              {isOrganizer && (
                <>
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
                  <EditEventDialog event={event} user={user} onSuccess={() => refetch()} />
                  <DynamicEventPoster
                    event={{
                      id: event.id,
                      title: event.title,
                      event_date: event.event_date,
                      start_date: event.start_date,
                      end_date: event.end_date,
                      location: event.location,
                    }}
                    club={club}
                    eventUrl={shareUrl}
                  />
                  <Link
                    to={`/events/${eventId}/builder`}
                    className="neu-border neu-press flex h-12 items-center justify-center bg-sky px-5 font-mono text-sm font-bold uppercase tracking-wider text-black transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Layout Builder
                  </Link>
                </>
              )}

              <AddToCalendarDropdown
                event={{
                  id: eventId,
                  title: event.title,
                  description: event.description || "",
                  event_date: event.event_date || "",
                  start_date: event.start_date,
                  end_date: event.end_date,
                  location: event.location || "",
                  eventUrl: typeof window !== "undefined" ? window.location.href : undefined,
                }}
                variant="outline"
              />

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
                        How was {event.title}? Share your experience!
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

              {hasRsvpd && (
                <>
                  <button
                    onClick={handleAddToAppleWallet}
                    disabled={isWalletDownloading}
                    className="neu-border flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <CreditCard aria-hidden="true" size={14} strokeWidth={3} />
                    {isWalletDownloading ? "Adding..." : "Add to Apple Wallet"}
                  </button>
                  <button
                    onClick={handleAddToGoogleWallet}
                    className="neu-border flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <CreditCard aria-hidden="true" size={14} strokeWidth={3} />
                    Add to Google Wallet
                  </button>
                </>
              )}
            </div>

            {isOrganizer && (
              <div className="mt-8 space-y-8">
                <EventLogisticsChecklist eventId={event.id} />
                <PredictiveTurnout
                  rsvpCount={attendeeCount}
                  latitude={(event as Record<string, unknown>).latitude as number | null}
                  longitude={(event as Record<string, unknown>).longitude as number | null}
                  location={event.location || ""}
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
              <LiveQA eventId={eventId} userId={user?.id} isOrganizer={isOrganizer} />
            </div>

            {/* Transportation / Carpool Matching (Issue #2877) */}
            <div className="mt-8">
              <LiveGPSBusTracker
                eventId={eventId}
                isCaptain={isOrganizer}
                eventTitle={event.title}
              />
            </div>

            <div className="mt-8">
              <CarpoolMatchingSection eventId={eventId} user={user} />
            </div>

            {/* Live Chat (Issue #2741) */}
            <div className="mt-8">
              <EventLiveChat eventId={eventId} user={user} />
            </div>

            {/* Public Guest List */}
            <div className="mt-8">
              <EventGuestList eventId={eventId} />
            </div>

            {/* Secure File Drop for Competitions (Issue #3006) */}
            <div className="mt-8">
              <EventSubmissions
                eventId={eventId}
                submissionDeadline={(event as any).submission_deadline}
                userRsvp={!!userRsvp}
                isOrganizer={isOrganizer}
              />
            </div>
            {/* Description */}
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                About the Event
              </h2>
              <div className="flex flex-col gap-8 lg:flex-row">
                <main className="flex-1 min-w-0">
                  {event.description ? (
                    <EventDescriptionTranslation
                      eventId={event.id}
                      description={event.description}
                    />
                  ) : (
                    <p className="mt-4 font-mono text-sm italic text-black/40">
                      No description provided for this event.
                    </p>
                  )}
                </main>
                <aside className="lg:w-64 shrink-0">
                  <TableOfContents items={tocItems} />
                </aside>
              </div>
            </div>

            <EventSeatingManager eventId={event.id} isOrganizer={isOrganizer} />

            <CrowdDensityMeter eventId={event.id} />

            <InteractiveSeatingChart eventId={event.id} user={user} />
            <SeatSwapMarketplace eventId={event.id} user={user} />

            {/* Interactive venue map layout for attendees */}
            {venueMapData && venueMapData.nodes && venueMapData.nodes.length > 0 ? (
              <div className="mt-10 border-t-2 border-black pt-8">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-4">
                  Floor Plan / Venue Layout
                </h2>
                <AttendeeVenueMap
                  nodes={venueMapData.nodes}
                  backgroundImageUrl={venueMapData.map?.background_image_url}
                />
              </div>
            ) : event.map_layout &&
              Array.isArray(event.map_layout) &&
              event.map_layout.length > 0 ? (
              <div className="mt-10 border-t-2 border-black pt-8">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-4">
                  Floor Plan / Venue Layout
                </h2>
                <div
                  className="relative border-4 border-black bg-white shadow-[4px_4px_0_0_#000] overflow-hidden mx-auto max-w-full"
                  style={{
                    width: "100%",
                    height: "400px",
                    backgroundImage: "radial-gradient(#000 6%, transparent 7%)",
                    backgroundSize: "20px 20px",
                  }}
                >
                  <div
                    className="absolute inset-0 overflow-auto p-4"
                    style={{ minWidth: "800px", minHeight: "600px" }}
                  >
                    {event.map_layout.map((element: any) => {
                      const colors = {
                        table: "bg-amber-100",
                        stage: "bg-indigo-100",
                        boundary: "bg-red-50",
                        booth: "bg-emerald-100",
                      };
                      return (
                        <div
                          key={element.id}
                          style={{
                            position: "absolute",
                            left: `${element.x}px`,
                            top: `${element.y}px`,
                            width: `${element.width}px`,
                            height: `${element.height}px`,
                            transform: `rotate(${element.rotation || 0}deg)`,
                            zIndex: element.zIndex || 10,
                          }}
                          className={`border-2 border-black flex flex-col items-center justify-center p-1 text-center shadow-[1px_1px_0_0_#000] text-[9px] font-mono uppercase font-bold leading-none ${colors[element.type as "table"] || "bg-white"}`}
                        >
                          <span>{element.label}</span>
                          <span className="opacity-75 text-[7px] mt-0.5">{element.type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

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
            {event.location && event.location.toLowerCase() !== "online" && (
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
                          locationName={event.location}
                        />
                      </Suspense>
                    </LazyHydrate>
                    <a
                      href={buildGoogleMapsSearchUrl(event.location)}
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
                        The coordinates provided (<code>{event.location}</code>) are invalid.
                        Latitude must be between -90 and 90, and Longitude between -180 and 180.
                      </p>
                      <a
                        href={buildGoogleMapsSearchUrl(event.location)}
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
                    href={buildGoogleMapsSearchUrl(event.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neu-border mt-4 inline-flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <MapPin className="h-4 w-4" />
                    Open &quot;{event.location}&quot; in Google Maps ↗
                  </a>
                )}
              </div>
            )}

            {/* Event Feedback (Only if ended and user RSVP'd) */}
            {user &&
              hasRsvpd &&
              event.end_date &&
              new Date(event.end_date).getTime() < Date.now() && (
                <div className="mt-10 space-y-8">
                  <EventMetricRatingForm
                    eventId={event.id}
                    user={user}
                    metrics={
                      (event as Record<string, unknown>).rating_metrics as string[] | undefined
                    }
                  />
                  <EventFeedbackForm eventId={event.id} user={user} />
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

              {/* Accessibility Features */}
              {(event.venues?.accessibility_features || event.accessibility_features) && (
                <div className="mt-8">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
                    <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                      Accessibility
                    </h2>
                    <div className="flex items-center gap-2">
                      <ReportAccessibilityIssueDialog
                        eventId={event.id}
                        venueId={event.venue_id}
                        user={user}
                      />
                      {isOrganizer && event.venue_id && (
                        <ManageAccessibilityOverridesDialog venueId={event.venue_id} user={user} />
                      )}
                    </div>
                  </div>
                  <AccessibilityBadges
                    features={event.venues?.accessibility_features || event.accessibility_features}
                    overrides={overrides || []}
                  />
                </div>
              )}
              {event.is_high_risk && (
                <div className="mt-8 border-2 border-black bg-yellow-50 p-6 font-mono text-sm">
                  <h2 className="text-xl font-bold uppercase tracking-tight text-black mb-3">
                    Co-Signer Approvals
                  </h2>
                  <p className="text-xs text-gray-700 mb-4">
                    This is a high-risk event. It will be published once all required stakeholders
                    sign off.
                  </p>
                  <div className="space-y-3">
                    {signatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/20 pb-2"
                      >
                        <div>
                          <span className="font-bold text-black">{sig.signer_role}</span>:{" "}
                          {sig.signer_name} ({sig.signer_email})
                        </div>
                        <div className="mt-1 sm:mt-0 flex items-center gap-3">
                          {sig.signed_at ? (
                            <span className="bg-green-100 text-green-800 border border-green-800 px-2 py-0.5 font-bold uppercase text-xs">
                              Signed ✓
                            </span>
                          ) : (
                            <>
                              <span className="bg-red-100 text-red-800 border border-red-800 px-2 py-0.5 font-bold uppercase text-xs">
                                Pending
                              </span>
                              <a
                                href={`${getSupabaseUrl()}/functions/v1/co-signer-approval?token=${sig.signature_token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white hover:bg-cream border border-black px-2 py-0.5 text-xs font-bold uppercase underline"
                              >
                                Approval Link ↗
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 p-2">
                            <span className="font-mono text-xs font-bold text-white mb-2">
                              {file.progress}%
                            </span>
                            <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-lime h-full transition-all duration-200"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
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
                            <span className="font-mono text-[9px] text-center mt-1 truncate w-full">
                              {file.errorMsg}
                            </span>
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
                  {galleryPhotos.map((photo, idx: number) => (
                    <div
                      key={photo.id}
                      className="neu-border bg-white p-2 hover:scale-[1.02] transition-transform duration-300 group cursor-zoom-in"
                      onClick={() => {
                        if (!photo.is_nsfw) {
                          setLightboxSrc(photo.image_url);
                        }
                      }}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-cream">
                        <SafeEventImage
                          id={photo.id}
                          src={photo.image_url}
                          alt={`Event gallery photo ${idx + 1}`}
                          initialIsNsfw={photo.is_nsfw}
                          isAdmin={isClubAdmin}
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Social Share */}
            <div className="mt-10 border-t-2 border-black pt-6 space-y-6">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase text-blue-900">
                  Share with Friends
                </h3>
                <div className="mt-4">
                  <ShareMenu
                    url={shareUrl}
                    title={event.title}
                    text={`Check out this event: ${event.title}`}
                    eventId={event.id}
                  />{" "}
                </div>
              </div>
              <div className="border-t border-black/10 pt-4">
                <h3 className="font-mono text-xs font-bold uppercase text-blue-900 mb-2">
                  Referral Invite Link 🎁
                </h3>
                <p className="text-xs font-mono text-gray-500 mb-3">
                  Invite friends to earn 50 Gamification Points for both of you when they RSVP!
                </p>
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      const refUrl = `${window.location.origin}/events/${event.id}?ref=${user.id}`;
                      navigator.clipboard.writeText(refUrl);
                      toast.success("Referral invite link copied to clipboard!");
                    }}
                    className="neu-border neu-press w-full bg-[#a3e635] p-2.5 font-mono text-xs font-bold uppercase text-black"
                  >
                    Generate & Copy Invite Link
                  </button>
                ) : (
                  <p className="text-xs font-mono text-gray-400 italic">
                    Log in to generate your unique invite link and earn points.
                  </p>
                )}
              </div>
              {/* Event Live Support Reporting Card */}
              <div className="border-t border-black/10 pt-4 space-y-3 text-black">
                <h3 className="font-mono text-xs font-bold uppercase text-red-600">
                  Event Live Support 🚨
                </h3>
                <p className="text-xs font-mono text-gray-500">
                  Experiencing an issue during the event? Report it instantly to the organizers.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {["🎙️ Mic Broken", "❄️ Too Cold", "🔥 Too Hot", "🔊 Too Quiet"].map((label) => (
                    <button
                      key={label}
                      onClick={async () => {
                        const { error } = await supabase.from("event_live_tickets").insert({
                          event_id: event.id,
                          user_id: user?.id || null,
                          message: label,
                          status: "open",
                        });
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success("Issue reported! Organizers have been notified.");
                        }
                      }}
                      className="border border-black bg-white hover:bg-red-50 text-[10px] font-mono font-bold uppercase px-2 py-1 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Report another issue..."
                    className="w-full border-2 border-black p-2 font-mono text-xs focus:outline-none"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const target = e.currentTarget;
                        if (!target.value.trim()) return;
                        const { error } = await supabase.from("event_live_tickets").insert({
                          event_id: event.id,
                          user_id: user?.id || null,
                          message: target.value.trim(),
                          status: "open",
                        });
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success("Issue reported! Organizers have been notified.");
                          target.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="border-t border-black/10 pt-4">
                <EventFaqSection eventId={event.id} isOrganizer={isOrganizer} userId={user?.id} />
              </div>
              <EventMenuSection eventId={event.id} isOrganizer={isOrganizer} />{" "}
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
                                          {card.hasAccommodation && card.rsvpId && (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                              <span className="font-mono text-[10px] font-bold text-red-600 flex items-center gap-1 select-none">
                                                🔴 Accessibility accommodation requested
                                              </span>
                                              <button
                                                type="button"
                                                className="w-fit text-[10px] font-bold underline hover:text-black/60 font-mono uppercase text-left cursor-pointer"
                                                onClick={() =>
                                                  handleViewAccommodation(card.rsvpId!)
                                                }
                                              >
                                                [Decrypt / View]
                                              </button>
                                            </div>
                                          )}
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
                                                <CheckCircle
                                                  size={14}
                                                  className="text-emerald-700"
                                                />
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
                                          {card.hasAccommodation && card.rsvpId && (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                              <span className="font-mono text-[10px] font-bold text-red-600 flex items-center gap-1 select-none">
                                                🔴 Accessibility accommodation requested
                                              </span>
                                              <button
                                                type="button"
                                                className="w-fit text-[10px] font-bold underline hover:text-black/60 font-mono uppercase text-left cursor-pointer"
                                                onClick={() =>
                                                  handleViewAccommodation(card.rsvpId!)
                                                }
                                              >
                                                [Decrypt / View]
                                              </button>
                                            </div>
                                          )}
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
                                          {card.hasAccommodation && card.rsvpId && (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                              <span className="font-mono text-[10px] font-bold text-red-600 flex items-center gap-1 select-none">
                                                🔴 Accessibility accommodation requested
                                              </span>
                                              <button
                                                type="button"
                                                className="w-fit text-[10px] font-bold underline hover:text-black/60 font-mono uppercase text-left cursor-pointer"
                                                onClick={() =>
                                                  handleViewAccommodation(card.rsvpId!)
                                                }
                                              >
                                                [Decrypt / View]
                                              </button>
                                            </div>
                                          )}
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
                                                <CheckCircle
                                                  size={14}
                                                  className="text-emerald-700"
                                                />
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
          </div>
        </section>
        {/* Sticky Mobile RSVP Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-2 border-black bg-white p-4 pb-6 shadow-lg md:hidden">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold uppercase text-black/60">
              {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} going
            </span>
            {isOnWaitlist && waitlistPosition > 0 && (
              <div className="flex flex-col">
                <span className="font-mono text-[10px] font-bold text-amber-700">
                  Waitlist position: #{waitlistPosition}
                </span>
                {waitlistChurnPrediction && (
                  <span className={`font-mono text-[10px] font-bold ${
                    waitlistChurnPrediction.probability_percentage >= 70 ? "text-emerald-700" :
                    waitlistChurnPrediction.probability_percentage >= 30 ? "text-amber-700" :
                    "text-rose-700"
                  }`}>
                    {waitlistChurnPrediction.message}
                  </span>
                )}
              </div>
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
                if (!prereqMet) {
                  toast.error(`You must attend '${prereqTitle}' before joining waitlist.`);
                  return;
                }
                toggleWaitlist.mutate({ isOnWaitlist });
              }}
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main
              disabled={toggleWaitlist.isPending || !prereqMet}
              variant={isOnWaitlist ? "secondary" : "primary"}
              title={!prereqMet ? `You must attend '${prereqTitle}' before registering for this event.` : undefined}
              className={!prereqMet ? "opacity-50 cursor-not-allowed" : ""}


 main
              disabled={toggleWaitlist.isPending || !prereqMet || (!isOnWaitlist && isWaitlistFull)}
              variant={isOnWaitlist ? "secondary" : "primary"}
              title={
                !prereqMet
                  ? `You must attend '${prereqTitle}' before registering for this event.`
                  : undefined
              }
              className={
                !prereqMet || (!isOnWaitlist && isWaitlistFull)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }
            >
              {toggleWaitlist.isPending
                ? "Updating..."
                : isOnWaitlist
                  ? "On Waitlist ✓"
                  : isWaitlistFull
                    ? "Waitlist Full"
                    : "Join Waitlist"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!prereqMet && !hasRsvpd) {
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main

 main
                  toast.error(`You must attend '${prereqTitle}' before registering for this event.`);

                  toast.error(
                    `You must attend '${prereqTitle}' before registering for this event.`,
                  );
                  return;
                }
                handleRsvpClick();
              }}
              disabled={toggleRsvp.isPending || !prereqMet}
              variant="primary"
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor
 feature/waitlist-churn-predictor

 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 feature/club-lifecycle-monitor-3610
 main

 feature/vendor-contract-nudges
 main

 main
              title={!prereqMet && !hasRsvpd ? `You must attend '${prereqTitle}' before registering for this event.` : undefined}

              title={
                !prereqMet && !hasRsvpd
                  ? `You must attend '${prereqTitle}' before registering for this event.`
                  : undefined
              }
              className={!prereqMet && !hasRsvpd ? "opacity-50 cursor-not-allowed" : ""}
            >
              {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
            </Button>
          )}
        </div>
        {/* RSVP Cancel Confirmation Modal */}
        <ConfirmModal
          open={confirmOpen}
          title="Cancel RSVP"
          description="Are you sure you want to cancel your RSVP for this event? Your spot will be released."
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirmOpen(false)}
        />
        {/* RSVP Accessibility Accommodations Modal */}
        <Dialog
          open={rsvpDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              // Reset states when closed
              setNeedAccommodations(false);
              setAccommodationsText("");
              setMediaConsent(null);
              setValidationError("");
            }
            setRsvpDialogOpen(open);
          }}
        >
          <DialogContent variant="brutalist" className="max-w-md font-mono">
            <DialogHeader className="border-b-2 border-black pb-4">
              <DialogTitle className="text-xl font-bold uppercase tracking-tight">
                RSVP Options
              </DialogTitle>
              <DialogDescription className="text-xs text-black/60 font-mono">
                Configure your attendance preferences for {event.title}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {event.has_photography && (
                <fieldset
                  className="space-y-3 rounded-md border-2 border-red-700 bg-red-50 p-4"
                  aria-describedby="media-consent-help media-consent-error"
                >
                  <legend className="font-mono text-sm font-black uppercase text-red-900">
                    Media Consent <span className="text-red-700">*</span>
                  </legend>
                  <p
                    id="media-consent-help"
                    className="font-mono text-xs leading-relaxed text-red-900"
                  >
                    {MEDIA_CONSENT_COPY.prompt} Your RSVP will be processed either way, but your
                    choice tells the club and door staff how to protect your privacy.
                  </p>
                  <div className="space-y-2">
                    {[
                      { value: "yes" as const, label: MEDIA_CONSENT_COPY.yes },
                      { value: "no" as const, label: MEDIA_CONSENT_COPY.no },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-start gap-3 rounded border border-red-900 bg-white p-3 font-mono text-xs font-bold"
                      >
                        <input
                          type="radio"
                          name="media-consent"
                          value={option.value}
                          checked={mediaConsent === option.value}
                          onChange={() => {
                            setMediaConsent(option.value);
                            setValidationError("");
                          }}
                          disabled={toggleRsvp.isPending}
                          className="mt-0.5 h-4 w-4 accent-red-700"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <p
                    id="media-consent-error"
                    role="alert"
                    className="min-h-4 font-mono text-[10px] font-bold text-red-700"
                  >
                    {mediaConsent === null ? "A choice is required to continue." : ""}
                  </p>
                </fieldset>
              )}

              <div className="flex items-center gap-3">
                <input
                  id="req-accommodations-checkbox"
                  type="checkbox"
                  checked={needAccommodations}
                  disabled={toggleRsvp.isPending}
                  onChange={(e) => {
                    setNeedAccommodations(e.target.checked);
                    if (!e.target.checked) {
                      setAccommodationsText("");
                      setValidationError("");
                    }
                  }}
                  className="h-4 w-4 rounded-none border-2 border-black accent-black cursor-pointer"
                />
                <Label
                  htmlFor="req-accommodations-checkbox"
                  className="font-mono text-sm font-bold uppercase tracking-wide cursor-pointer select-none"
                >
                  I require accessibility accommodations
                </Label>
              </div>

              {needAccommodations && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label
                    htmlFor="accommodations-text"
                    className="font-mono text-xs font-black uppercase text-black/60"
                  >
                    Describe requested accommodations <span className="text-red-700">*</span>
                  </Label>
                  <Textarea
                    id="accommodations-text"
                    placeholder="Please describe the accommodation(s) you need to participate in this event (e.g., sign language interpretation, wheelchair access, closed captioning, etc.)."
                    value={accommodationsText}
                    disabled={toggleRsvp.isPending}
                    onChange={(e) => {
                      setAccommodationsText(e.target.value);
                      if (validationError) setValidationError("");
                    }}
                    className="neu-border min-h-[100px] border-2 border-black bg-white p-3 font-mono text-xs focus:ring-lime placeholder:text-neutral-500"
                    maxLength={1000}
                  />
                  <div className="flex items-center justify-between text-[10px] font-bold text-black/50">
                    <span className={validationError ? "text-red-600 animate-pulse" : ""}>
                      {validationError || "Description is required"}
                    </span>
                    <span>{accommodationsText.length} / 1000 characters</span>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-900 p-3 text-left">
                    <p className="font-mono text-[11px] leading-relaxed text-blue-900">
                      🔒 <span className="font-bold">Privacy Notice:</span> This information is kept
                      private and will only be decrypted for authorized reviewers (the Club
                      President and event organizers) for event planning. It will not be exposed to
                      the public.
                    </p>
                  </div>

                  {isAfterDeadline && (
                    <div className="bg-amber-50 border-2 border-amber-600 p-3 text-left flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <p className="font-mono text-[11px] leading-relaxed text-amber-955">
                        This accommodation request is being submitted after the accommodation
                        deadline. The university may not be able to guarantee that the requested
                        accommodation can be arranged.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-t-2 border-black pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNeedAccommodations(false);
                  setAccommodationsText("");
                  setValidationError("");
                  setRsvpDialogOpen(false);
                }}
                disabled={toggleRsvp.isPending}
                className="neu-border font-mono text-xs font-bold uppercase"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const consentError = getMediaConsentValidationMessage(
                    event.has_photography,
                    mediaConsent,
                  );
                  if (consentError) {
                    setValidationError(consentError);
                    return;
                  }

                  if (needAccommodations) {
                    if (!accommodationsText.trim()) {
                      setValidationError("Accommodation description is required when requested.");
                      return;
                    }
                    if (accommodationsText.length > 1000) {
                      setValidationError("Limit exceeded. Maximum 1000 characters.");
                      return;
                    }
                  }

                  toggleRsvp.mutate({
                    eventId: event.id,
                    hasRsvpd: false,
                    captchaToken,
                    accommodationsRequested: needAccommodations ? accommodationsText : null,
                    noMediaConsent:
                      mediaConsent === null
                        ? undefined
                        : consentChoiceToNoMediaConsent(mediaConsent),
                    referredBy: ref,
                  });
                }}
                disabled={toggleRsvp.isPending}
                className="neu-border font-mono text-xs font-bold uppercase"
              >
                {toggleRsvp.isPending ? "Submitting..." : "Confirm RSVP"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          targetType="event"
          targetId={event.id}
        />
        {/* Decrypted Accommodations Dialog */}
        <Dialog open={isDecryptedModalOpen} onOpenChange={setIsDecryptedModalOpen}>
          <DialogContent className="max-w-md border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
            <DialogHeader>
              <DialogTitle className="font-mono text-xl font-black uppercase text-black">
                Decrypted Accommodation Request
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 font-mono text-sm leading-6">
              {isDecrypting ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-lime border-t-black" />
                  <p className="text-xs font-bold uppercase text-black/60">
                    Decrypting request securely...
                  </p>
                </div>
              ) : decryptError ? (
                <div className="border-2 border-red-650 bg-red-50 p-4 text-red-700">
                  <p className="font-bold uppercase text-xs">Access Denied / Error</p>
                  <p className="mt-1 text-xs">{decryptError}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-black bg-lime/10 p-4">
                    <p className="font-bold uppercase text-xs text-black/60">
                      Accommodation Description:
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-black font-semibold bg-white p-3 border border-black">
                      {decryptedText}
                    </p>
                  </div>
                  <div className="border border-black bg-neutral-50 p-3 text-[10px] text-neutral-600">
                    <p className="font-bold uppercase">🔒 SECURITY AUDIT COMPLIANT</p>
                    <p className="mt-1">
                      Your access to this sensitive information has been logged to the permanent
                      audit trail. Do not duplicate or export this private data.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                className="neu-press border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-bold uppercase rounded-none text-black hover:bg-lime/90"
                onClick={() => setIsDecryptedModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
        {/* Auto Check-In Location Privacy Prompt Dialog */}
        <Dialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
          <DialogContent className="max-w-md border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none font-mono">
            <DialogHeader className="border-b-2 border-black pb-4">
              <DialogTitle className="text-xl font-black uppercase text-black">
                Automatic Check-In
              </DialogTitle>
              <DialogDescription className="text-xs text-black/60 font-mono">
                Verify your attendance at {event.title} using location access.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm text-black">
              <p className="leading-relaxed">
                📍 <strong>Location Check:</strong> CampusConnect can automatically check you in to
                this event. We need to verify that you are physically present at the venue.
              </p>
              <p className="text-xs text-black/60">
                🔒 <strong>Privacy details:</strong> Your location coordinates are processed only in
                your browser to compute the distance from the venue. We never store, track, or share
                your GPS history.
              </p>
            </div>

            <div className="border-t-2 border-black pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                className="neu-press border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold uppercase rounded-none text-black hover:bg-neutral-100"
                onClick={() => setShowLocationPrompt(false)}
              >
                No Thanks
              </Button>
              <Button
                className="neu-press border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-bold uppercase rounded-none text-black hover:bg-lime/90"
                onClick={() => {
                  setShowLocationPrompt(false);
                  triggerAutoCheckIn();
                }}
              >
                Enable & Check In
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SiteShell>
    </>
  );
}
