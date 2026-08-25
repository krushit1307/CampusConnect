import { useState } from "react";
import {
  Layers, Plus, Trash2, X, Brain, CheckCircle2,
} from "lucide-react";
import { useFlashcards } from "../../hooks/useFlashcards";

interface AddDeckModalProps {
  onAdd: (name: string, desc: string) => void;
  onClose: () => void;
}

function AddDeckModal({ onAdd, onClose }: AddDeckModalProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-100">New Deck</h4>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name..." autoFocus
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description..." rows={2}
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </div>
        <button onClick={() => { if (name.trim()) { onAdd(name, desc); onClose(); } }}
          disabled={!name.trim()}
          className="w-full mt-4 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">
          Create Deck
        </button>
      </div>
    </div>
  );
}

interface AddCardModalProps {
  onAdd: (front: string, back: string) => void;
  onClose: () => void;
}

function AddCardModal({ onAdd, onClose }: AddCardModalProps) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");

  const handleBatch = () => {
    const lines = batchText.split("\n").filter((l) => l.includes("|"));
    lines.forEach((line) => {
      const [f, b] = line.split("|").map((s) => s.trim());
      if (f && b) onAdd(f, b);
    });
    onClose();
  };

  const batchPlaceholder = "front | back\nfront | back";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-100">Add Card</h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setBatchMode(!batchMode)}
              className={"text-[10px] font-mono rounded-lg px-2 py-1 border transition-all " + (batchMode ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-500")}>
              Batch
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
          </div>
        </div>
        {batchMode ? (
          <>
            <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={8} placeholder={batchPlaceholder}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono" />
            <button onClick={handleBatch} disabled={!batchText.trim()}
              className="w-full mt-3 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">
              Import Cards
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Front</label>
                <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={3} placeholder="Question or term..."
                  className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" autoFocus />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Back</label>
                <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} placeholder="Answer or definition..."
                  className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <button onClick={() => { if (front.trim() && back.trim()) { onAdd(front, back); setFront(""); setBack(""); } }}
              disabled={!front.trim() || !back.trim()}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">
              Add Card
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const QUALITY_BUTTONS = [
  { q: 0, label: "Again", cls: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25" },
  { q: 2, label: "Hard", cls: "bg-orange-500/15 text-orange-400 border-orange-500/25 hover:bg-orange-500/25" },
  { q: 3, label: "Good", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25" },
  { q: 5, label: "Easy", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25" },
];

export default function FlashcardStudyDeck() {
  const {
    decks, cards, selectedDeckId, setSelectedDeckId, addDeck, removeDeck,
    addCard, removeCard, reviewCard, getDeckStats, studySession,
    sessionIndex, advanceSession, resetSession, clearAllData,
  } = useFlashcards();

  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const deckStats = selectedDeckId ? getDeckStats(selectedDeckId) : null;
  const currentCard = studySession[sessionIndex];

  const handleReview = (quality: number) => {
    if (!currentCard) return;
    reviewCard(currentCard.id, quality);
    setIsFlipped(false);
    if (sessionIndex + 1 >= studySession.length) {
      setReviewComplete(true);
    } else {
      advanceSession();
    }
  };

  const startStudy = () => {
    resetSession();
    setIsFlipped(false);
    setReviewComplete(false);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/20">
            <Layers size={18} className="text-rose-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Flashcards</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {decks.length} deck{decks.length !== 1 ? "s" : ""} &middot; {cards.length} card{cards.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDeckId && (
            <button onClick={() => setShowAddCard(true)}
              className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2 transition-all">
              <Plus size={14} /> Card
            </button>
          )}
          <button onClick={() => setShowAddDeck(true)}
            className="flex items-center gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-400 text-xs font-bold rounded-xl px-3 py-2 transition-all">
            <Plus size={14} /> Deck
          </button>
          <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!selectedDeckId ? (
        /* Deck List */
        decks.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {decks.map((deck) => {
              const stats = getDeckStats(deck.id);
              const barWidth = stats.totalCards > 0 ? stats.masteryPercent : 0;
              return (
                <button key={deck.id} onClick={() => setSelectedDeckId(deck.id)}
                  className="text-left p-4 rounded-xl border border-slate-700/40 transition-all hover:border-slate-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-200">{deck.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeDeck(deck.id); }}
                      className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                  {deck.description && <p className="text-[10px] text-slate-500 mb-2 line-clamp-1">{deck.description}</p>}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span>{stats.totalCards} cards</span>
                    {stats.cardsDueToday > 0 && <span className="text-amber-400">{stats.cardsDueToday} due</span>}
                  </div>
                  {stats.totalCards > 0 && (
                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: barWidth + "%" }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <Layers size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-xs text-slate-500">No decks yet</p>
            <p className="text-[10px] text-slate-600">Create a deck to start studying</p>
          </div>
        )
      ) : reviewComplete ? (
        /* Review Complete */
        <div className="text-center py-10">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" />
          <h4 className="text-lg font-bold text-slate-100 mb-1">Session Complete!</h4>
          <p className="text-xs text-slate-400 mb-4">
            You reviewed {studySession.length} card{studySession.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setSelectedDeckId(null)}
              className="text-xs text-slate-400 hover:text-slate-200 py-2 px-4 rounded-xl border border-slate-700 transition-colors">
              Back to Decks
            </button>
            <button onClick={startStudy}
              className="text-xs text-white bg-blue-500 hover:bg-blue-400 py-2 px-4 rounded-xl font-bold transition-colors">
              Study Again
            </button>
          </div>
        </div>
      ) : currentCard ? (
        /* Study Mode */
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSelectedDeckId(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
              &larr; Back to {selectedDeck?.name}
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              {sessionIndex + 1} / {studySession.length}
            </span>
          </div>

          <div className="h-1.5 bg-slate-800 rounded-full mb-5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: ((sessionIndex + 1) / studySession.length * 100) + "%" }} />
          </div>

          <div onClick={() => setIsFlipped(!isFlipped)}
            className={"min-h-[200px] rounded-2xl border p-6 flex items-center justify-center cursor-pointer transition-all " +
              (isFlipped ? "bg-blue-500/10 border-blue-500/30" : "bg-slate-800/60 border-slate-700/40 hover:border-slate-600")}>
            <div className="text-center">
              <span className="text-[9px] font-mono text-slate-600 uppercase block mb-3">
                {isFlipped ? "Answer" : "Question"}
              </span>
              <p className="text-lg text-slate-200 leading-relaxed whitespace-pre-wrap">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
              {!isFlipped && <p className="text-[10px] text-slate-600 mt-4">Click to reveal answer</p>}
            </div>
          </div>

          {isFlipped && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {QUALITY_BUTTONS.map(({ q, label, cls }) => (
                <button key={q} onClick={() => handleReview(q)}
                  className={"text-xs font-bold py-2.5 rounded-xl border transition-all " + cls}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Deck Detail */
        <div>
          <button onClick={() => setSelectedDeckId(null)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors mb-4 block">
            &larr; All Decks
          </button>

          {deckStats && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 text-center">
                <span className="text-lg font-black text-slate-100 block">{deckStats.totalCards}</span>
                <span className="text-[9px] font-mono text-slate-500">Cards</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <span className="text-lg font-black text-amber-400 block">{deckStats.cardsDueToday}</span>
                <span className="text-[9px] font-mono text-slate-500">Due Today</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <span className="text-lg font-black text-emerald-400 block">{Math.round(deckStats.masteryPercent)}%</span>
                <span className="text-[9px] font-mono text-slate-500">Mastered</span>
              </div>
            </div>
          )}

          {deckStats && deckStats.cardsDueToday > 0 && (
            <button onClick={startStudy}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl py-3 mb-4 transition-colors shadow-lg shadow-blue-500/20">
              <Brain size={16} /> Study {deckStats.cardsDueToday} Due Card{deckStats.cardsDueToday !== 1 ? "s" : ""}
            </button>
          )}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {cards.filter((c) => c.deckId === selectedDeckId).map((card) => (
              <div key={card.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{card.front}</p>
                  <p className="text-[10px] text-slate-600 truncate">{card.back}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono text-slate-600">EF:{card.easeFactor.toFixed(1)}</span>
                  <span className="text-[9px] font-mono text-slate-600">&times;{card.repetitions}</span>
                  <button onClick={() => removeCard(card.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
            {cards.filter((c) => c.deckId === selectedDeckId).length === 0 && (
              <div className="text-center py-6 text-xs text-slate-600">
                No cards yet. Click &quot;+ Card&quot; to add some.
              </div>
            )}
          </div>
        </div>
      )}

      {showAddDeck && <AddDeckModal onAdd={addDeck} onClose={() => setShowAddDeck(false)} />}
      {showAddCard && selectedDeckId && (
        <AddCardModal onAdd={(f, b) => addCard(selectedDeckId, f, b)} onClose={() => setShowAddCard(false)} />
      )}
    </div>
  );
}
