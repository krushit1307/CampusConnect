/* eslint-disable */
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, Heading2 } from 'lucide-react';

interface ProgramEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

export const ProgramEditor: React.FC = ({ initialContent = '', onChange }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none min-h-[200px] p-4 border rounded-b-md border-gray-300',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex gap-2 p-2 border border-b-0 border-gray-300 rounded-t-md bg-gray-50">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          <List size={16} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
