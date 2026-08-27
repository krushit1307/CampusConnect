import React from "react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange }) => {
  return (
    <div className="p-6 bg-white border rounded-lg shadow-sm w-full">
      <h3 className="text-lg font-bold mb-4">Markdown Editor Component</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-40 p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type markdown here..."
      />
    </div>
  );
};
