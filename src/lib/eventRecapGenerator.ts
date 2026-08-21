import { createClient } from "./supabase/client";

// ==========================================
// Issue #3877: Automated Event Impact Report PDF
// ==========================================

export interface RawEventMetricsInput {
  eventId: string;
  eventTitle: string;
  clubName: string;
  totalRsvps: number;
  actualCheckins: number;
  pointsAwarded: number;
  budgetSpent: number;
  topPhotoUrls: string[];
}

export interface AggregatedRecapMetrics {
  eventId: string;
  eventTitle: string;
  clubName: string;
  totalRsvps: number;
  actualCheckins: number;
  turnoutPercentage: number;
  pointsAwarded: number;
  budgetSpent: number;
  topPhotoUrls: string[];
  costPerAttendee: number;
}

export interface GeneratedRecapReport {
  metrics: AggregatedRecapMetrics;
  aiSummary: string;
  pdfDocumentStructure: {
    title: string;
    subtitle: string;
    sections: Array<{ heading: string; content: string }>;
    metricsGrid: Array<{ label: string; value: string }>;
    photoGallery: string[];
  };
}

/**
 * Aggregates raw event activity data into structured recap impact metrics.
 */
export function aggregateEventMetrics(input: RawEventMetricsInput): AggregatedRecapMetrics {
  const turnoutPercentage =
    input.totalRsvps > 0
      ? Number(((input.actualCheckins / input.totalRsvps) * 100).toFixed(1))
      : 0.0;

  const costPerAttendee =
    input.actualCheckins > 0 ? Number((input.budgetSpent / input.actualCheckins).toFixed(2)) : 0.0;

  return {
    ...input,
    turnoutPercentage,
    topPhotoUrls: input.topPhotoUrls.slice(0, 3), // Top 3 photos
    costPerAttendee,
  };
}

/**
 * Builds AI LLM prompt payload to write a 2-paragraph professional event impact summary.
 */
export function buildAiSummaryPrompt(metrics: AggregatedRecapMetrics): string {
  return `
Write a professional 2-paragraph Event Impact Report summary for the event "${metrics.eventTitle}" hosted by "${metrics.clubName}".

Key Performance Data:
- RSVPs: ${metrics.totalRsvps}
- Verified Attendees: ${metrics.actualCheckins} (${metrics.turnoutPercentage}% Turnout Rate)
- Total Gamification Points Awarded: ${metrics.pointsAwarded}
- Total Budget Expended: $${metrics.budgetSpent.toFixed(2)} ($${metrics.costPerAttendee.toFixed(2)} per verified attendee)

Paragraph 1: Summarize community turnout, engagement levels, and overall attendance success.
Paragraph 2: Highlight financial efficiency, value provided to sponsors/Student Union, and future growth potential.
  `.trim();
}

/**
 * Constructs PDF document structure for React-PDF or Puppeteer HTML renderer.
 */
export function generateEventRecapDocument(
  metrics: AggregatedRecapMetrics,
  aiSummaryText: string,
): GeneratedRecapReport {
  return {
    metrics,
    aiSummary: aiSummaryText,
    pdfDocumentStructure: {
      title: `${metrics.eventTitle} — Event Impact Report`,
      subtitle: `Organized by ${metrics.clubName}`,
      metricsGrid: [
        { label: "Total RSVPs", value: metrics.totalRsvps.toString() },
        {
          label: "Actual Check-Ins",
          value: `${metrics.actualCheckins} (${metrics.turnoutPercentage}%)`,
        },
        { label: "Points Awarded", value: metrics.pointsAwarded.toString() },
        { label: "Total Budget", value: `$${metrics.budgetSpent.toFixed(2)}` },
        { label: "Cost / Attendee", value: `$${metrics.costPerAttendee.toFixed(2)}` },
      ],
      sections: [
        {
          heading: "Executive Summary & Impact Analysis",
          content: aiSummaryText,
        },
      ],
      photoGallery: metrics.topPhotoUrls,
    },
  };
}

