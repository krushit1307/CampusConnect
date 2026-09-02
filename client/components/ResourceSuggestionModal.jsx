// client/components/ResourceSuggestionModal.jsx
import React from 'react';

export const ResourceSuggestionModal = ({ isOpen, message, suggestions, onSelectSwap, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-card" style={{ background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '480px', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#d9534f' }}>⚠️ Resource Conflict Triggered</h3>
        <p style={{ color: '#555', fontSize: '0.95rem' }}>{message}</p>
        
        <div className="suggestion-engine-box" style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', margin: '1.5rem 0' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '0.75rem' }}>
            ALTERNATIVE RECOMMENDATIONS AVAILABLE AT THIS TIME:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {suggestions.length === 0 ? (
              <small style={{ color: '#999' }}>No backup hardware or smart rooms available.</small>
            ) : (
              suggestions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectSwap(item)}
                  style={{ background: '#0275d8', color: '#fff', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                  title={`Click to instantly swap to ${item.name}`}
                >
                  [{item.name}]
                </button>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#ccc', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
