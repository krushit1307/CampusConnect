export interface ProposalHighlightEvent {
  id: string;
  title: string;
  date: string;
  attendance: number;
  keyMetric: string;
  description: string;
}

export interface SponsorshipTierProposal {
  id: string;
  name: string;
  amount: number;
  colorHex: string;
  perks: string[];
}

export interface ClubProposalData {
  clubName: string;
  clubTagline: string;
  targetSponsorName: string;
  brandColor?: string;
  totalReach: number;
  avgAttendance: number;
  activeMembersCount: number;
  csMajorPercent: number;
  highlightEvents: ProposalHighlightEvent[];
  sponsorshipTiers: SponsorshipTierProposal[];
}

export const DEFAULT_SPONSORSHIP_TIERS: SponsorshipTierProposal[] = [
  {
    id: "tier-bronze",
    name: "Bronze Partner",
    amount: 500,
    colorHex: "#b45309",
    perks: [
      "Logo on all event posters & digital swag bag",
      "Social media sponsor shoutout (1.5k followers)",
      "Access to opt-in attendee resume book",
    ],
  },
  {
    id: "tier-silver",
    name: "Silver Partner",
    amount: 1000,
    colorHex: "#64748b",
    perks: [
      "All Bronze perks included",
      "Dedicated 5-minute keynote slot at flagship workshop",
      "Sponsor table / recruiting booth at flagship event",
      "Direct job posting on Club Alumni Board",
    ],
  },
  {
    id: "tier-gold",
    name: "Gold Title Sponsor",
    amount: 2500,
    colorHex: "#d97706",
    perks: [
      "All Silver perks included",
      "Event named 'Presented by [Your Company]'",
      "Co-host proprietary tech workshop / challenge",
      "1-on-1 VIP networking dinner with top club student leaders",
    ],
  },
];

/**
 * Aggregates club performance & impact metrics for sponsor pitch proposal (#3541).
 */
export function aggregateClubProposalMetrics(
  events: ProposalHighlightEvent[],
  activeMembers: number = 150
): { totalReach: number; avgAttendance: number; csMajorPercent: number } {
  if (!events || events.length === 0) {
    return {
      totalReach: activeMembers,
      avgAttendance: 0,
      csMajorPercent: 80,
    };
  }

  const totalEventAttendance = events.reduce((sum, e) => sum + (e.attendance || 0), 0);
  const avgAttendance = Math.round(totalEventAttendance / events.length);
  const totalReach = totalEventAttendance + activeMembers;

  return {
    totalReach,
    avgAttendance,
    csMajorPercent: 80, // 80% CS / Engineering student breakdown
  };
}

/**
 * Compiles high-impact, print-ready HTML Pitch Deck for corporate sponsorship proposals (#3541).
 */
export function generateSponsorshipProposalHtml(data: ClubProposalData): string {
  const brand = data.brandColor || "#6366f1";
  const sponsor = data.targetSponsorName || "Corporate Sponsor";
  const club = data.clubName || "Student Club";

  const eventsHtml = (data.highlightEvents || [])
    .map(
      (evt) => `
      <div style="background-color: #f8fafc; border-left: 4px solid ${brand}; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <strong style="font-size: 15px; color: #0f172a;">${evt.title}</strong>
          <span style="font-size: 12px; color: #64748b; font-weight: bold;">${evt.date}</span>
        </div>
        <p style="margin: 4px 0 6px 0; font-size: 13px; color: #334155;">${evt.description}</p>
        <div style="font-size: 12px; color: #059669; font-weight: bold;">
          👥 ${evt.attendance.toLocaleString()} Attendees • 🎯 ${evt.keyMetric}
        </div>
      </div>
    `
    )
    .join("");

  const tiersHtml = (data.sponsorshipTiers || DEFAULT_SPONSORSHIP_TIERS)
    .map(
      (tier) => `
      <div style="flex: 1; min-width: 180px; background-color: #ffffff; border: 2px solid #0f172a; border-radius: 8px; padding: 16px; box-shadow: 4px 4px 0px #0f172a;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 16px; color: #0f172a;">${tier.name}</h4>
          <div style="font-size: 20px; font-weight: 900; color: ${tier.colorHex}; margin-top: 4px;">$${tier.amount.toLocaleString()}</div>
        </div>
        <ul style="padding-left: 18px; margin: 0; font-size: 12px; color: #334155; line-height: 1.5;">
          ${tier.perks.map((p) => `<li style="margin-bottom: 6px;">${p}</li>`).join("")}
        </ul>
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sponsorship Proposal — ${club} & ${sponsor}</title>
      </head>
      <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 32px; max-width: 800px; margin: 0 auto;">
        
        <!-- Cover Header -->
        <div style="border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: ${brand};">
            Partnership & Sponsorship Pitch Deck
          </div>
          <h1 style="font-size: 28px; margin: 8px 0 4px 0; color: #0f172a;">${club}</h1>
          <p style="font-size: 15px; color: #475569; margin: 0;">${data.clubTagline || "Empowering the next generation of campus leaders & innovators."}</p>
          <div style="margin-top: 12px; font-size: 13px; font-weight: bold; color: #0f172a; background: #e0e7ff; padding: 6px 12px; border-radius: 4px; display: inline-block;">
            Prepared Exclusively for: <strong>${sponsor}</strong>
          </div>
        </div>

        <!-- Executive Impact & Stats Section -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 18px; border-left: 4px solid ${brand}; padding-left: 8px; text-transform: uppercase;">Why Partner With Us?</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            Over the last academic year, <strong>${club}</strong> reached <strong>${data.totalReach.toLocaleString()}+ students</strong>.
            Our flagship events draw an average of <strong>${data.avgAttendance.toLocaleString()} attendees</strong>, with <strong>${data.csMajorPercent}%</strong> majoring in Computer Science, Data Science, and Engineering.
          </p>

          <div style="display: flex; gap: 16px; margin-top: 16px;">
            <div style="flex: 1; background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: ${brand};">${data.totalReach.toLocaleString()}+</div>
              <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b;">Annual Reach</div>
            </div>
            <div style="flex: 1; background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: ${brand};">${data.avgAttendance.toLocaleString()}</div>
              <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b;">Avg Attendance</div>
            </div>
            <div style="flex: 1; background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: ${brand};">${data.csMajorPercent}%</div>
              <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b;">STEM / CS Demographics</div>
            </div>
          </div>
        </div>

        <!-- Flagship Events Showcase -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 18px; border-left: 4px solid ${brand}; padding-left: 8px; text-transform: uppercase;">Flagship Event Highlights</h2>
          ${eventsHtml || "<p style='font-size: 13px; color: #94a3b8;'>No highlight events provided.</p>"}
        </div>

        <!-- Sponsorship Tiers Grid -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 18px; border-left: 4px solid ${brand}; padding-left: 8px; text-transform: uppercase;">Sponsorship Tiers & Benefits</h2>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px;">
            ${tiersHtml}
          </div>
        </div>

        <!-- Footer Call to Action -->
        <div style="border-top: 2px dashed #cbd5e1; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
          Ready to partner? Contact us at <strong>sponsorships@${club.toLowerCase().replace(/\s+/g, "")}.campusconnect.app</strong> to secure your tier.
        </div>
      </body>
    </html>
  `;
}
