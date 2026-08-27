import { z } from "zod";

export type QuestionType = "text" | "multiple_choice" | "checkbox";

export interface CustomQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

export const MAX_CUSTOM_QUESTIONS = 10;

/**
 * Validates the organizer's array of custom questions schema.
 */
export function validateCustomQuestionsSchema(questions: CustomQuestion[]): boolean {
  if (!Array.isArray(questions)) return false;
  if (questions.length > MAX_CUSTOM_QUESTIONS) {
    throw new Error(`Cannot exceed maximum of ${MAX_CUSTOM_QUESTIONS} custom questions.`);
  }

  for (const q of questions) {
    if (!q.id || !q.label || !q.type) {
      throw new Error("Invalid question format: missing required fields.");
    }
    if (q.type === "multiple_choice" && (!q.options || q.options.length === 0)) {
      throw new Error(`Multiple choice question "${q.label}" requires options.`);
    }
  }

  return true;
}

/**
 * Dynamically builds a Zod schema to validate attendee responses against question definitions.
 */
export function buildDynamicRsvpSchema(questions: CustomQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  questions.slice(0, MAX_CUSTOM_QUESTIONS).forEach((q) => {
    if (q.type === "checkbox") {
      shape[q.id] = q.required
        ? z.boolean().refine((val) => val === true, { message: `${q.label} must be checked.` })
        : z.boolean().optional();
    } else if (q.type === "multiple_choice") {
      if (q.options && q.options.length > 0) {
        const optionTuple = q.options as [string, ...string[]];
        const enumSchema = z.enum(optionTuple);
        shape[q.id] = q.required ? enumSchema : enumSchema.optional().or(z.literal(""));
      } else {
        shape[q.id] = q.required ? z.string().min(1) : z.string().optional();
      }
    } else {
      // Text question
      shape[q.id] = q.required
        ? z.string().min(1, { message: `${q.label} is required.` })
        : z.string().optional();
    }
  });

  return z.object(shape);
}
