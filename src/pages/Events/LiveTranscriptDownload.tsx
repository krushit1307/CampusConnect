import React, { useState, useEffect } from 'react';
import { FileText, Download, Mic, RefreshCcw, Users, CheckCircle2, Clock, AlertTriangle, Share2, Languages, Volume2, MessageSquare } from 'lucide-react';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

const INITIAL_TRANSCRIPT: TranscriptSegment[] = [
  { id: 't-1', timestamp: '00:00:01', speaker: 'Host', text: 'Welcome everyone to the accessibility workshop!' },
  { id: 't-2', timestamp: '00:00:05', speaker: 'Host', text: 'Today we will cover the importance of live captions.' },
  { id: 't-3', timestamp: '00:00:10', speaker: 'Guest', text: 'Thank you for having me. Let’s begin with the basics.' },
  { id: 't-4', timestamp: '00:00:15', speaker: 'Guest', text: 'Real-time transcription ensures everyone has access to the content.' },
];

export default function LiveTranscriptDownload() {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>(INITIAL_TRANSCRIPT);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Simulate live transcript generation
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      const newSegment: TranscriptSegment = {
        id: `t-${Date.now()}`,
        timestamp: `00:00:${Math.floor(Math.random() * 20) + 15}`,
        speaker: 'AI Captioner',
        text: 'This is an automatically generated caption segment for accessibility.',
      };
      setTranscript(prev => [...prev, newSegment].slice(-10));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isLive]);

  const generateTranscriptFile = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
    }, 2000);
  };

  const resetTranscript = () => {
    setTranscript(INITIAL_TRANSCRIPT);
    setIsLive(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-teal-900/60 via-emerald-900/40 to-slate-900 border border-teal-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-teal-500/20 text-teal-300 text-xs px-3 py-1 rounded-full font-semibold border border-teal-500/30 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Accessibility
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" /> Live Captions
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-200 bg-clip-text text-transparent">
                Real-Time Accessibility Need Live Transcript Download
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Generate and download live transcripts for accessibility needs.
              </p>
            </div>
            <button onClick={resetTranscript} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Transcript
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-500/10 rounded-xl"><FileText className="w-6 h-6 text-teal-400" /></div>
              <div>
                <p className="text-2xl font-bold">{transcript.length}</p>
                <p className="text-slate-400 text-xs">Segments Captured</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><Volume2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">EN</p>
                <p className="text-slate-400 text-xs">Current Language</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Clock className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">Live</p>
                <p className="text-slate-400 text-xs">Stream Status</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript Feed */}
        <div className="bg-slate-900/80 border border-teal-500/20 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2"><Languages className="w-5 h-5 text-teal-400" /> Live Caption Feed</h2>
            <button 
              onClick={generateTranscriptFile}
              disabled={isDownloading}
              className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-lg shadow-teal-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isDownloading ? 'Downloading...' : 'Download Transcript'}
            </button>
          </div>

          <div className="space-y-4">
            {transcript.map(segment => (
              <div key={segment.id} className="bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-teal-400">{segment.speaker}</span>
                  <span className="text-xs text-slate-500">{segment.timestamp}</span>
                </div>
                <p className="text-slate-200">{segment.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Accessibility Note */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-teal-500/20 rounded-full">
            <Users className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-teal-300">Accessibility Feature</h3>
            <p className="text-slate-400 text-sm">This is a standalone frontend simulation. It does not modify any existing backend data.</p>
          </div>
        </div>

      </div>
    </div>
  );
}