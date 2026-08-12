export interface ScheduledEventContext {
  id: string;
  title: string;
  isMandatory?: boolean;
  isRecorded?: boolean;
  isOneOnOne?: boolean;
  description: string;
}

export interface ConflictResolutionSuggestion {
  recommendedKeepEventId: string;
  recommendedCancelEventId: string;
  reasoning: string;
  isAiGenerated: boolean;
}

/**
 * Builds system and user prompts relying ONLY on provided event context to avoid hallucinations.
 */
export function buildConflictResolverPrompt(
  eventA: ScheduledEventContext,
  eventB: ScheduledEventContext,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    "You are an academic schedule advisor. Analyze the two conflicting events using ONLY the provided descriptions and metadata. Suggest which event to attend and explain why in 2 sentences.";

  const userPrompt = `Conflicting Event A: ${eventA.title} (Mandatory: ${!!eventA.isMandatory}, Recorded: ${!!eventA.isRecorded}, 1-on-1: ${!!eventA.isOneOnOne})\nDescription: ${eventA.description}\n\nConflicting Event B: ${eventB.title} (Mandatory: ${!!eventB.isMandatory}, Recorded: ${!!eventB.isRecorded}, 1-on-1: ${!!eventB.isOneOnOne})\nDescription: ${eventB.description}`;

  return { systemPrompt, userPrompt };
}

/**
 * Fallback deterministic resolution logic when AI service is unavailable or times out.
 */
export function generateDeterministicFallbackResolution(
  eventA: ScheduledEventContext,
  eventB: ScheduledEventContext,
): ConflictResolutionSuggestion {
  // Priority 1: Mandatory events override non-mandatory
  if (eventA.isMandatory && !eventB.isMandatory) {
    return {
      recommendedKeepEventId: eventA.id,
      recommendedCancelEventId: eventB.id,
      reasoning: `Recommended keeping '${eventA.title}' because it is marked as mandatory.`,
      isAiGenerated: false,
    };
  }
  if (eventB.isMandatory && !eventA.isMandatory) {
    return {
      recommendedKeepEventId: eventB.id,
      recommendedCancelEventId: eventA.id,
      reasoning: `Recommended keeping '${eventB.title}' because it is marked as mandatory.`,
      isAiGenerated: false,
    };
  }

  // Priority 2: 1-on-1 sessions override large recorded lectures
  if (eventA.isOneOnOne || eventB.isRecorded) {
    return {
      recommendedKeepEventId: eventA.id,
      recommendedCancelEventId: eventB.id,
      reasoning: `Recommended attending '${eventA.title}' live since '${eventB.title}' is recorded.`,
      isAiGenerated: false,
    };
  }

  return {
    recommendedKeepEventId: eventA.id,
    recommendedCancelEventId: eventB.id,
    reasoning: `You have a schedule conflict between '${eventA.title}' and '${eventB.title}'. Please select which event to keep.`,
    isAiGenerated: false,
  };
}
