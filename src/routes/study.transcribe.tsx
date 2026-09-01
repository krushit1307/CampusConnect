import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { InteractiveAudioTranscript } from '@/components/study/InteractiveAudioTranscript';
import { FlashcardDeckReview } from '@/components/study/FlashcardDeckReview';
import { LectureSession } from '@/types/transcription';
import {
  Headphones,
  Sparkles,
  Download,
  BookOpen,
  FileText,
  Layers,
  Upload,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export default function LectureTranscribePage() {
  const [activeTab, setActiveTab] = useState<'transcript' | 'flashcards' | 'summary'>('transcript');

  const [session, setSession] = useState<LectureSession>({
    id: 'lec-101',
    title: 'Lecture 14: Distributed Consensus & Raft Algorithm',
    courseCode: 'CS 310',
    instructor: 'Prof. Sarah Reynolds',
    recordedAt: '2026-08-25T14:00:00Z',
    durationSeconds: 180, // Demo length
    keyTakeaways: [
      'Split-vote scenarios are mitigated through randomized election timeouts (150ms-300ms).',
      'Leader Election ensures only candidates with the most up-to-date log can be elected.',
      'Log Replication requires strict majority quorum (N/2 + 1 nodes) before committing entry.',
      'Safety property guarantees that if a leader commits a log entry, all future leaders will contain that entry.',
    ],
    glossary: [
      { term: 'Raft', definition: 'A consensus algorithm designed for understandability, equivalent to Multi-Paxos in fault-tolerance.' },
      { term: 'Leader Election', definition: 'The process where a candidate transitions to a leader after gathering majority votes from follower nodes.' },
      { term: 'Term Number', definition: 'Logical clock counter acting as epoch to detect stale leaders and outdated term messages.' },
    ],
    flashcards: [
      {
        id: 'fc-1',
        front: 'What prevents perpetual split votes during a Raft leader election?',
        back: 'Randomized election timeouts (typically 150ms-300ms) prevent simultaneous candidate transitions.',
        sourceTimestamp: 45,
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: '2026-08-28T00:00:00Z',
        difficulty: 'medium',
      },
      {
        id: 'fc-2',
        front: 'What quorum is required for a Raft leader to commit a log entry?',
        back: 'A strict majority quorum consisting of (N/2 + 1) operational nodes in the cluster.',
        sourceTimestamp: 110,
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: '2026-08-28T00:00:00Z',
        difficulty: 'easy',
      },
      {
        id: 'fc-3',
        front: 'How does Raft resolve conflicting log entries between leader and followers?',
        back: 'The leader forces followers to overwrite their logs by finding the latest matching entry index and replaying from there.',
        sourceTimestamp: 155,
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: '2026-08-28T00:00:00Z',
        difficulty: 'hard',
      },
    ],
    segments: [
      {
        id: 'seg-1',
        speaker: 'Prof. Sarah Reynolds',
        startTime: 0,
        endTime: 40,
        text: 'Welcome back everyone. Today we are diving into distributed consensus protocols, specifically contrasting Raft against traditional Multi-Paxos.',
        words: [
          { word: 'Welcome', start: 0.0, end: 0.8, confidence: 0.98 },
          { word: 'back', start: 0.9, end: 1.4, confidence: 0.99 },
          { word: 'everyone.', start: 1.5, end: 2.2, confidence: 0.97 },
          { word: 'Today', start: 2.5, end: 3.1, confidence: 0.99 },
          { word: 'we', start: 3.2, end: 3.5, confidence: 0.99 },
          { word: 'are', start: 3.6, end: 3.9, confidence: 0.99 },
          { word: 'diving', start: 4.0, end: 4.8, confidence: 0.95 },
          { word: 'into', start: 4.9, end: 5.3, confidence: 0.99 },
          { word: 'distributed', start: 5.4, end: 6.2, confidence: 0.98 },
          { word: 'consensus', start: 6.3, end: 7.1, confidence: 0.98 },
          { word: 'protocols,', start: 7.2, end: 8.0, confidence: 0.96 },
          { word: 'specifically', start: 8.2, end: 9.0, confidence: 0.94 },
          { word: 'contrasting', start: 9.1, end: 9.8, confidence: 0.95 },
          { word: 'Raft', start: 9.9, end: 10.5, confidence: 0.99 },
          { word: 'against', start: 10.6, end: 11.2, confidence: 0.98 },
          { word: 'traditional', start: 11.3, end: 12.0, confidence: 0.97 },
          { word: 'Multi-Paxos.', start: 12.1, end: 13.0, confidence: 0.95 },
        ],
      },
      {
        id: 'seg-2',
        speaker: 'Student Q&A',
        startTime: 42,
        endTime: 95,
        text: 'Professor, what happens if two candidates request votes at the exact same millisecond?',
        words: [
          { word: 'Professor,', start: 42.0, end: 42.8, confidence: 0.98 },
          { word: 'what', start: 42.9, end: 43.3, confidence: 0.99 },
          { word: 'happens', start: 43.4, end: 44.0, confidence: 0.99 },
          { word: 'if', start: 44.1, end: 44.4, confidence: 0.99 },
          { word: 'two', start: 44.5, end: 44.9, confidence: 0.99 },
          { word: 'candidates', start: 45.0, end: 45.8, confidence: 0.97 },
          { word: 'request', start: 45.9, end: 46.5, confidence: 0.98 },
          { word: 'votes', start: 46.6, end: 47.1, confidence: 0.98 },
          { word: 'at', start: 47.2, end: 47.5, confidence: 0.99 },
          { word: 'the', start: 47.6, end: 47.9, confidence: 0.99 },
          { word: 'exact', start: 48.0, end: 48.6, confidence: 0.98 },
          { word: 'same', start: 48.7, end: 49.2, confidence: 0.99 },
          { word: 'millisecond?', start: 49.3, end: 50.2, confidence: 0.96 },
        ],
      },
      {
        id: 'seg-3',
        speaker: 'Prof. Sarah Reynolds',
        startTime: 98,
        endTime: 180,
        text: 'Great question. Raft addresses this by using randomized election timeouts between 150 and 300 milliseconds. One candidate will almost always time out first and collect the majority quorum before the other.',
        words: [
          { word: 'Great', start: 98.0, end: 98.5, confidence: 0.99 },
          { word: 'question.', start: 98.6, end: 99.3, confidence: 0.99 },
          { word: 'Raft', start: 99.5, end: 100.0, confidence: 0.99 },
          { word: 'addresses', start: 100.1, end: 100.8, confidence: 0.97 },
          { word: 'this', start: 100.9, end: 101.3, confidence: 0.99 },
          { word: 'by', start: 101.4, end: 101.7, confidence: 0.99 },
          { word: 'using', start: 101.8, end: 102.3, confidence: 0.98 },
          { word: 'randomized', start: 102.4, end: 103.2, confidence: 0.96 },
          { word: 'election', start: 103.3, end: 103.9, confidence: 0.98 },
          { word: 'timeouts', start: 104.0, end: 104.7, confidence: 0.97 },
          { word: 'between', start: 104.8, end: 105.3, confidence: 0.98 },
          { word: '150', start: 105.4, end: 106.0, confidence: 0.97 },
          { word: 'and', start: 106.1, end: 106.4, confidence: 0.99 },
          { word: '300', start: 106.5, end: 107.1, confidence: 0.97 },
          { word: 'milliseconds.', start: 107.2, end: 108.2, confidence: 0.96 },
        ],
      },
    ],
  });

  const handleExportMarkdown = () => {
    const md = `# ${session.title}\n**Course:** ${session.courseCode} | **Instructor:** ${session.instructor}\n\n## Key Takeaways\n${session.keyTakeaways.map((k) => `- ${k}`).join('\n')}\n\n## Glossary\n${session.glossary.map((g) => `### ${g.term}\n${g.definition}`).join('\n\n')}\n\n## Transcript\n${session.segments.map((s) => `**[${Math.floor(s.startTime / 60)}:${(s.startTime % 60).toString().padStart(2, '0')}] ${s.speaker}:**\n${s.text}`).join('\n\n')}`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.courseCode}-lecture-notes.md`;
    a.click();
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Headphones size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  AI Lecture Transcription & Synthesis
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                {session.courseCode} • {session.title} • {session.instructor}
              </p>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMarkdown}
                className="neu-border bg-white hover:bg-slate-100 px-4 py-2.5 font-mono text-xs font-black uppercase text-black flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Download size={14} /> Export Markdown
              </button>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="neu-border bg-white p-1.5 flex items-center gap-2 max-w-fit">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                activeTab === 'transcript'
                  ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <FileText size={16} /> Sync Transcript
            </button>
            <button
              onClick={() => setActiveTab('flashcards')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                activeTab === 'flashcards'
                  ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Layers size={16} /> SM-2 Flashcards ({session.flashcards.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                activeTab === 'summary'
                  ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              <Sparkles size={16} /> Executive Summary
            </button>
          </div>

          {/* Dynamic Content Body */}
          {activeTab === 'transcript' ? (
            <div className="h-[620px]">
              <InteractiveAudioTranscript
                segments={session.segments}
                durationSeconds={session.durationSeconds}
              />
            </div>
          ) : activeTab === 'flashcards' ? (
            <div className="max-w-2xl mx-auto">
              <FlashcardDeckReview initialCards={session.flashcards} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key Takeaways */}
              <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" /> Synthesized Key Takeaways
                </h3>
                <ul className="space-y-2 font-mono text-xs leading-relaxed text-gray-800">
                  {session.keyTakeaways.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-bold text-lime-700 mt-0.5">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Glossary */}
              <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
                  <BookOpen size={20} className="text-purple-600" /> Concept Glossary
                </h3>
                <div className="space-y-3 font-mono text-xs">
                  {session.glossary.map((g, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded">
                      <div className="font-bold text-black mb-1">{g.term}</div>
                      <div className="text-gray-600">{g.definition}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
