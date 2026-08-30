import React, { useState, useEffect } from 'react';
import { NoteDocument, UserPresence } from '@/types/collaboration';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Code,
  Save,
  Clock,
  Tag,
  Share2
} from 'lucide-react';

interface CollaborativeNotesProps {
  document: NoteDocument;
  onDocumentChange: (doc: NoteDocument) => void;
  activeUsers: UserPresence[];
  currentUser: { id: string; name: string };
}

export function CollaborativeNotes({
  document,
  onDocumentChange,
  activeUsers,
  currentUser
}: CollaborativeNotesProps) {
  const [content, setContent] = useState(document.content);
  const [title, setTitle] = useState(document.title);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(document.tags || []);
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    setContent(document.content);
    setTitle(document.title);
    setTags(document.tags || []);
  }, [document]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsSaved(false);

    onDocumentChange({
      ...document,
      title,
      content: newContent,
      tags,
      version: document.version + 1,
      updatedAt: new Date().toISOString(),
      lastEditor: currentUser.name,
    });
    setIsSaved(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    onDocumentChange({
      ...document,
      title: newTitle,
      version: document.version + 1,
      updatedAt: new Date().toISOString(),
      lastEditor: currentUser.name,
    });
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${prefix}${selectedText || 'text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    onDocumentChange({
      ...document,
      content: newContent,
      version: document.version + 1,
      updatedAt: new Date().toISOString(),
      lastEditor: currentUser.name,
    });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        const updatedTags = [...tags, tagInput.trim()];
        setTags(updatedTags);
        onDocumentChange({
          ...document,
          tags: updatedTags,
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);
    onDocumentChange({
      ...document,
      tags: updatedTags,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Top Header & Toolbar */}
      <div className="p-4 border-b-2 border-black bg-slate-50 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
            className="text-xl font-display font-black tracking-tight border-2 border-transparent hover:border-black focus:border-black px-2 py-1 bg-transparent rounded transition-all flex-1 min-w-[200px]"
          />

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 bg-white px-2.5 py-1 border-2 border-black rounded">
              <Clock size={14} />
              <span>v{document.version} • {document.lastEditor || 'Nobody'}</span>
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 border-2 border-black rounded font-mono text-xs font-bold"
              title="Share Link"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Formatting Buttons */}
        <div className="flex flex-wrap items-center gap-1 border-t-2 border-slate-200 pt-2">
          <button
            onClick={() => insertFormatting('# ', '')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            onClick={() => insertFormatting('## ', '')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => insertFormatting('- ', '')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => insertFormatting('1. ', '')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>
          <button
            onClick={() => insertFormatting('```\n', '\n```')}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-lime text-black transition-colors"
            title="Code Block"
          >
            <Code size={16} />
          </button>

          {/* Active Collaborators Avatars */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs font-mono font-bold text-gray-500 mr-1">Co-editing:</span>
            {activeUsers.map((user) => (
              <div
                key={user.id}
                className="w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                style={{ backgroundColor: user.color }}
                title={`${user.name} is online`}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 p-4 flex flex-col">
        <textarea
          id="notes-textarea"
          value={content}
          onChange={handleTextChange}
          placeholder="Start typing shared meeting notes, study materials, or agenda items..."
          className="w-full flex-1 resize-none font-mono text-sm leading-relaxed p-4 border-2 border-slate-200 focus:border-black rounded outline-hidden transition-all bg-white"
        />

        {/* Document Tags */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t-2 border-slate-100">
          <Tag size={14} className="text-gray-400" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-black rounded-full font-mono text-xs font-semibold"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-500 ml-0.5 text-gray-400"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Add tag and press Enter"
            className="font-mono text-xs border border-dashed border-gray-300 focus:border-black rounded px-2 py-1 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
