// src/lib/eventLogisticsRuleEngine.ts
import { EventLogisticsRule, EventTask } from "@/types/eventLogistics";

export const EVENT_LOGISTICS_RULES: EventLogisticsRule[] = [
  {
    ruleKey: "security_approval",
    title: "Submit Campus Security Request Form",
    description: "Required for large campus events with over 200 attendees. Must be completed before public release.",
    isCritical: true,
    daysPriorToEvent: 30,
    condition: (event) => {
      const cap = event.max_attendees ?? event.capacity ?? 0;
      return cap > 200;
    },
  },
  {
    ruleKey: "catering_finalization",
    title: "Finalize Catering Order",
    description: "Confirm head count, dietary restriction options, and delivery schedule with campus catering.",
    isCritical: false,
    daysPriorToEvent: 7,
    condition: (event) => {
      if (event.has_catering || event.has_food) return true;
      if (Array.isArray(event.tags)) {
        return event.tags.some((t) => t.toLowerCase() === "food");
      }
      return false;
    },
  },
];

export interface EvaluateRulesEventInput {
  id: string;
  event_date?: string | null;
  start_date?: string | null;
  max_attendees?: number | null;
  capacity?: number | null;
  has_catering?: boolean | null;
  has_food?: boolean | null;
  tags?: string[] | null;
}

/**
 * Calculates due date for a rule based on event start date.
 * If the event is sooner than rule.daysPriorToEvent, sets due date to current time or event start.
 */
export function calculateTaskDueDate(eventDateIso?: string | null, daysPrior = 7): string {
  const eventDate = eventDateIso ? new Date(eventDateIso) : new Date();
  const targetDate = new Date(eventDate.getTime() - daysPrior * 24 * 60 * 60 * 1000);
  const now = new Date();

  // If due date would be in the past relative to now, default to now + 24 hours
  if (targetDate.getTime() < now.getTime()) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  return targetDate.toISOString();
}

/**
 * Evaluates rules against an event state and returns task generation instructions:
 * - tasksToCreate: Auto tasks that should exist for this event
 * - taskRuleKeysToRemove: Auto tasks that are no longer triggered by rules and should be deactivated/deleted
 */
export function evaluateEventLogisticsRules(
  event: EvaluateRulesEventInput,
  existingTasks: Partial<EventTask>[] = []
) {
  const eventDate = event.event_date || event.start_date;
  const activeRuleKeys = new Set<string>();

  const tasksToCreate: Partial<EventTask>[] = [];
  const taskRuleKeysToRemove: string[] = [];

  for (const rule of EVENT_LOGISTICS_RULES) {
    const isTriggered = rule.condition(event);

    if (isTriggered) {
      activeRuleKeys.add(rule.ruleKey);

      // Check if task already exists
      const existing = existingTasks.find(
        (t) => t.is_auto_generated && t.task_rule_key === rule.ruleKey
      );

      if (!existing) {
        tasksToCreate.push({
          event_id: event.id,
          title: rule.title,
          description: rule.description,
          status: "todo",
          due_date: calculateTaskDueDate(eventDate, rule.daysPriorToEvent),
          is_auto_generated: true,
          task_rule_key: rule.ruleKey,
          is_critical: rule.isCritical,
        });
      }
    }
  }

  // Find auto-generated tasks whose rules are no longer triggered (e.g. food was removed)
  for (const task of existingTasks) {
    if (
      task.is_auto_generated &&
      task.task_rule_key &&
      !activeRuleKeys.has(task.task_rule_key) &&
      task.status !== "done"
    ) {
      taskRuleKeysToRemove.push(task.task_rule_key);
    }
  }

  return {
    tasksToCreate,
    taskRuleKeysToRemove,
  };
}
