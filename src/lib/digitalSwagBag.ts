export interface DigitalSwagItem {
  id: string;
  event_id: string;
  sponsor_name: string;
  title: string;
  asset_url?: string | null;
  promo_code?: string | null;
  description?: string | null;
  click_count?: number;
  created_at?: string;
}

export interface SponsorRoiMetrics {
  sponsorName: string;
  itemCount: number;
  totalClicks: number;
  totalDeliveries: number;
  ctrPercent: number;
}

/**
 * Calculates Click-Through Rate % (CTR) for sponsor ROI (#3535).
 */
export function calculateSponsorCTR(totalDeliveries: number, clickCount: number): number {
  if (!totalDeliveries || totalDeliveries <= 0) return 0;
  const clicks = Math.max(0, clickCount || 0);
  return Number(((clicks / totalDeliveries) * 100).toFixed(1));
}

/**
 * Aggregates ROI metrics per sponsor for event organizers (#3535).
 */
export function calculateSponsorRoiList(
  items: DigitalSwagItem[],
  totalDeliveries: number
): SponsorRoiMetrics[] {
  const map = new Map<string, { itemCount: number; totalClicks: number }>();

  items.forEach((item) => {
    const name = item.sponsor_name || "General Sponsor";
    const existing = map.get(name) || { itemCount: 0, totalClicks: 0 };
    existing.itemCount += 1;
    existing.totalClicks += item.click_count || 0;
    map.set(name, existing);
  });

  return Array.from(map.entries()).map(([sponsorName, data]) => ({
    sponsorName,
    itemCount: data.itemCount,
    totalClicks: data.totalClicks,
    totalDeliveries: Math.max(0, totalDeliveries),
    ctrPercent: calculateSponsorCTR(totalDeliveries, data.totalClicks),
  }));
}

/**
 * Compiles a beautifully formatted HTML email containing all digital swag bag assets (#3535).
 * Dispatched automatically when an attendee checks in via the event kiosk.
 */
export function compileSwagBagHtmlEmail(
  eventName: string,
  attendeeName: string,
  items: DigitalSwagItem[]
): string {
  const safeEventName = eventName || "Campus Event";
  const safeAttendee = attendeeName || "Attendee";

  const itemsHtml = items
    .map((item) => {
      const hasPromo = Boolean(item.promo_code && item.promo_code.trim());
      const hasAsset = Boolean(item.asset_url && item.asset_url.trim());

      return `
        <div style="background-color: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-family: monospace;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">
            Presented by ${item.sponsor_name}
          </div>
          <h3 style="margin: 4px 0 8px 0; font-size: 16px; color: #0f172a;">${item.title}</h3>
          ${item.description ? `<p style="font-size: 13px; color: #334155; margin-bottom: 12px;">${item.description}</p>` : ""}

          ${
            hasPromo
              ? `
            <div style="background-color: #fef3c7; border: 1px dashed #d97706; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-bottom: 12px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: bold; display: block;">Exclusive Promo Code:</span>
              <strong style="font-size: 16px; letter-spacing: 1px; color: #78350f;">${item.promo_code}</strong>
            </div>
          `
              : ""
          }

          ${
            hasAsset
              ? `
            <div style="margin-top: 8px;">
              <a href="${item.asset_url}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 8px 14px; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 6px; display: inline-block;">
                Claim & Download Digital Asset →
              </a>
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your Digital Swag Bag — ${safeEventName}</title>
      </head>
      <body style="background-color: #f1f5f9; padding: 24px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 3px solid #000000; border-radius: 12px; padding: 24px; box-shadow: 6px 6px 0px #000000;">
          <h2 style="margin-top: 0; font-size: 20px; color: #0f172a; font-family: monospace;">🎁 Your Digital Swag Bag</h2>
          <p style="font-size: 14px; color: #475569;">
            Hi <strong>${safeAttendee}</strong>! Thank you for checking in to <strong>${safeEventName}</strong>.
            Here is your exclusive digital swag bag containing sponsor discounts, PDF flyers, and event vouchers.
          </p>
          <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
          ${itemsHtml || '<p style="font-size: 13px; color: #94a3b8;">No swag items listed for this event.</p>'}
          <div style="font-size: 11px; text-align: center; color: #94a3b8; margin-top: 24px; font-family: monospace;">
            🌱 Paperless Event Logistics powered by CampusConnect
          </div>
        </div>
      </body>
    </html>
  `;
}
