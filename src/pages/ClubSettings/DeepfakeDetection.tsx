import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCcw, Search, ScanFace, ShieldCheck, ImageOff, Brain, Zap, Users, Database } from 'lucide-react';

interface PhotoAnalysis {
  id: string;
  memberName: string;
  photoUrl: string;
  status: 'Pending' | 'Verified' | 'Flagged';
  aiConfidence: number;
  uploadedDate: string;
}

const INITIAL_PHOTOS: PhotoAnalysis[] = [
  { id: 'p-1', memberName: 'Aarav Sharma', photoUrl: 'https://via.placeholder.com/150', status: 'Pending', aiConfidence: 0, uploadedDate: '2026-08-27' },
  { id: 'p-2', memberName: 'Priya Patel', photoUrl: 'https://via.placeholder.com/150', status: 'Pending', aiConfidence: 0, uploadedDate: '2026-08-27' },
  { id: 'p-3', memberName: 'Rohan Mehta', photoUrl: 'https://via.placeholder.com/150', status: 'Pending', aiConfidence: 0, uploadedDate: '2026-08-26' },
  { id: 'p-4', memberName: 'Sneha Gupta', photoUrl: 'https://via.placeholder.com/150', status: 'Pending', aiConfidence: 0, uploadedDate: '2026-08-25' },
];

export default function DeepfakeDetection() {
  const [photos, setPhotos] = useState<PhotoAnalysis[]>(INITIAL_PHOTOS);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState('');

  const filteredPhotos = photos.filter(photo => 
    photo.memberName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const analyzePhoto = (photoId: string) => {
    // Simulating AI Analysis
    const randomConfidence = Math.floor(Math.random() * 100);
    const isFlagged = randomConfidence > 70;
    
    setPhotos(prev => prev.map(photo => 
      photo.id === photoId ? { 
        ...photo, 
        status: isFlagged ? 'Flagged' : 'Verified', 
        aiConfidence: randomConfidence 
      } : photo
    ));
    
    setNotification(`AI analysis completed for member. Confidence score: ${randomConfidence}%`);
    setTimeout(() => setNotification(''), 3000);
  };

  const resetSystem = () => {
    setPhotos(INITIAL_PHOTOS);
    setSearchQuery('');
    setNotification('');
  };

  const flaggedCount = photos.filter(photo => photo.status === 'Flagged').length;
  const verifiedCount = photos.filter(photo => photo.status === 'Verified').length;
  const pendingCount = photos.filter(photo => photo.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-900/60 via-fuchsia-900/40 to-slate-900 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> AI Powered
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <ScanFace className="w-3.5 h-3.5 text-fuchsia-400" /> Deepfake Detection
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
                Automated Missing Photo Deepfake/AI Generation Detection
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically analyze member photos to detect AI-generated deepfakes.
              </p>
            </div>
            <button onClick={resetSystem} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset System
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-xl"><Users className="w-6 h-6 text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold">{photos.length}</p>
                <p className="text-slate-400 text-xs">Total Photos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{verifiedCount}</p>
                <p className="text-slate-400 text-xs">Verified</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-rose-400" /></div>
              <div>
                <p className="text-2xl font-bold">{flaggedCount}</p>
                <p className="text-slate-400 text-xs">Flagged</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by member name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Photo Analysis List */}
        <div className="bg-slate-900/80 border border-purple-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><Database className="w-5 h-5 text-purple-400" /> Photo Analysis Queue</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredPhotos.map(photo => (
              <div key={photo.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                    <ImageOff className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{photo.memberName}</h3>
                    <p className="text-xs text-slate-400">Uploaded: {photo.uploadedDate}</p>
                    {photo.aiConfidence > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-24 bg-slate-700 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${photo.status === 'Flagged' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${photo.aiConfidence}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">AI Confidence: {photo.aiConfidence}%</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {photo.status === 'Pending' && (
                    <button 
                      onClick={() => analyzePhoto(photo.id)}
                      className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" /> Analyze
                    </button>
                  )}
                  {photo.status === 'Verified' && (
                    <span className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                  {photo.status === 'Flagged' && (
                    <span className="px-3 py-2 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Flagged
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-sm text-purple-300 flex items-center gap-3">
            <Brain className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* AI Footer */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-full">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-purple-300">AI Deepfake Detection</h3>
            <p className="text-slate-400 text-sm">This is a standalone simulation. It does not modify any existing backend data.</p>
          </div>
        </div>

      </div>
    </div>
  );
}