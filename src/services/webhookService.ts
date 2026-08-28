// @ts-nocheck
import { supabase } from "../lib/supabase/client";

export interface Webhook {
  id: string;
  club_id: string;
  url: string;
  events_subscribed: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  status: string;
  status_code: number;
  attempt: number;
  next_retry_at: string;
  last_error: string;
  response_body: string;
  created_at: string;
  delivered_at: string;
}

export const webhookService = {
  async getWebhooks(clubId: string) {
    const { data, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Webhook[];
  },

  async createWebhook(webhook: Omit<Webhook, "id" | "created_at">) {
    const { data, error } = await supabase.from("webhooks").insert(webhook).select().single();
    if (error) throw error;
    return data as Webhook;
  },

  async updateWebhook(
    id: string,
    updates: Partial<Omit<Webhook, "id" | "club_id" | "created_at">>,
  ) {
    const { data, error } = await supabase
      .from("webhooks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Webhook;
  },

  async deleteWebhook(id: string) {
    const { error } = await supabase.from("webhooks").delete().eq("id", id);
    if (error) throw error;
  },

  async getDeliveries(webhookId: string) {
    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data as WebhookDelivery[];
  },
};
