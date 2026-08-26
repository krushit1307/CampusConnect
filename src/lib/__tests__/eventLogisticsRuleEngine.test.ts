// src/lib/__tests__/eventLogisticsRuleEngine.test.ts
import { describe, it, expect } from "vitest";
import {
  evaluateEventLogisticsRules,
  calculateTaskDueDate,
  EVENT_LOGISTICS_RULES,
} from "../eventLogisticsRuleEngine";
import { EventTask } from "@/types/eventLogistics";

describe("Event Logistics Rule Engine", () => {
  const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  it("triggers Campus Security Request task when capacity > 200", () => {
    const largeEvent = {
      id: "evt-large",
      event_date: futureDate,
      max_attendees: 300,
    };

    const { tasksToCreate } = evaluateEventLogisticsRules(largeEvent);

    expect(tasksToCreate.length).toBe(1);
    expect(tasksToCreate[0].task_rule_key).toBe("security_approval");
    expect(tasksToCreate[0].is_critical).toBe(true);
    expect(tasksToCreate[0].title).toContain("Campus Security Request");
  });

  it("triggers Finalize Catering Order task when event has catering or food tag", () => {
    const cateringEvent = {
      id: "evt-catering",
      event_date: futureDate,
      max_attendees: 50,
      has_catering: true,
    };

    const { tasksToCreate } = evaluateEventLogisticsRules(cateringEvent);

    expect(tasksToCreate.length).toBe(1);
    expect(tasksToCreate[0].task_rule_key).toBe("catering_finalization");
    expect(tasksToCreate[0].is_critical).toBe(false);
  });

  it("triggers both rules when capacity > 200 and catering is enabled", () => {
    const megaEvent = {
      id: "evt-mega",
      event_date: futureDate,
      max_attendees: 500,
      has_food: true,
    };

    const { tasksToCreate } = evaluateEventLogisticsRules(megaEvent);

    expect(tasksToCreate.length).toBe(2);
    const ruleKeys = tasksToCreate.map((t) => t.task_rule_key);
    expect(ruleKeys).toContain("security_approval");
    expect(ruleKeys).toContain("catering_finalization");
  });

  it("gracefully flags auto task for removal if catering is removed on edit", () => {
    const updatedEventWithoutFood = {
      id: "evt-catering",
      event_date: futureDate,
      max_attendees: 50,
      has_catering: false,
      has_food: false,
    };

    const existingAutoTasks: Partial<EventTask>[] = [
      {
        id: "task-1",
        event_id: "evt-catering",
        task_rule_key: "catering_finalization",
        is_auto_generated: true,
        status: "todo",
      },
      {
        id: "task-custom",
        event_id: "evt-catering",
        title: "Buy Markers",
        is_auto_generated: false,
        status: "todo",
      },
    ];

    const { tasksToCreate, taskRuleKeysToRemove } = evaluateEventLogisticsRules(
      updatedEventWithoutFood,
      existingTasks
    );

    expect(tasksToCreate.length).toBe(0);
    expect(taskRuleKeysToRemove).toEqual(["catering_finalization"]);
  });

  it("preserves completed auto tasks when rule no longer applies", () => {
    const updatedEventWithoutFood = {
      id: "evt-catering",
      event_date: futureDate,
      max_attendees: 50,
      has_catering: false,
    };

    const completedCateringTask: Partial<EventTask>[] = [
      {
        id: "task-done",
        event_id: "evt-catering",
        task_rule_key: "catering_finalization",
        is_auto_generated: true,
        status: "done",
      },
    ];

    const { taskRuleKeysToRemove } = evaluateEventLogisticsRules(
      updatedEventWithoutFood,
      completedCateringTask
    );

    expect(taskRuleKeysToRemove.length).toBe(0);
  });
});
