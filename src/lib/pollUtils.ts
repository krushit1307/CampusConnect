import { z } from "zod";

export const POLL_QUESTION_MAX_LENGTH = 200;
export const POLL_OPTION_MAX_LENGTH = 100;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

export const pollFormSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required.")
    .max(
      POLL_QUESTION_MAX_LENGTH,
      `Question must be ${POLL_QUESTION_MAX_LENGTH} characters or fewer.`,
    ),
  options: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, "Option text is required.")
          .max(
            POLL_OPTION_MAX_LENGTH,
            `Option must be ${POLL_OPTION_MAX_LENGTH} characters or fewer.`,
          ),
      }),
    )
    .min(POLL_MIN_OPTIONS, `At least ${POLL_MIN_OPTIONS} options are required.`)
    .max(POLL_MAX_OPTIONS, `At most ${POLL_MAX_OPTIONS} options are allowed.`),
  is_anonymous: z.boolean().default(false),
});

export type PollFormValues = z.infer<typeof pollFormSchema>;

export interface Poll {
  id: string;
  event_id: string;
  created_by: string;
  question: string;
  is_active: boolean;
  is_anonymous: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  position: number;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface PollWithOptions extends Poll {
  poll_options: PollOption[];
}

export interface PollResults {
  optionId: string;
  text: string;
  votes: number;
  position: number;
}
