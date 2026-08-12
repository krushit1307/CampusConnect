export interface EventTask {
  id: string;
  event_id: string;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  progress: number;
  dependencies: string[];
  assignee_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventTaskInput {
  event_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  progress?: number;
  dependencies?: string[];
  assignee_id?: string;
}

export interface UpdateEventTaskInput {
  id: string;
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  progress?: number;
  dependencies?: string[];
  assignee_id?: string;
}
