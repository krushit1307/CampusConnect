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
