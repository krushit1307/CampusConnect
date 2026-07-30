export interface Webhook {
  id: string;
  club_id: string;
  url: string;
  events_subscribed: string[];
  secret: string;
  is_active: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: Record<string, any>;
  status: "pending" | "processing" | "success" | "failed" | "permanent_failure";
  status_code: number | null;
  attempt: number;
  next_retry_at: string | null;
  last_error: string | null;
  response_body: string | null;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  club: {
    id: string;
    name?: string;
  };
  data: Record<string, any>;
}
