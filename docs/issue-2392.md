# Issue #2392

CampusConnect currently defines `posts.content` as `TEXT`, while the Tiptap
editor emits HTML with `editor.getHTML()`. The issue requires moving the
persistence contract to a strictly validated JSONB AST and removing raw HTML
rendering.

## Rollout

1. Apply the additive SQL migration.
2. Backfill `content_ast` and `plaintext_content` with the migration script.
3. Verify every post has a valid AST.
4. Change the application read/write boundary to use `content_ast`.
5. Only after verification, rename `content_ast` to `content` and remove the
   legacy HTML column.

## Search

Never use `content LIKE '%term%'` after the migration. Query
`plaintext_content` with PostgreSQL full-text search.

## Rendering

Use `RichTextRenderer` for stored content. Do not render stored content through
a raw HTML sink.

## Validation

Call `parseRichTextDocument(payload.content)` before insert/update.
