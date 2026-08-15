import { z } from "zod";

const text = z
  .object({
    text: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    code: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    link: z.string().url().optional(),
  })
  .strict();

const leafChildren = z.array(text).min(1);

const node: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), children: leafChildren }).strict(),
    z
      .object({
        type: z.literal("heading"),
        level: z.number().int().min(1).max(6),
        children: leafChildren,
      })
      .strict(),
    z.object({ type: z.literal("blockquote"), children: z.array(node).min(1) }).strict(),
    z.object({ type: z.literal("bullet_list"), children: z.array(node).min(1) }).strict(),
    z.object({ type: z.literal("ordered_list"), children: z.array(node).min(1) }).strict(),
    z.object({ type: z.literal("list_item"), children: z.array(node).min(1) }).strict(),
    z
      .object({
        type: z.literal("code_block"),
        language: z.string().max(64).optional(),
        children: leafChildren,
      })
      .strict(),
    z
      .object({
        type: z.literal("image"),
        url: z.string().url(),
        alt: z.string().max(500).optional(),
        title: z.string().max(500).optional(),
        children: z.tuple([z.object({ text: z.literal("") })]),
      })
      .strict(),
    z
      .object({
        type: z.literal("hard_break"),
        children: z.tuple([z.object({ text: z.literal("") })]),
      })
      .strict(),
    z
      .object({
        type: z.literal("club_mention"),
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        slug: z.string().max(200).optional(),
        logoUrl: z.string().url().nullable().optional(),
        children: z.tuple([z.object({ text: z.literal("") })]),
      })
      .strict(),
    z
      .object({
        type: z.literal("event_card"),
        eventId: z.string().uuid(),
        title: z.string().min(1).max(300),
        date: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        bannerUrl: z.string().url().nullable().optional(),
        clubName: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        children: z.tuple([z.object({ text: z.literal("") })]),
      })
      .strict(),
    z
      .object({
        type: z.literal("user_mention"),
        id: z.string().uuid(),
        label: z.string().min(1).max(200),
        children: z.tuple([z.object({ text: z.literal("") })]),
      })
      .strict(),
  ]),
);

export const richTextDocumentSchema = z.array(node).min(1).max(5000);
export type ValidatedRichTextDocument = z.infer<typeof richTextDocumentSchema>;

export const parseRichTextDocument = (value: unknown) => richTextDocumentSchema.parse(value);
