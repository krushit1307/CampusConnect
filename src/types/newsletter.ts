// src/types/newsletter.ts

export type NewsletterStatus = "draft" | "pending" | "sending" | "sent" | "failed";

export interface NewsletterBlock {
  id: string;
  type: "text" | "heading" | "image" | "event_card" | "button" | "divider";
  content?: string;
  url?: string;
  eventId?: string;
  style?: Record<string, string>;
}

export interface NewsletterDesign {
  blocks: NewsletterBlock[];
  backgroundColor?: string;
  textColor?: string;
}

export interface Newsletter {
  id: string;
  club_id: string;
  created_by?: string | null;
  title: string;
  subject: string;
  design_json: NewsletterDesign;
  content_html: string;
  status: NewsletterStatus;
  sent_at?: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_at: string;
  updated_at: string;
}

export interface NewsletterAnalyticsSummary {
  totalSent: number;
  totalRecipients: number;
  openCount: number;
  openRate: number;
  clickCount: number;
  clickRate: number;
  unsubscribeCount: number;
}