// ==========================================
// Existing Main Branch Feed Recaps
// ==========================================

export type RecapTone = "professional" | "hype" | "casual";

export interface GenerateRecapResponse {
  success: boolean;
  recapMarkdown?: string;
  heroPhotos?: string[];
  attendanceCount?: number;
  clubId?: string;
  eventTitle?: string;
  error?: string;
  isDataScarcity?: boolean;
}

export const MIN_ATTENDANCE_THRESHOLD = 3;

/**
 * Triggers the AI compilation workflow for post-event recaps.
 */
export async function generateEventRecap(
  eventId: string,
  tone: RecapTone = "hype",
): Promise<GenerateRecapResponse> {
  try {
    const supabase = createClient();

    // Call Supabase Edge function
    const { data, error } = await supabase.functions.invoke("generate-event-recap", {
      body: { eventId, tone },
    });

    if (error) {
      // Fallback local compilation if edge function is uninvoked in local test environment
      return fallbackLocalCompilation(eventId, tone);
    }

    if (data?.error === "DATA_SCARCITY") {
      return {
        success: false,
        error: data.message || "Insufficient event attendance/data to generate an authentic recap.",
        isDataScarcity: true,
      };
    }

    return {
      success: true,
      recapMarkdown: data.recapMarkdown,
      heroPhotos: data.heroPhotos || [],
      attendanceCount: data.attendanceCount,
      clubId: data.clubId,
      eventTitle: data.eventTitle,
    };
  } catch {
    return fallbackLocalCompilation(eventId, tone);
  }
}

/**
 * Local fallback aggregator for testing or offline development mode.
 */
async function fallbackLocalCompilation(
  eventId: string,
  tone: RecapTone,
): Promise<GenerateRecapResponse> {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, clubs(id, name, slug)")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  const { count: attendance } = await supabase
    .from("event_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const effectiveCount = attendance || 0;
  if (effectiveCount < MIN_ATTENDANCE_THRESHOLD) {
    return {
      success: false,
      error: `Insufficient event data. At least ${MIN_ATTENDANCE_THRESHOLD} attendees are required before generating an AI recap.`,
      isDataScarcity: true,
    };
  }

  let toneLead = "What an electrifying evening!";
  if (tone === "professional") {
    toneLead = "The event concluded with insightful keynotes and academic discourse.";
  } else if (tone === "casual") {
    toneLead = "It was a wonderful get-together with great vibes and conversations.";
  }

  const generatedMarkdown = `# Post-Event Recap: ${event.title}\n\n${toneLead} Hosted by **${event.clubs?.name || "our club"}**, we celebrated an incredible turnout of **${effectiveCount} participants**.\n\n### 🌟 Highlights & Key Moments\n- Engaging discussions and energetic networking.\n- Enthusiastic audience participation throughout the sessions.\n\nThank you to everyone who made this event a success!`;

  return {
    success: true,
    recapMarkdown: generatedMarkdown,
    heroPhotos: [],
    attendanceCount: effectiveCount,
    clubId: event.club_id || event.clubs?.id,
    eventTitle: event.title,
  };
}

/**
 * Publishes the generated draft recap into the Club's news feed / articles table.
 */
export function publishRecapToClubFeed(
  clubId: string,
  title: string,
  contentMarkdown: string,
  heroImages: string[] = [],
  authorId?: string,
): Promise<{ success: boolean; message: string }> {
  return (async () => {
    try {
      const supabase = createClient();

      let finalizedContent = contentMarkdown;
      if (heroImages.length > 0) {
        const imagesMd =
          `\n\n### 📸 Event Highlights Gallery\n` +
          heroImages.map((img) => `![Event Photo](${img})`).join("\n\n");
        finalizedContent += imagesMd;
      }

      const { error } = await supabase.from("articles").insert({
        club_id: clubId,
        author_id: authorId || null,
        title,
        content: finalizedContent,
      });

      if (error) throw error;
      return { success: true, message: "Recap article successfully published to Club feed!" };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to publish recap";
      return { success: false, message: errorMsg };
    }
  })();
}