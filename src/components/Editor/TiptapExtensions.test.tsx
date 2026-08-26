import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ClubMentionNode } from "./extensions/ClubMentionExtension";
import { EventCardNode } from "./extensions/EventCardExtension";
import { TiptapReadOnlyViewer } from "./TiptapReadOnlyViewer";
import { TiptapRichTextEditor } from "./TiptapRichTextEditor";
import React from "react";

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: "club-1", name: "Robotics Club", slug: "robotics-club", logo_url: null },
              ],
            }),
          }),
        }),
      }),
    })),
  };
});

describe("Tiptap Custom Extensions", () => {
  it("ClubMentionNode is configured correctly", () => {
    expect(ClubMentionNode.name).toBe("clubMention");
    expect(ClubMentionNode.config.group).toBe("inline");
    expect(ClubMentionNode.config.inline).toBe(true);
    expect(ClubMentionNode.config.atom).toBe(true);
  });

  it("EventCardNode is configured correctly", () => {
    expect(EventCardNode.name).toBe("eventCard");
    expect(EventCardNode.config.group).toBe("block");
    expect(EventCardNode.config.atom).toBe(true);
  });

  it("renders TiptapReadOnlyViewer with content", () => {
    const htmlContent =
      "<p>Hello world with <span data-type='club-mention' data-name='CodingClub'>@CodingClub</span></p>";
    const { container } = render(<TiptapReadOnlyViewer content={htmlContent} />);
    expect(container).toBeDefined();
  });

  it("renders TiptapRichTextEditor with toolbar buttons", () => {
    const onChange = vi.fn();
    const { getByTitle } = render(
      <TiptapRichTextEditor content="<p>Test post</p>" onChange={onChange} />,
    );

    expect(getByTitle("Mention a Club")).toBeDefined();
    expect(getByTitle("Embed mini Event Card")).toBeDefined();
  });
});
