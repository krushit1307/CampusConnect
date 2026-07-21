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
  visibility: z.enum(["public", "private"]).default("public").optional(),
  social_links: z.record(z.string(), z.string().url()).default({}).optional(),
});

export type ClubFormValues = z.infer<typeof clubFormSchema>;
