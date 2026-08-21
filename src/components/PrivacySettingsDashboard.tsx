import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface ClubPreference {
  club_id: string;
  club_name: string;
  email_enabled: boolean;
  push_enabled: boolean;
}

export default function PrivacySettingsDashboard({ userId }: { userId: string }) {
  const [preferences, setPreferences] = useState<ClubPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingGlobal, setProcessingGlobal] = useState(false);

  useEffect(() => {
    async function fetchPreferences() {
      // Fetches user preferences combined with club identities
      const { data, error } = await supabase
        .from('user_communication_preferences')
        .select(`
          club_id,
          email_enabled,
          push_enabled,
          clubs:club_id ( name )
        `)
        .eq('user_id', userId);

      if (!error && data) {
        const formatted = data.map((item: any) => ({
          club_id: item.club_id,
          club_name: item.clubs?.name || 'Unknown Club',
          email_enabled: item.email_enabled,
          push_enabled: item.push_enabled,
        }));
        setPreferences(formatted);
      }
      setLoading(false);
    }
    if (userId) {
      fetchPreferences();
    }
  }, [userId]);

  const togglePreference = async (clubId: string, type: 'email_enabled' | 'push_enabled', currentValue: boolean) => {
    const updatedValue = !currentValue;

    // Optimistic state update
    setPreferences(prev => prev.map(p => p.club_id === clubId ? { ...p, [type]: updatedValue } : p));

    const { error } = await supabase
      .from('user_communication_preferences')
      .update({
        [type]: updatedValue,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('club_id', clubId);

    if (error) {
      // Revert state if database update fails
      setPreferences(prev => prev.map(p => p.club_id === clubId ? { ...p, [type]: currentValue } : p));
    }
  };

  const handleNuclearUnsubscribe = async () => {
    if (!confirm('Are you absolutely sure you want to opt-out from all club communications?')) return;

    setProcessingGlobal(true);
    const { error } = await supabase.rpc('global_unsubscribe_all_communications', { target_user_id: userId });

    if (!error) {
      setPreferences(prev => prev.map(p => ({ ...p, email_enabled: false, push_enabled: false })));
      alert('You have been successfully unsubscribed from all non-essential platform communications.');
    } else {
      console.error("Error during global opt-out:", error);
      alert('Failed to process global opt-out. Please try again.');
    }
    setProcessingGlobal(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading privacy configurations...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl border border-gray-100 shadow-xl">
      <div className="border-b pb-4 mb-6">
        <h2 className="text-xl font-black text-gray-900">Privacy & Communications</h2>
        <p className="text-xs text-gray-500 mt-1">Manage marketing preferences and decentralized notification paths across followed spaces.</p>
      </div>

      <div className="space-y-4 mb-8">
        {preferences.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">You are not subscribed to any clubs yet.</p>
        ) : (
          preferences.map((pref) => (
            <div key={pref.club_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="font-bold text-gray-800 text-sm">{pref.club_name}</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pref.email_enabled}
                    onChange={() => togglePreference(pref.club_id, 'email_enabled', pref.email_enabled)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-gray-300"
                  />
                  <span className="text-xs font-semibold text-gray-600">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pref.push_enabled}
                    onChange={() => togglePreference(pref.club_id, 'push_enabled', pref.push_enabled)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-gray-300"
                  />
                  <span className="text-xs font-semibold text-gray-600">Push</span>
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-6 bg-red-50/50 p-4 rounded-xl border border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-red-900">Legal Master Opt-Out Clause</h4>
          <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">Instantly clear out and halt all dynamic email lists and device pushes platform-wide.</p>
        </div>
        <button
          onClick={handleNuclearUnsubscribe}
          disabled={processingGlobal || preferences.length === 0}
          className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-sm tracking-wider uppercase transition whitespace-nowrap disabled:opacity-40"
        >
          {processingGlobal ? 'Processing...' : 'Unsubscribe from EVERYTHING'}
        </button>
      </div>
    </div>
  );
}
