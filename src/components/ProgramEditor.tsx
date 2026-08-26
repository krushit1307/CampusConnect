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
    
      
         editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          
        
         editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          
        
         editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          
        
         editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'p-1 rounded bg-gray-200' : 'p-1 rounded hover:bg-gray-200'}
          type="button"
        >
          
        
      
      
    
  );
};
