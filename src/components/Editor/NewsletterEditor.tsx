import React, { useRef, useState } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Bold from "lucide-react/dist/esm/icons/bold";
import Italic from "lucide-react/dist/esm/icons/italic";
import Strikethrough from "lucide-react/dist/esm/icons/strikethrough";
import Code from "lucide-react/dist/esm/icons/code";
import Heading1 from "lucide-react/dist/esm/icons/heading-1";
import Heading2 from "lucide-react/dist/esm/icons/heading-2";
import Heading3 from "lucide-react/dist/esm/icons/heading-3";
import AlignLeft from "lucide-react/dist/esm/icons/align-left";
import AlignCenter from "lucide-react/dist/esm/icons/align-center";
import AlignRight from "lucide-react/dist/esm/icons/align-right";
import AlignJustify from "lucide-react/dist/esm/icons/align-justify";
import Highlighter from "lucide-react/dist/esm/icons/highlighter";
import LinkIcon from "lucide-react/dist/esm/icons/link";
import Unlink from "lucide-react/dist/esm/icons/unlink";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import List from "lucide-react/dist/esm/icons/list";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered";
import Quote from "lucide-react/dist/esm/icons/quote";
import Undo from "lucide-react/dist/esm/icons/undo";
import Redo from "lucide-react/dist/esm/icons/redo";
import FileCode from "lucide-react/dist/esm/icons/file-code";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Upload from "lucide-react/dist/esm/icons/upload";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import "./NewsletterEditor.css";

export const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1 MB

export interface NewsletterEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  uploadImageOverride?: (file: File) => Promise<string>;
}

export function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-2 rounded-lg neu-border border-black text-xs font-bold transition-all shrink-0",
        isActive
          ? "bg-black text-white shadow-none translate-x-[1px] translate-y-[1px]"
          : "bg-white text-black hover:bg-cream shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        disabled && "opacity-40 cursor-not-allowed shadow-none",
      )}
    >
      {children}
    </button>
  );
}

export function NewsletterEditorToolbar({
  editor,
  onImageSelect,
  showHtmlPreview,
  setShowHtmlPreview,
}: {
  editor: Editor | null;
  onImageSelect: () => void;
  showHtmlPreview: boolean;
  setShowHtmlPreview: (val: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter link URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const highlightColors = [
    { name: "Yellow", color: "#fef08a" },
    { name: "Green", color: "#bbf7d0" },
    { name: "Pink", color: "#fbcfe8" },
    { name: "Blue", color: "#bfdbfe" },
    { name: "Orange", color: "#fed7aa" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-3 border-b-2 border-black bg-cream rounded-t-xl font-mono text-xs">
      {/* Text Style Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-black/20">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Heading Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-black/20">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Text Alignment Controls (Ensures inline CSS style="text-align: ..." for email clients) */}
      <div className="flex items-center gap-1 pr-2 border-r border-black/20">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          title="Align Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Highlight & Link Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-black/20 relative">
        <ToolbarButton
          onClick={() => setShowHighlightPalette((prev) => !prev)}
          isActive={editor.isActive("highlight")}
          title="Highlight Text"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>

        {showHighlightPalette && (
          <div className="absolute left-0 top-full mt-2 z-50 p-2 bg-white neu-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg flex items-center gap-1.5">
            {highlightColors.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c.color }).run();
                  setShowHighlightPalette(false);
                }}
                className="w-6 h-6 rounded-full border border-black transition-transform hover:scale-110"
                style={{ backgroundColor: c.color }}
              />
            ))}
            <button
              type="button"
              title="Remove Highlight"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowHighlightPalette(false);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-black underline pl-1"
            >
              Clear
            </button>
          </div>
        )}

        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Remove Link"
          >
            <Unlink className="w-4 h-4 text-destructive" />
          </ToolbarButton>
        )}
      </div>

      {/* Image Upload & Lists */}
      <div className="flex items-center gap-1 pr-2 border-r border-black/20">
        <ToolbarButton onClick={onImageSelect} title="Upload Image (Max 1MB)">
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Undo / Redo / Raw HTML Toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setShowHtmlPreview((prev) => !prev)}
          isActive={showHtmlPreview}
          title="View Email HTML Output"
        >
          <FileCode className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

/**
 * Full WYSIWYG Editor for Club Newsletters (#1739).
 * Features inline CSS HTML output compatible with major email clients (Gmail, Outlook),
 * 1MB image upload limit, text alignment, multicolor highlights, and link insertion.
 */
export const NewsletterEditor: React.FC<NewsletterEditorProps> = ({
  initialContent = "<h2>Welcome to our Newsletter!</h2><p style=\"text-align: center;\">Write your email updates here. You can embed images, align text, and add colorful highlights.</p>",
  onChange,
  className,
  uploadImageOverride,
}) => {
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: "color: #2563eb; text-decoration: underline;",
        },
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);

    // 1MB Image File Size Restriction (#1739)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(
        `Image "${file.name}" exceeds the maximum 1MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB). Please choose a smaller image.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      let imageUrl = "";

      if (uploadImageOverride) {
        imageUrl = await uploadImageOverride(file);
      } else {
        // Upload to Supabase Storage
        const supabase = createClient();
        const fileExt = file.name.split(".").pop();
        const fileName = `newsletter_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `newsletters/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("club-media")
          .upload(filePath, file);

        if (uploadErr) {
          // Fallback to Data URL if storage bucket fails or offline
          imageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          const { data: publicUrlData } = supabase.storage
            .from("club-media")
            .getPublicUrl(filePath);
          imageUrl = publicUrlData.publicUrl;
        }
      }

      if (imageUrl && editor) {
        editor.chain().focus().setImage({ src: imageUrl }).run();
      }
    } catch (err: any) {
      setImageError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("w-full neu-border bg-white rounded-xl shadow-md overflow-hidden font-mono", className)}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload Newsletter Image"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Editor Toolbar */}
      <NewsletterEditorToolbar
        editor={editor}
        onImageSelect={() => fileInputRef.current?.click()}
        showHtmlPreview={showHtmlPreview}
        setShowHtmlPreview={setShowHtmlPreview}
      />

      {/* Image Size Error Alert */}
      {imageError && (
        <div className="p-3 bg-red-50 border-b-2 border-black text-destructive text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{imageError}</span>
          </div>
          <button
            type="button"
            onClick={() => setImageError(null)}
            className="underline text-[11px] hover:text-black"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="p-2 bg-lime/40 border-b-2 border-black text-black text-xs font-bold flex items-center gap-2">
          <Upload className="w-4 h-4 animate-bounce" />
          <span>Uploading newsletter image to server...</span>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="relative p-2 bg-gray-50/50 min-h-[340px]">
        <EditorContent editor={editor} />
      </div>

      {/* HTML Output Preview Modal / Pane */}
      {showHtmlPreview && editor && (
        <div className="border-t-2 border-black bg-cream p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black">
              Raw Email HTML Output (Serialized)
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(editor.getHTML());
              }}
              className="text-xs neu-border h-7 px-2"
            >
              Copy HTML
            </Button>
          </div>
          <textarea
            readOnly
            value={editor.getHTML()}
            rows={6}
            className="w-full p-3 font-mono text-xs neu-border bg-white text-black rounded-lg resize-none focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};
