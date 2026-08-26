// src/components/Editor/NewsletterEditor.tsx
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Type,
  Heading,
  Image as ImageIcon,
  Calendar,
  Send,
  Save,
  Eye,
  Trash2,
  Plus,
  Loader2,
  Link as LinkIcon,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { NewsletterBlock, NewsletterDesign, Newsletter } from "@/types/newsletter";
import { NewsletterService } from "@/services/newsletterService";
import { createClient } from "@/lib/supabase/client";

interface NewsletterEditorProps {
  clubId: string;
  existingNewsletter?: Newsletter | null;
  onSaved?: (newsletter: Newsletter) => void;
  onCancel?: () => void;
}

export function NewsletterEditor({
  clubId,
  existingNewsletter,
  onSaved,
  onCancel,
}: NewsletterEditorProps) {
  const [title, setTitle] = useState(existingNewsletter?.title || "");
  const [subject, setSubject] = useState(existingNewsletter?.subject || "");
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(
    existingNewsletter?.design_json?.blocks || [
      { id: "b1", type: "heading", content: "Welcome to Our Club Newsletter!" },
      { id: "b2", type: "text", content: "Here is what we've been working on this month..." },
    ],
  );
  const [backgroundColor, setBackgroundColor] = useState(
    existingNewsletter?.design_json?.backgroundColor || "#ffffff",
  );

  const [clubEvents, setClubEvents] = useState<any[]>([]);
  const [eventMap, setEventMap] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [currentNewsletter, setCurrentNewsletter] = useState<Newsletter | null>(
    existingNewsletter || null,
  );

  const supabase = createClient();

  useEffect(() => {
    async function loadClubEvents() {
      if (!clubId) return;
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, start_date, location, banner_url")
        .eq("club_id", clubId)
        .order("start_date", { ascending: false });

      if (data) {
        setClubEvents(data);
        const map: Record<string, any> = {};
        data.forEach((e) => (map[e.id] = e));
        setEventMap(map);
      }
    }

    loadClubEvents();
  }, [clubId]);

  const handleAddBlock = (type: NewsletterBlock["type"]) => {
    const newBlock: NewsletterBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      content:
        type === "heading"
          ? "New Section Title"
          : type === "text"
            ? "Enter paragraph content..."
            : type === "button"
              ? "Learn More"
              : "",
      url: type === "button" ? "https://campusconnect.app" : "",
      eventId: type === "event_card" && clubEvents.length > 0 ? clubEvents[0].id : undefined,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleUpdateBlock = (id: string, updates: Partial<NewsletterBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleImageUpload = async (blockId: string, file: File) => {
    if (file.size > 1024 * 1024) {
      toast.error("Image file size exceeds 1MB limit!");
      return;
    }

    try {
      const ext = file.name.split(".").pop();
      const path = `newsletters/${clubId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("club-banners")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("club-banners").getPublicUrl(uploadData.path);

      handleUpdateBlock(blockId, { url: urlData.publicUrl });
      toast.success("Image uploaded successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image.");
    }
  };

  const compiledHtml = NewsletterService.compileDesignToHtml({ blocks, backgroundColor }, eventMap);

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a newsletter title.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter an email subject line.");
      return;
    }

    try {
      setSaving(true);
      const saved = await NewsletterService.saveNewsletterDraft({
        id: currentNewsletter?.id,
        clubId,
        title,
        subject,
        designJson: { blocks, backgroundColor },
        contentHtml: compiledHtml,
      });

      setCurrentNewsletter(saved);
      toast.success("Newsletter draft saved successfully!");
      if (onSaved) onSaved(saved);
    } catch (err: any) {
      toast.error(err.message || "Failed to save newsletter draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchNewsletter = async () => {
    let target = currentNewsletter;
    if (!target || !target.id) {
      try {
        setSaving(true);
        target = await NewsletterService.saveNewsletterDraft({
          clubId,
          title,
          subject,
          designJson: { blocks, backgroundColor },
          contentHtml: compiledHtml,
        });
        setCurrentNewsletter(target);
      } catch (err: any) {
        toast.error("Failed to save newsletter before dispatch.");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    try {
      setDispatching(true);
      await NewsletterService.dispatchNewsletter(target.id, clubId);
      setShowDispatchModal(false);
      toast.success("Newsletter dispatch initiated! Emails are sending in batches of 50.");
      if (onSaved) onSaved(target);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch newsletter.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Editor Top Bar */}
      <div className="neu-border p-4 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Newsletter Template Builder
          </h2>
          <p className="font-mono text-xs text-gray-500 mt-0.5">
            Design rich HTML emails with text, images, and dynamic event cards.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowPreviewModal(true)}
            variant="outline"
            size="sm"
            className="neu-border font-mono text-xs uppercase font-bold"
          >
            <Eye className="h-4 w-4 mr-1" /> Preview HTML
          </Button>
          <Button
            onClick={handleSaveDraft}
            disabled={saving}
            size="sm"
            className="neu-border bg-black text-white hover:bg-zinc-800 font-mono text-xs uppercase font-bold"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}{" "}
            Save Draft
          </Button>
          <Button
            onClick={() => setShowDispatchModal(true)}
            size="sm"
            className="neu-border bg-red-600 text-white hover:bg-red-700 font-mono text-xs uppercase font-bold"
          >
            <Send className="h-4 w-4 mr-1" /> Send Newsletter
          </Button>
        </div>
      </div>

      {/* Meta Form: Title & Subject */}
      <div className="neu-border p-4 bg-white dark:bg-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
        <div>
          <label className="block font-bold uppercase mb-1">Newsletter Title (Internal) *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. August 2026 Monthly Digest"
            required
          />
        </div>
        <div>
          <label className="block font-bold uppercase mb-1">Email Subject Line *</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. 📢 Important Updates & Upcoming Events!"
            required
          />
        </div>
      </div>

      {/* Editor Main Canvas & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Toolbar: Drag / Click Block Controls */}
        <div className="lg:col-span-1 neu-border p-4 bg-white dark:bg-zinc-900 space-y-4">
          <h3 className="font-mono text-xs font-bold uppercase border-b border-black pb-2 text-black dark:text-white">
            Add Content Block
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleAddBlock("heading")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <Heading className="h-4 w-4 text-purple-600" /> Heading
            </Button>
            <Button
              onClick={() => handleAddBlock("text")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <Type className="h-4 w-4 text-blue-600" /> Paragraph
            </Button>
            <Button
              onClick={() => handleAddBlock("image")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <ImageIcon className="h-4 w-4 text-green-600" /> Image
            </Button>
            <Button
              onClick={() => handleAddBlock("event_card")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <Calendar className="h-4 w-4 text-orange-600" /> Event Card
            </Button>
            <Button
              onClick={() => handleAddBlock("button")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <LinkIcon className="h-4 w-4 text-indigo-600" /> Button
            </Button>
            <Button
              onClick={() => handleAddBlock("divider")}
              variant="outline"
              size="sm"
              className="neu-border font-mono text-xs flex items-center justify-start gap-1.5"
            >
              <Plus className="h-4 w-4 text-gray-600" /> Divider
            </Button>
          </div>
        </div>

        {/* Center Canvas: Live Editable Blocks */}
        <div className="lg:col-span-3 neu-border bg-gray-100 dark:bg-zinc-950 p-6 min-h-[400px] space-y-4">
          {blocks.length === 0 ? (
            <div className="text-center py-16 font-mono text-xs text-gray-500">
              Canvas is empty. Click a block on the left toolbar to add content!
            </div>
          ) : (
            blocks.map((b) => (
              <div
                key={b.id}
                className="relative group neu-border bg-white dark:bg-zinc-900 p-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              >
                <button
                  onClick={() => handleDeleteBlock(b.id)}
                  title="Remove Block"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>

                {b.type === "heading" && (
                  <div>
                    <span className="font-mono text-[9px] uppercase font-bold text-purple-600 block mb-1">
                      Heading Block
                    </span>
                    <Input
                      value={b.content || ""}
                      onChange={(e) => handleUpdateBlock(b.id, { content: e.target.value })}
                      className="font-display font-bold text-lg"
                      placeholder="Section Heading..."
                    />
                  </div>
                )}

                {b.type === "text" && (
                  <div>
                    <span className="font-mono text-[9px] uppercase font-bold text-blue-600 block mb-1">
                      Text Paragraph
                    </span>
                    <Textarea
                      value={b.content || ""}
                      onChange={(e) => handleUpdateBlock(b.id, { content: e.target.value })}
                      rows={3}
                      className="font-mono text-xs"
                      placeholder="Write your paragraph..."
                    />
                  </div>
                )}

                {b.type === "image" && (
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-green-600 block">
                      Image Block (Max 1MB)
                    </span>
                    {b.url ? (
                      <div className="space-y-2">
                        <img
                          src={b.url}
                          alt=""
                          className="max-h-48 object-cover border-2 border-black"
                        />
                        <Input
                          value={b.url}
                          onChange={(e) => handleUpdateBlock(b.id, { url: e.target.value })}
                          className="font-mono text-xs"
                          placeholder="Image URL..."
                        />
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files?.[0] && handleImageUpload(b.id, e.target.files[0])
                        }
                        className="font-mono text-xs cursor-pointer"
                      />
                    )}
                  </div>
                )}

                {b.type === "event_card" && (
                  <div>
                    <span className="font-mono text-[9px] uppercase font-bold text-orange-600 block mb-1">
                      Dynamic Event Card
                    </span>
                    {clubEvents.length === 0 ? (
                      <p className="font-mono text-xs text-red-500 italic">
                        No events found for this club.
                      </p>
                    ) : (
                      <select
                        value={b.eventId || ""}
                        onChange={(e) => handleUpdateBlock(b.id, { eventId: e.target.value })}
                        className="w-full p-2 neu-border font-mono text-xs bg-amber-50"
                      >
                        {clubEvents.map((evt) => (
                          <option key={evt.id} value={evt.id}>
                            {evt.title} (
                            {new Date(evt.start_date || evt.event_date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {b.type === "button" && (
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>
                      <label className="block font-bold mb-1 text-[10px]">Button Text</label>
                      <Input
                        value={b.content || ""}
                        onChange={(e) => handleUpdateBlock(b.id, { content: e.target.value })}
                        placeholder="Click Here"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-[10px]">Target Link (URL)</label>
                      <Input
                        value={b.url || ""}
                        onChange={(e) => handleUpdateBlock(b.id, { url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}

                {b.type === "divider" && (
                  <div className="py-2 text-center font-mono text-xs text-gray-400">
                    --- Horizontal Rule Divider ---
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* HTML Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="neu-border bg-white dark:bg-zinc-900 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold uppercase">
              Newsletter Compiled HTML Preview
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-gray-500">
              Subject: <strong>{subject || "Untitled Newsletter"}</strong>
            </DialogDescription>
          </DialogHeader>
          <div
            className="neu-border p-4 bg-gray-50 dark:bg-zinc-950 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: compiledHtml }}
          />
          <DialogFooter>
            <Button
              onClick={() => setShowPreviewModal(false)}
              className="neu-border font-mono text-xs uppercase font-bold"
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send / Dispatch Confirmation Modal */}
      <Dialog open={showDispatchModal} onOpenChange={setShowDispatchModal}>
        <DialogContent className="neu-border bg-white dark:bg-zinc-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold uppercase text-red-600">
              Dispatch Newsletter
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-gray-600 dark:text-gray-400 space-y-2 mt-2">
              <span className="block">
                Are you sure you want to dispatch{" "}
                <strong>"{title || subject || "this newsletter"}"</strong>?
              </span>
              <span className="block p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                ⚡ Emails will be dispatched in <strong>batches of 50</strong>. Unsubscribed members
                will be automatically excluded.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDispatchModal(false)}
              className="neu-border font-mono text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDispatchNewsletter}
              disabled={dispatching}
              className="neu-border bg-red-600 text-white hover:bg-red-700 font-mono text-xs font-bold uppercase"
            >
              {dispatching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}{" "}
              Dispatch Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
