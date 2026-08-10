import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ClubMentionNode } from "./extensions/ClubMentionExtension";
import { EventCardNode } from "./extensions/EventCardExtension";
import React, { useEffect } from "react";

interface TiptapReadOnlyViewerProps {
  content: string;
  className?: string;
}

export const TiptapReadOnlyViewer: React.FC<TiptapReadOnlyViewerProps> = ({
  content,
  className = "",
}) => {
  const editor = useEditor({
    extensions: [StarterKit, ClubMentionNode, EventCardNode],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none text-foreground",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
};
