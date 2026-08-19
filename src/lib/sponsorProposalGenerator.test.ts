import { describe, it, expect } from "vitest";
import {
  aggregateClubProposalMetrics,
  generateSponsorshipProposalHtml,
  ClubProposalData,
  DEFAULT_SPONSORSHIP_TIERS,
} from "./sponsorProposalGenerator";

describe("Club Sponsorship Proposal Generator Utility (#3541)", () => {
  const sampleEvents = [
    {
      id: "evt-1",
      title: "Annual Hackathon 2025",
      date: "Oct 2025",
      attendance: 400,
      keyMetric: "85% CS Majors, 45 submitted projects",
      description: "36-hour hackathon with student builders.",
    },
    {
      id: "evt-2",
      title: "Tech Career Fair & Mixer",
      date: "Nov 2025",
      attendance: 350,
      keyMetric: "35 corporate recruiters attending",
      description: "Networking dinner and career fair.",
    },
    {
      id: "evt-3",
      title: "AI Workshop Series",
      date: "Dec 2025",
      attendance: 250,
      keyMetric: "Over 500 GitHub repository stars created",
      description: "Hands-on LLM and agentic engineering workshop.",
    },
  ];

  it("aggregates club performance and attendance reach metrics", () => {
    const metrics = aggregateClubProposalMetrics(sampleEvents, 500);

    // Total reach = 400 + 350 + 250 + 500 = 1500
    expect(metrics.totalReach).toBe(1500);
    // Avg attendance = (400 + 350 + 250) / 3 = 333
    expect(metrics.avgAttendance).toBe(333);
    expect(metrics.csMajorPercent).toBe(80);
  });

  it("compiles structured HTML pitch deck with sponsor name, highlights, and tiers", () => {
    const proposalData: ClubProposalData = {
      clubName: "Developer Student Club",
      clubTagline: "Building software that empowers students.",
      targetSponsorName: "Google Cloud",
      brandColor: "#4f46e5",
      totalReach: 1500,
      avgAttendance: 333,
      activeMembersCount: 500,
      csMajorPercent: 80,
      highlightEvents: sampleEvents,
      sponsorshipTiers: DEFAULT_SPONSORSHIP_TIERS,
    };

    const html = generateSponsorshipProposalHtml(proposalData);

    expect(html).toContain("Developer Student Club");
    expect(html).toContain("Google Cloud");
    expect(html).toContain("1,500+");
    expect(html).toContain("Annual Hackathon 2025");
    expect(html).toContain("Bronze Partner");
    expect(html).toContain("$500");
    expect(html).toContain("Gold Title Sponsor");
    expect(html).toContain("$2,500");
  });
});
