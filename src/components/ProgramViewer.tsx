import React, { useState } from 'react';
import { Bookmark } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

interface Section {
  id: string;
  title: string;
  content_html: string;
}

interface ProgramViewerProps {
  sections: Section[];
}

export const ProgramViewer: React.FC<ProgramViewerProps> = ({ sections }) => {
  // Keep track of bookmarked section IDs
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  
  const defaultTab = sections.length > 0 ? sections[0].id : '';

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!sections || sections.length === 0) {
    return <div className="p-8 text-center text-gray-500">No program details available yet.</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white min-h-screen flex flex-col sm:min-h-[600px] sm:border sm:rounded-xl sm:shadow-sm sm:overflow-hidden">
      <Tabs.Root defaultValue={defaultTab} className="flex flex-col w-full h-full">
        
        {/* Swipeable / Scrollable Header Tabs */}
        <Tabs.List className="flex w-full overflow-x-auto border-b border-gray-200 sticky top-0 bg-white z-10 no-scrollbar snap-x">
          {sections.map((section) => (
            <Tabs.Trigger
              key={section.id}
              value={section.id}
              className="px-5 py-4 text-sm md:text-base font-semibold whitespace-nowrap text-gray-500 hover:text-gray-900 data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 outline-none snap-start transition-colors"
            >
              {section.title}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-gray-50/30">
          {sections.map((section) => (
            <Tabs.Content key={section.id} value={section.id} className="outline-none focus:outline-none">
              
              {/* Title & Bookmark Button */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{section.title}</h2>
                <button
                  onClick={() => toggleBookmark(section.id)}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    bookmarked[section.id] 
                      ? 'bg-blue-100 text-blue-600 scale-105' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                  aria-label="Bookmark section"
                >
                  <Bookmark size={24} fill={bookmarked[section.id] ? "currentColor" : "none"} />
                </button>
              </div>
              
              {/* Rich Text Output - prose-lg ensures great mobile readability */}
              <div 
                className="prose prose-lg md:prose-xl prose-blue max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: section.content_html }}
              />
            </Tabs.Content>
          ))}
        </div>
        
      </Tabs.Root>
    </div>
  );
};
