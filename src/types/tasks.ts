export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order_index: number;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumnDef {
  id: TaskStatus;
  title: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];
