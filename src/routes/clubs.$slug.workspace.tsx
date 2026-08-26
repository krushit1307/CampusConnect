import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { CollaborativeWhiteboard } from '@/components/collaboration/CollaborativeWhiteboard';
import { CollaborativeNotes } from '@/components/collaboration/CollaborativeNotes';
import { WhiteboardElement, NoteDocument, UserPresence } from '@/types/collaboration';
import { PenTool, FileText, ArrowLeft, Sparkles, Radio } from 'lucide-react';

export default function ClubWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<'whiteboard' | 'notes'>('whiteboard');

  // Simulated Current User
  const [currentUser] = useState({
    id: 'user-self',
    name: 'You (Alex)',
    color: '#3b82f6',
  });

  // Simulated Active Collaborators
  const [activeUsers] = useState<UserPresence[]>([
    {
      id: 'user-1',
      name: 'Maya Lin',
      color: '#10b981',
      activeSection: 'whiteboard',
      cursor: { x: 320, y: 240 },
      lastActive: new Date().toISOString(),
    },
    {
      id: 'user-2',
      name: 'Devon Patel',
      color: '#ec4899',
      activeSection: 'notes',
      cursor: { x: 550, y: 380 },
      lastActive: new Date().toISOString(),
    },
    {
      id: 'user-self',
      name: 'You (Alex)',
      color: '#3b82f6',
      activeSection: 'whiteboard',
      lastActive: new Date().toISOString(),
    },
  ]);

  // Whiteboard Initial Elements
  const [elements, setElements] = useState<WhiteboardElement[]>([
    {
      id: 'el-1',
      type: 'sticky',
      x: 100,
      y: 80,
      text: 'Brainstorm: AI Hackathon Theme',
      color: '#f59e0b',
      strokeWidth: 2,
      authorId: 'user-1',
      authorName: 'Maya Lin',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'el-2',
      type: 'sticky',
      x: 280,
      y: 80,
      text: 'Keynote Speaker: Dr. Aris',
      color: '#10b981',
      strokeWidth: 2,
      authorId: 'user-2',
      authorName: 'Devon Patel',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'el-3',
      type: 'rectangle',
      x: 80,
      y: 220,
      width: 400,
      height: 180,
      color: '#1e293b',
      strokeWidth: 2,
      authorId: 'user-1',
      authorName: 'Maya Lin',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'el-4',
      type: 'text',
      x: 100,
      y: 250,
      text: 'Sprint Deliverables Schedule',
      color: '#1e293b',
      strokeWidth: 3,
      authorId: 'user-1',
      authorName: 'Maya Lin',
      createdAt: new Date().toISOString(),
    }
  ]);

  // Notes Initial Document
  const [document, setDocument] = useState<NoteDocument>({
    id: 'doc-1',
    title: 'Weekly Study Group & Project Sync',
    content: `# Club Workspace & Study Agenda\n\nWelcome to our live study room for **${slug || 'Club'}**!\n\n## Discussion Topics\n- [x] Review prerequisite course notes\n- [ ] Finalize team project milestones\n- [ ] Assign code reviews for sprint 3\n\n\`\`\`ts\n// Algorithm optimization snippet\nfunction binarySearch(arr: number[], target: number): number {\n  let left = 0, right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\n\`\`\`\n\nFeel free to write notes, edit sections, or switch to the whiteboard to sketch diagrams!`,
    version: 4,
    updatedAt: new Date().toISOString(),
    lastEditor: 'Maya Lin',
    tags: ['hackathon', 'study-group', 'sprint-3'],
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] p-4 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to={`/clubs/${slug}`}
                className="neu-border bg-white p-2.5 hover:bg-gray-50 flex items-center justify-center transition-transform hover:-translate-y-0.5"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-black">
                    Live Collaboration Hub
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-green-100 text-green-800 border border-green-300 animate-pulse">
                    <Radio size={12} className="text-green-600" /> Live Sync
                  </span>
                </div>
                <p className="text-sm font-mono text-gray-600">
                  Real-time multi-user study space for <span className="font-bold text-black">@{slug}</span>
                </p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="neu-border bg-white p-1.5 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('whiteboard')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'whiteboard'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <PenTool size={16} /> Shared Whiteboard
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'notes'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <FileText size={16} /> Collaborative Notes
              </button>
            </div>
          </div>

          {/* Interactive Workspace Area */}
          <div className="h-[750px] w-full">
            {activeTab === 'whiteboard' ? (
              <CollaborativeWhiteboard
                sessionId={`session-${slug}`}
                elements={elements}
                onElementsChange={setElements}
                activeUsers={activeUsers}
                currentUser={currentUser}
              />
            ) : (
              <CollaborativeNotes
                document={document}
                onDocumentChange={setDocument}
                activeUsers={activeUsers}
                currentUser={currentUser}
              />
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
