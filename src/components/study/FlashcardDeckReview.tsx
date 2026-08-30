import React, { useState } from 'react';
import { Flashcard } from '@/types/transcription';
import { calculateNextReview, ReviewRating } from '@/lib/study/spacedRepetition';
import {
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Trophy,
} from 'lucide-react';

interface FlashcardDeckReviewProps {
  initialCards: Flashcard[];
  onSeekTimestamp?: (seconds: number) => void;
}

export function FlashcardDeckReview({
  initialCards,
  onSeekTimestamp,
}: FlashcardDeckReviewProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const currentCard = cards[currentIndex];

  const handleRating = (rating: ReviewRating) => {
    if (!currentCard) return;

    const updatedCard = calculateNextReview(currentCard, rating);
    const updatedCards = [...cards];
    updatedCards[currentIndex] = updatedCard;
    setCards(updatedCards);

    setIsFlipped(false);
    setCompletedCount((prev) => prev + 1);

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setCompletedCount(0);
  };

  if (!currentCard || completedCount >= cards.length) {
    return (
      <div className="bg-white border-2 border-black rounded-lg p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center space-y-4">
        <div className="w-16 h-16 bg-lime border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-xs">
          <Trophy size={32} className="text-black" />
        </div>
        <h3 className="font-display font-black text-2xl text-black">
          Deck Review Session Complete!
        </h3>
        <p className="font-mono text-xs text-gray-600 max-w-sm mx-auto">
          All {cards.length} flashcards have been scheduled into your personal spaced-repetition queue based on the SuperMemo SM-2 algorithm.
        </p>
        <button
          onClick={handleRestart}
          className="neu-border bg-lime hover:bg-lime/90 px-6 py-2.5 font-mono text-xs font-black uppercase text-black"
        >
          Review Deck Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-5">
      {/* Header with Progress */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <h3 className="font-display font-black text-lg text-black">
            AI-Synthesized Flashcard Deck
          </h3>
        </div>

        <div className="font-mono text-xs font-bold text-gray-600">
          Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      {/* Interactive 3D Flip Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="min-h-[220px] bg-slate-50 border-2 border-black rounded-lg p-6 flex flex-col justify-between cursor-pointer hover:bg-slate-100/80 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none"
      >
        <div className="flex justify-between items-center text-xs font-mono text-gray-500">
          <span className="uppercase font-bold">
            {isFlipped ? '💡 Answer / Synthesis' : '❓ Key Concept / Question'}
          </span>
          <span className="flex items-center gap-1">
            <RotateCw size={12} /> Click to flip
          </span>
        </div>

        <div className="my-auto py-4 text-center">
          <p className="font-display font-black text-xl text-black">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
        </div>

        {/* Card Footer Link */}
        <div className="flex justify-between items-center text-[11px] font-mono text-gray-500 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSeekTimestamp?.(currentCard.sourceTimestamp);
            }}
            className="flex items-center gap-1 text-blue-600 hover:underline font-bold"
          >
            <Clock size={12} /> Jump to Lecture Moment ({Math.floor(currentCard.sourceTimestamp / 60)}:{(currentCard.sourceTimestamp % 60).toString().padStart(2, '0')})
          </button>
          <span>Interval: {currentCard.intervalDays}d</span>
        </div>
      </div>

      {/* SM-2 Recall Rating Actions (Only active when flipped) */}
      {isFlipped ? (
        <div className="space-y-2">
          <div className="text-center font-mono text-xs font-bold text-gray-500 uppercase">
            Rate your recall difficulty (SM-2):
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleRating('again')}
              className="py-2.5 bg-red-100 hover:bg-red-200 text-red-800 border-2 border-black rounded font-mono text-xs font-black uppercase"
            >
              Again (1d)
            </button>
            <button
              onClick={() => handleRating('hard')}
              className="py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border-2 border-black rounded font-mono text-xs font-black uppercase"
            >
              Hard (2d)
            </button>
            <button
              onClick={() => handleRating('good')}
              className="py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-800 border-2 border-black rounded font-mono text-xs font-black uppercase"
            >
              Good (4d)
            </button>
            <button
              onClick={() => handleRating('easy')}
              className="py-2.5 bg-lime hover:bg-lime/90 text-black border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              Easy (7d)
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center font-mono text-xs text-gray-400 py-2">
          Flip card to reveal answer and update spaced repetition memory curve.
        </div>
      )}
    </div>
  );
}
