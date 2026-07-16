import { z } from "zod";

export const clubFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
  description: z.string().trim().min(1, "Description is required."),
});

export type ClubFormValues = z.infer<typeof clubFormSchema>;
