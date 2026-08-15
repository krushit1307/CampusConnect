// src/types/eventLogistics.ts

export type TaskStatus = "todo" | "in_progress" | "done";

export interface EventTask {
  id: string;
  event_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  due_date?: string | null;
  assignee_id?: string | null;
  is_auto_generated: boolean;
  task_rule_key?: string | null;
  is_critical: boolean;
  reminder_sent_at?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface EventLogisticsRule {
  ruleKey: string;
  title: string;
  description: string;
  isCritical: boolean;
  daysPriorToEvent: number;
  condition: (event: {
    max_attendees?: number | null;
    capacity?: number | null;
    has_catering?: boolean | null;
    has_food?: boolean | null;
    tags?: string[] | null;
  }) => boolean;
}

export interface CreateCustomTaskPayload {
  eventId: string;
  title: string;
  description?: string;
  dueDate?: string;
  assigneeId?: string;
  isCritical?: boolean;
}
