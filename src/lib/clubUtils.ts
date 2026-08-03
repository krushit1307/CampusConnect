import { z } from "zod";

export const MAX_DESCRIPTION_LENGTH = 500;

export const clubFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`),
  github_repo_url: z
    .string()
    .trim()
    .refine(
      (val) => !val || val.startsWith("https://github.com/"),
      "GitHub repository URL must start with https://github.com/",
    )
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  visibility: z.enum(["public", "private"]).optional().default("public"),
  social_links: z.record(z.string(), z.string().url()).default({}).optional(),
  // The deepest category id chosen via the cascading category selector
  // (e.g. "Robotics", not "Academic" or "Engineering").
  category_id: z.string().uuid("Please choose a category.").nullable().optional(),
});

export type ClubFormValues = z.infer<typeof clubFormSchema>;
export type ClubFormInput = z.input<typeof clubFormSchema>;
