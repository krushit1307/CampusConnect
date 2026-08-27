// src/services/newsletterService.ts
import { createClient } from "@/lib/supabase/client";
import { Newsletter, NewsletterDesign, NewsletterBlock, NewsletterAnalyticsSummary } from "@/types/newsletter";
export class NewsletterService {
  private static getSupabase() {
    return createClient();
  }

  /**
   * Fetch all newsletters created for a specific club.
   */
  static async getClubNewsletters(clubId: string): Promise<Newsletter[]> {
    if (!clubId) return [];
    const supabase = this.getSupabase();

    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch club newsletters:", error);
      throw error;
    }

    return (data || []) as Newsletter[];
  }

  /**
   * Fetch a single newsletter by ID.
   */
  static async getNewsletterById(newsletterId: string): Promise<Newsletter | null> {
    if (!newsletterId) return null;
    const supabase = this.getSupabase();

    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .eq("id", newsletterId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch newsletter:", error);
      throw error;
    }

    return data as Newsletter | null;
  }

  /**
   * Save or update a newsletter draft.
   */
  static async saveNewsletterDraft(payload: {
    id?: string;
    clubId: string;
    userId?: string;
    title: string;
    subject: string;
    designJson: NewsletterDesign;
    contentHtml: string;
  }): Promise<Newsletter> {
    const supabase = this.getSupabase();

    const record = {
      club_id: payload.clubId,
      created_by: payload.userId || null,
      title: payload.title.trim(),
      subject: payload.subject.trim(),
      design_json: payload.designJson as any,
      content_html: payload.contentHtml,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (payload.id) {
      result = await supabase
        .from("newsletters")
        .update(record)
        .eq("id", payload.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("newsletters")
        .insert({ ...record, status: "draft" })
        .select()
        .single();
    }

    if (result.error) {
      console.error("Failed to save newsletter draft:", result.error);
      throw new Error(result.error.message || "Failed to save draft.");
    }

    return result.data as Newsletter;
  }

  /**
   * Dispatch a newsletter to all eligible club members.
   */
  static async dispatchNewsletter(newsletterId: string, clubId: string): Promise<void> {
    const supabase = this.getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("Authentication required to dispatch newsletters.");
    }

    const { error } = await supabase.functions.invoke("send-newsletter", {
      body: { newsletterId, clubId },
    });

    if (error) {
      console.error("Dispatch function error:", error);
      throw new Error(error.message || "Failed to dispatch newsletter.");
    }
  }

  /**
   * Unsubscribe a user/email from a specific club's newsletters.
   */
  static async unsubscribeFromClubNewsletter(
    clubId: string,
    email: string,
    userId?: string,
  ): Promise<void> {
    const supabase = this.getSupabase();

    const { error } = await supabase.from("newsletter_unsubscribes").upsert(
      {
        club_id: clubId,
        email: email.trim().toLowerCase(),
        user_id: userId || null,
        unsubscribed_at: new Date().toISOString(),
      },
      { onConflict: "club_id,email" },
    );

    if (error) {
      console.error("Unsubscribe error:", error);
      throw error;
    }
  }

  /**
   * Fetch aggregate analytics for a club's sent newsletters.
   */
  static async getClubNewsletterAnalytics(clubId: string): Promise<NewsletterAnalyticsSummary> {
    const supabase = this.getSupabase();

    // 1. Fetch all sent newsletters for club
    const { data: newsletters } = await supabase
      .from("newsletters")
      .select("id, total_recipients, successful_sends")
      .eq("club_id", clubId)
      .eq("status", "sent");

    const totalSent = (newsletters || []).length;
    const totalRecipients = (newsletters || []).reduce(
      (acc, n) => acc + (n.successful_sends || n.total_recipients || 0),
      0,
    );

    const newsletterIds = (newsletters || []).map((n) => n.id);

    let openCount = 0;
    let clickCount = 0;

    if (newsletterIds.length > 0) {
      const { data: events } = await supabase
        .from("newsletter_analytics")
        .select("event_type")
        .in("newsletter_id", newsletterIds);

      if (events) {
        openCount = events.filter((e) => e.event_type === "open").length;
        clickCount = events.filter((e) => e.event_type === "click").length;
      }
    }

    // Unsubscribes count
    const { count: unsubscribeCount } = await supabase
      .from("newsletter_unsubscribes")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId);

    const openRate =
      totalRecipients > 0 ? Math.min(100, Math.round((openCount / totalRecipients) * 100)) : 0;
    const clickRate =
      totalRecipients > 0 ? Math.min(100, Math.round((clickCount / totalRecipients) * 100)) : 0;

    return {
      totalSent,
      totalRecipients,
      openCount,
      openRate,
      clickCount,
      clickRate,
      unsubscribeCount: unsubscribeCount || 0,
    };
  }

  /**
   * Compiles JSON design blocks into email-safe inline HTML.
   */
  static compileDesignToHtml(design: NewsletterDesign, eventMap: Record<string, any> = {}): string {
    const bgColor = design.backgroundColor || "#ffffff";
    const textColor = design.textColor || "#111827";

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:0;background-color:${bgColor};color:${textColor};font-family:sans-serif;}</style></head><body style="background-color:${bgColor}; color:${textColor}; font-family:sans-serif; padding:20px;"><div style="max-w:600px; margin:0 auto; background:#ffffff; border:2px solid #000; padding:24px;">`;

    for (const block of design.blocks || []) {
      switch (block.type) {
        case "heading":
          html += `<h2 style="font-size:22px; font-weight:bold; margin-top:16px; margin-bottom:8px; text-transform:uppercase; color:#000;">${block.content || ""}</h2>`;
          break;

        case "text":
          html += `<p style="font-size:14px; line-height:1.6; margin-bottom:12px; color:#333;">${(block.content || "").replace(/\n/g, "<br/>")}</p>`;
          break;

        case "image":
          if (block.url) {
            html += `<div style="text-align:center; margin:16px 0;"><img src="${block.url}" alt="" style="max-width:100%; border:2px solid #000;" /></div>`;
          }
          break;

        case "event_card":
          {
            const evt = block.eventId ? eventMap[block.eventId] : null;
            if (evt) {
              const eventDateStr =
                evt.start_date || evt.event_date
                  ? new Date(evt.start_date || evt.event_date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Upcoming Event";

              html += `
              <div style="border: 2px solid #000; background: #fff8dc; padding: 16px; margin: 20px 0; font-family: monospace;">
                ${evt.banner_url ? `<img src="${evt.banner_url}" alt="" style="width:100%; height:160px; object-fit:cover; border-bottom:2px solid #000; margin-bottom:12px;" />` : ""}
                <span style="background:#000; color:#fff; font-size:10px; padding:2px 6px; font-weight:bold; text-transform:uppercase;">Campus Event</span>
                <h3 style="font-size:18px; font-weight:bold; margin:8px 0 4px 0; color:#000;">${evt.title}</h3>
                <p style="font-size:12px; color:#555; margin:0 0 12px 0;">📅 ${eventDateStr} ${evt.location ? `• 📍 ${evt.location}` : ""}</p>
                <a href="${evt.event_url || `https://campusconnect.app/events/${evt.id}`}" style="display:inline-block; background:#ff4757; color:#fff; text-decoration:none; padding:8px 16px; font-weight:bold; font-size:12px; border:2px solid #000; text-transform:uppercase;">RSVP Now →</a>
              </div>
            `;
            } else {
              html += `<div style="border:2px dashed #000; padding:16px; margin:16px 0; text-align:center; font-family:monospace;">[Dynamic Event Card Placeholder]</div>`;
            }
          }
          break;

        case "button":
          html += `<div style="text-align:center; margin:20px 0;"><a href="${block.url || "#"}" style="display:inline-block; background:#000; color:#fff; text-decoration:none; padding:10px 20px; font-weight:bold; font-size:13px; font-family:monospace; text-transform:uppercase;">${block.content || "Click Here"}</a></div>`;
          break;

        case "divider":
          html += `<hr style="border:none; border-top:2px solid #000; margin:24px 0;" />`;
          break;

        default:
          break;
      }
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * One-click "Generate Weekly Newsletter" (#3896): pulls the club's
   * upcoming events (next 14 days) and its most recent event photos, and
   * compiles them straight into a previewable design + HTML.
   */
  static async generateWeeklyNewsletter(
    clubId: string,
    clubName = "Your Club",
  ): Promise<{
    title: string;
    subject: string;
    design: NewsletterDesign;
    contentHtml: string;
    eventMap: Record<string, any>;
  }> {
    const supabase = this.getSupabase();
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, event_date, start_date, location, banner_url")
      .eq("club_id", clubId)
      .gte("start_date", now.toISOString())
      .lte("start_date", twoWeeksOut.toISOString())
      .order("start_date", { ascending: true });

    if (eventsError) {
      console.error("Failed to fetch upcoming events for newsletter:", eventsError);
      throw eventsError;
    }

    const eventIds = (events || []).map((event) => event.id);
    let photoUrls: string[] = [];
    if (eventIds.length > 0) {
      const { data: photos } = await supabase
        .from("event_photos")
        .select("url")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false })
        .limit(6);
      photoUrls = (photos || []).map((photo) => photo.url);
    }

    const eventMap: Record<string, any> = {};
    (events || []).forEach((event) => (eventMap[event.id] = event));

    const blocks: NewsletterBlock[] = [
      {
        id: "auto_heading",
        type: "heading",
        content: `This Week at ${clubName}`,
      },
      {
        id: "auto_intro",
        type: "text",
        content: `Here's what's coming up over the next two weeks - don't miss out!`,
      },
      ...(events || []).map((event, index) => ({
        id: `auto_event_${index}`,
        type: "event_card" as const,
        eventId: event.id,
      })),
    ];

    if (photoUrls.length > 0) {
      blocks.push({ id: "auto_photos_heading", type: "heading", content: "Recent Photos" });
      photoUrls.forEach((url, index) => {
        blocks.push({ id: `auto_photo_${index}`, type: "image", url });
      });
    }

    const design: NewsletterDesign = { blocks, backgroundColor: "#ffffff" };
    const contentHtml = this.compileDesignToHtml(design, eventMap);

    return {
      title: `${clubName} Weekly Newsletter - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      subject: `What's happening at ${clubName} this week`,
      design,
      contentHtml,
      eventMap,
    };
  }
}