export interface CleanupTask {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  pointBounty: number;
  maxVolunteers: number;
  claimedVolunteersCount: number;
  status: "hidden" | "active" | "completed";
}

export interface CleanupTaskClaim {
  id: string;
  taskId: string;
  userId: string;
  status: "claimed" | "verified" | "rejected";
  claimedAtIso: string;
}

export interface CleanupNotificationTrigger {
  eventId: string;
  eventTitle: string;
  totalBountyPointsAvailable: number;
  notificationPayload: {
    title: string;
    body: string;
    actionUrl: string;
  };
}

/**
 * Determines task visibility based on current time versus event end time.
 * Automatically activates hidden tasks when event concludes.
 */
export function resolveCleanupTaskVisibility(
  task: CleanupTask,
  eventEndTimeIso: string,
  currentTime: Date = new Date(),
): CleanupTask {
  const isConcluded = currentTime >= new Date(eventEndTimeIso);

  if (isConcluded && task.status === "hidden") {
    return {
      ...task,
      status: "active",
    };
  }

  return task;
}

/**
 * Generates push notification trigger for checked-in attendees when event ends.
 */
export function buildPostEventCleanupNotification(
  eventTitle: string,
  tasks: CleanupTask[],
): CleanupNotificationTrigger | null {
  const activeTasks = tasks.filter((t) => t.status === "active" || t.status === "hidden");
  if (activeTasks.length === 0) return null;

  const totalPoints = activeTasks.reduce((sum, t) => sum + t.pointBounty, 0);

  return {
    eventId: activeTasks[0].eventId,
    eventTitle,
    totalBountyPointsAvailable: totalPoints,
    notificationPayload: {
      title: `🧹 Event Ended: Help Clean Up & Earn Points!`,
      body: `Earn up to ${totalPoints} gamification points by helping clean up ${eventTitle}. Tap to claim a task!`,
      actionUrl: `/events/${activeTasks[0].eventId}/cleanup-board`,
    },
  };
}

/**
 * Evaluates volunteer task claim eligibility.
 */
export function canClaimCleanupTask(
  task: CleanupTask,
  userId: string,
  existingUserClaims: string[],
): boolean {
  if (task.status !== "active") return false;
  if (task.claimedVolunteersCount >= task.maxVolunteers) return false;
  if (existingUserClaims.includes(task.id)) return false;
  return true;
}
