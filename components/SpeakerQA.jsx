import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

export default function SpeakerQA({ eventId, userId, isModerator = false }) {
    const [questions, setQuestions] = useState([]);
    const [newQuestionText, setNewQuestionText] = useState('');

    useEffect(() => {
        fetchQuestions();

        // Subscribe to real-time insertions and updates on live_questions
        const subscription = supabase
            .channel(`public:live_questions:event_id=eq.${eventId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_questions', filter: `event_id=eq.${eventId}` }, payload => {
                fetchQuestions(); // Refresh and re-sort
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [eventId]);

    const fetchQuestions = async () => {
        const { data, error } = await supabase
            .from('live_questions')
            .select('*')
            .eq('event_id', eventId)
            .order('upvotes', { ascending: false })
            .order('created_at', { ascending: true });

        if (!error) setQuestions(data || []);
    };

    const handleAskQuestion = async (e) => {
        e.preventDefault();
        if (!newQuestionText.trim()) return;

        await supabase.from('live_questions').insert([
            { event_id: eventId, user_id: userId, question_text: newQuestionText, upvotes: 0 }
        ]);

        setNewQuestionText('');
    };

    const handleUpvote = async (questionId) => {
        // RPC or transaction to prevent double voting & increment upvotes
        const { error } = await supabase.rpc('increment_upvote', { q_id: questionId, u_id: userId });
        if (error) {
            // Fallback optimistic or alert if already voted
            console.error("Already upvoted or error:", error);
        }
    };

    if (isModerator) {
        // Specialized Moderator View for Speakers on Stage
        const topQuestions = questions.slice(0, 3);
        return (
            <div style={{ background: '#111', color: '#fff', padding: '40px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
                <h1 style={{ fontSize: '36px', color: '#f39c12', marginBottom: '30px' }}>🎤 Live Speaker Q&A - Top Questions</h1>
                {topQuestions.length === 0 ? (
                    <p style={{ fontSize: '24px', opacity: 0.7 }}>Waiting for audience questions...</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {topQuestions.map((q, index) => (
                            <div key={q.id} style={{ background: '#222', borderLeft: '8px solid #088178', padding: '25px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '20px', color: '#088178', fontWeight: 'bold' }}>#{index + 1} ({q.upvotes} Upvotes)</span>
                                <p style={{ fontSize: '32px', marginTop: '10px', lineHeight: '1.4' }}>"{q.question_text}"</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Standard Audience View
    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>Ask the Speaker</h2>
            <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <input 
                    type="text" 
                    value={newQuestionText} 
                    onChange={(e) => setNewQuestionText(e.target.value)} 
                    placeholder="Type your question..." 
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <button type="submit" style={{ background: '#088178', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Ask</button>
            </form>

            <h3>Audience Queue (Crowdsourced)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {questions.map((q) => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                        <p style={{ margin: 0, flex: 1, fontSize: '16px' }}>{q.question_text}</p>
                        <button 
                            onClick={() => handleUpvote(q.id)}
                            style={{ background: '#fff', border: '1px solid #088178', color: '#088178', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            ▲ {q.upvotes}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
