import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CollaborativeDescriptionEditor from "./CollaborativeDescriptionEditor";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { state: null }, error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    channel: () => ({
      on: () => ({
        on: () => ({
          subscribe: (cb: any) => cb("SUBSCRIBED"),
        }),
      }),
      send: vi.fn(),
      unsubscribe: vi.fn(),
      presenceState: () => ({}),
      track: vi.fn(),
    }),
  }),
}));

// Mock TipTap dependencies to bypass heavy DOM render in tests
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
      }),
    }),
    getHTML: () => "<p>Test doc content</p>",
    commands: {
      setContent: vi.fn(),
    },
  }),
  EditorContent: () => <div data-testid="tiptap-content">Mocked TipTap Editor</div>,
}));

describe("CollaborativeDescriptionEditor Component", () => {
  it("renders loader initially while connecting to collab channel", () => {
    render(
      <CollaborativeDescriptionEditor
        eventId="test-event-uuid"
        initialDescription="Base event planning text"
        userId="user-123"
        userName="testeditor"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Connecting to collab board...")).toBeInTheDocument();
  });
});
