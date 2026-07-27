import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ClubMentionNode } from "./extensions/ClubMentionExtension";
import { EventCardNode } from "./extensions/EventCardExtension";
import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  AtSign,
  Calendar,
  Search,
  X,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TiptapRichTextEditorProps {
  content: string;
  onChange: (htmlContent: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

interface ClubSearchResult {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface EventSearchResult {
  id: string;
  title: string;
  event_date?: string | null;
  start_date?: string | null;
  location?: string | null;
  banner_url?: string | null;
  clubs?: { name: string } | Array<{ name: string }> | null;
}

export const TiptapRichTextEditor: React.FC<TiptapRichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Write a post... (Use toolbar to insert @club mentions or mini Event Cards)",
  readOnly = false,
}) => {
  const supabase = createClient();

  // Modals for inserting mentions and event cards
  const [showClubModal, setShowClubModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // Search states for modals
  const [clubQuery, setClubQuery] = useState("");
  const [clubResults, setClubResults] = useState<ClubSearchResult[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);

  const [eventQuery, setEventQuery] = useState("");
  const [eventResults, setEventResults] = useState<EventSearchResult[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, ClubMentionNode, EventCardNode],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[160px] p-3 text-foreground",
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;

        // Check if pasted text contains an event URL: .../events/<eventId>
        const match = text.match(/\/events\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          const eventId = match[1];
          // Asynchronously fetch event details and insert node
          supabase
            .from("events")
            .select("id, title, event_date, start_date, location, banner_url, clubs(name)")
            .or(`id.eq.${eventId},id.ilike.${eventId}`)
            .maybeSingle()
            .then(({ data }) => {
              if (data && editor) {
                const clubName = Array.isArray(data.clubs) ? data.clubs[0]?.name : data.clubs?.name;

                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "eventCard",
                    attrs: {
                      eventId: data.id,
                      title: data.title,
                      date: data.start_date || data.event_date || null,
                      location: data.location || null,
                      bannerUrl: data.banner_url || null,
                      clubName: clubName || null,
                      url: `/events/${data.id}`,
                    },
                  })
                  .run();
              }
            });
          return true;
        }
        return false;
      },
    },
  });

  // Sync content prop changes when editor is initialized
  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Search Clubs in database
  const searchClubs = useCallback(
    async (q: string) => {
      setLoadingClubs(true);
      const { data } = await supabase
        .from("clubs")
        .select("id, name, slug, logo_url")
        .ilike("name", `%${q}%`)
        .limit(10);

      setClubResults((data as ClubSearchResult[]) || []);
      setLoadingClubs(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (showClubModal) {
      searchClubs(clubQuery);
    }
  }, [showClubModal, clubQuery, searchClubs]);

  // Search Events in database
  const searchEvents = useCallback(
    async (q: string) => {
      setLoadingEvents(true);
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, start_date, location, banner_url, clubs(name)")
        .ilike("title", `%${q}%`)
        .limit(10);

      setEventResults((data as EventSearchResult[]) || []);
      setLoadingEvents(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (showEventModal) {
      searchEvents(eventQuery);
    }
  }, [showEventModal, eventQuery, searchEvents]);

  // Insert Club Mention Node
  const handleSelectClub = (club: ClubSearchResult) => {
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "clubMention",
          attrs: {
            id: club.id,
            name: club.name,
            slug: club.slug,
            logoUrl: club.logo_url || null,
          },
        })
        .insertContent(" ")
        .run();
    }
    setShowClubModal(false);
    setClubQuery("");
  };

  // Insert Event Card Node
  const handleSelectEvent = (event: EventSearchResult) => {
    if (editor) {
      const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

      editor
        .chain()
        .focus()
        .insertContent({
          type: "eventCard",
          attrs: {
            eventId: event.id,
            title: event.title,
            date: event.start_date || event.event_date || null,
            location: event.location || null,
            bannerUrl: event.banner_url || null,
            clubName: clubName || null,
            url: `/events/${event.id}`,
          },
        })
        .run();
    }
    setShowEventModal(false);
    setEventQuery("");
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm">
      {/* Editor Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 border-b border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("bold") ? "bg-accent text-accent-foreground" : ""}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("italic") ? "bg-accent text-accent-foreground" : ""}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("code") ? "bg-accent text-accent-foreground" : ""}`}
            title="Code"
          >
            <Code className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`h-8 w-8 p-0 ${editor.isActive("heading", { level: 1 }) ? "bg-accent text-accent-foreground" : ""}`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`h-8 w-8 p-0 ${editor.isActive("heading", { level: 2 }) ? "bg-accent text-accent-foreground" : ""}`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("bulletList") ? "bg-accent text-accent-foreground" : ""}`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("orderedList") ? "bg-accent text-accent-foreground" : ""}`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`h-8 w-8 p-0 ${editor.isActive("blockquote") ? "bg-accent text-accent-foreground" : ""}`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Custom Extension Controls */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowClubModal(true)}
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
            title="Mention a Club"
          >
            <AtSign className="w-3.5 h-3.5 text-primary" />
            <span>@ Club</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowEventModal(true)}
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
            title="Embed mini Event Card"
          >
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>+ Event Card</span>
          </Button>
        </div>
      )}

      {/* Editor Surface */}
      <EditorContent editor={editor} className="min-h-[160px]" />

      {/* Club Selection Modal */}
      {showClubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl p-4 w-full max-w-md border shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <AtSign className="w-4 h-4 text-primary" />
                <span>Mention a Club</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowClubModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={clubQuery}
                onChange={(e) => setClubQuery(e.target.value)}
                placeholder="Search club by name..."
                className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            <div className="max-h-56 overflow-y-auto flex flex-col gap-1 border rounded-lg p-1">
              {loadingClubs ? (
                <p className="p-3 text-xs text-center text-muted-foreground">Searching clubs...</p>
              ) : clubResults.length === 0 ? (
                <p className="p-3 text-xs text-center text-muted-foreground">No clubs found.</p>
              ) : (
                clubResults.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => handleSelectClub(club)}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left text-sm transition-colors"
                  >
                    <span className="font-semibold text-foreground">@{club.name}</span>
                    <span className="text-xs text-muted-foreground">({club.slug})</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Selection Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl p-4 w-full max-w-md border shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Embed mini Event Card</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowEventModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={eventQuery}
                onChange={(e) => setEventQuery(e.target.value)}
                placeholder="Search event by title..."
                className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            <div className="max-h-56 overflow-y-auto flex flex-col gap-1 border rounded-lg p-1">
              {loadingEvents ? (
                <p className="p-3 text-xs text-center text-muted-foreground">Searching events...</p>
              ) : eventResults.length === 0 ? (
                <p className="p-3 text-xs text-center text-muted-foreground">No events found.</p>
              ) : (
                eventResults.map((event) => {
                  const clubName = Array.isArray(event.clubs)
                    ? event.clubs[0]?.name
                    : event.clubs?.name;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleSelectEvent(event)}
                      className="flex flex-col gap-0.5 p-2 hover:bg-accent rounded-md text-left text-sm transition-colors"
                    >
                      <span className="font-semibold text-foreground">{event.title}</span>
                      {clubName && (
                        <span className="text-xs text-muted-foreground">Hosted by {clubName}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
