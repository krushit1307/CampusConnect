import React, { useState } from 'react';
import { Bot, AlertTriangle, CheckCircle2, MessageSquare, ShieldCheck, RefreshCcw, Search, Zap, ArrowRight, Users, Database } from 'lucide-react';

interface FeedbackItem {
  id: string;
  studentName: string;
  feedback: string;
  urgencyLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  status: 'Pending' | 'Routed' | 'Resolved';
}

const INITIAL_FEEDBACK: FeedbackItem[] = [
  { id: 'f-1', studentName: 'Aarav Sharma', feedback: 'The food at the event was delicious and the venue was great!', urgencyLevel: 'Low', category: 'Positive', status: 'Pending' },
  { id: 'f-2', studentName: 'Priya Patel', feedback: 'The registration line was very long and confusing, took us 30 minutes.', urgencyLevel: 'Medium', category: 'Logistics', status: 'Pending' },
  { id: 'f-3', studentName: 'Rohan Mehta', feedback: 'There is a broken light in the hallway and it feels unsafe for walking.', urgencyLevel: 'High', category: 'Safety', status: 'Pending' },
  { id: 'f-4', studentName: 'Sneha Gupta', feedback: 'Someone tripped and fell on the stairs. They need immediate medical attention!', urgencyLevel: 'Critical', category: 'Emergency', status: 'Pending' },
];

const KEYWORDS = {
  Critical: ['emergency', 'urgent', 'medical', 'injured', 'danger', 'fire', 'unconscious'],
  High: ['unsafe', 'broken', 'safety', 'hazard', 'fall', 'accident'],
  Medium: ['long', 'confusing', 'crowded', 'wait', 'delay', 'issue'],
  Low: ['great', 'good', 'nice', 'enjoyed', 'loved', 'amazing'],
};

export default function NLPUrgencyRouter() {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(INITIAL_FEEDBACK);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('All');
  const [notification, setNotification] = useState('');

  const filteredFeedback = feedbackList.filter(item => {
    const matchesSearch = item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.feedback.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUrgency = filterUrgency === 'All' || item.urgencyLevel === filterUrgency;
    return matchesSearch && matchesUrgency;
  });

  const runNLP = (feedbackId: string) => {
    const item = feedbackList.find(f => f.id === feedbackId);
    if (item) {
      const feedbackLower = item.feedback.toLowerCase();
      
      // Simulate NLP analysis to determine urgency and category
      let detectedUrgency = item.urgencyLevel;
      let detectedCategory = item.category;
      
      if (KEYWORDS.Critical.some(keyword => feedbackLower.includes(keyword))) {
        detectedUrgency = 'Critical';
        detectedCategory = 'Emergency';
      } else if (KEYWORDS.High.some(keyword => feedbackLower.includes(keyword))) {
        detectedUrgency = 'High';
        detectedCategory = 'Safety';
      } else if (KEYWORDS.Medium.some(keyword => feedbackLower.includes(keyword))) {
        detectedUrgency = 'Medium';
        detectedCategory = 'Logistics';
      } else {
        detectedUrgency = 'Low';
        detectedCategory = 'Positive';
      }
      
      setFeedbackList(prev => prev.map(f => 
        f.id === feedbackId ? { ...f, urgencyLevel: detectedUrgency, category: detectedCategory, status: 'Routed' } : f
      ));
      
      setNotification(`NLP system routed feedback to ${detectedCategory} category with ${detectedUrgency} urgency.`);
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const resolveItem = (feedbackId: string) => {
    setFeedbackList(prev => prev.map(f => 
      f.id === feedbackId ? { ...f, status: 'Resolved' } : f
    ));
    setNotification('Feedback marked as resolved successfully.');
    setTimeout(() => setNotification(''), 3000);
  };

  const resetSystem = () => {
    setFeedbackList(INITIAL_FEEDBACK);
    setSearchQuery('');
    setFilterUrgency('All');
    setNotification('');
  };

  const getUrgencyColor = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'Critical': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'High': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'Medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

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
                  <Bot className="w-3.5 h-3.5" /> AI Powered
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-fuchsia-400" /> {feedbackList.length} Total Feedback
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
                Automated Event Feedback NLP Urgency Router
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically analyze student feedback, detect urgency, and route safety concerns to the correct category.
              </p>
            </div>
            <button onClick={resetSystem} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset System
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-xl"><MessageSquare className="w-6 h-6 text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold">{feedbackList.length}</p>
                <p className="text-slate-400 text-xs">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-rose-400" /></div>
              <div>
                <p className="text-2xl font-bold">{feedbackList.filter(f => f.urgencyLevel === 'Critical').length}</p>
                <p className="text-slate-400 text-xs">Critical</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-xl"><ShieldCheck className="w-6 h-6 text-orange-400" /></div>
              <div>
                <p className="text-2xl font-bold">{feedbackList.filter(f => f.urgencyLevel === 'High').length}</p>
                <p className="text-slate-400 text-xs">High</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{feedbackList.filter(f => f.status === 'Routed').length}</p>
                <p className="text-slate-400 text-xs">Routed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or feedback content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <select 
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="All">All Urgencies</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Feedback List */}
        <div className="bg-slate-900/80 border border-purple-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><Database className="w-5 h-5 text-purple-400" /> Feedback Queue</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredFeedback.map(item => (
              <div key={item.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{item.studentName}</h3>
                    <p className="text-sm text-slate-400 mt-1">{item.feedback}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getUrgencyColor(item.urgencyLevel)}`}>
                        {item.urgencyLevel}
                      </span>
                      <span className="text-slate-400">{item.category}</span>
                      <span className="text-slate-500">{item.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {item.status === 'Pending' && (
                    <button 
                      onClick={() => runNLP(item.id)}
                      className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" /> Run NLP
                    </button>
                  )}
                  {item.status === 'Routed' && (
                    <>
                      <span className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/30">
                        Routed
                      </span>
                      <button 
                        onClick={() => resolveItem(item.id)}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                      </button>
                    </>
                  )}
                  {item.status === 'Resolved' && (
                    <span className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
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
            <Bot className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-full">
            <ArrowRight className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-purple-300">Automated Safety Routing</h3>
            <p className="text-slate-400 text-sm">This is a standalone simulation. It does not modify any existing backend data.</p>
          </div>
        </div>

      </div>
    </div>
  );
}