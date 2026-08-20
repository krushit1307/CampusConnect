import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient'; // Adjust based on your Supabase config

export default function SpeakerControlPanel({ streamId }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [isPollActive, setIsPollActive] = useState(false);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const launchPoll = async () => {
    if (!question || options.some(opt => !opt.trim())) return;

    const pollData = {
      type: 'POLL_START',
      data: {
        streamId,
        question,
        options: options.map(text => ({ text, votes: 0 })),
        createdAt: Date.now()
      }
    };

    // Broadcast payload via Supabase Realtime channel
    const channel = supabase.channel(`stream_${streamId}`);
    await channel.send({
      type: 'broadcast',
      event: 'poll_update',
      payload: pollData,
    });

    setIsPollActive(true);
  };

  const closePoll = async () => {
    const channel = supabase.channel(`stream_${streamId}`);
    await channel.send({
      type: 'broadcast',
      event: 'poll_update',
      payload: { type: 'POLL_CLOSE' },
    });

    setIsPollActive(false);
    setQuestion('');
    setOptions(['', '', '', '']);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-bold mb-3">Speaker Poll Control Panel</h3>
      {!isPollActive ? (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full p-2 border rounded"
          />
          {options.map((opt, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
              className="w-full p-2 border rounded"
            />
          ))}
          <button
            onClick={launchPoll}
            className="w-full bg-blue-600 text-white p-2 rounded font-semibold hover:bg-blue-700"
          >
            Launch Poll
          </button>
        </div>
      ) : (
        <button
          onClick={closePoll}
          className="w-full bg-red-600 text-white p-2 rounded font-semibold hover:bg-red-700"
        >
          Close Active Poll
        </button>
      )}
    </div>
  );
}
