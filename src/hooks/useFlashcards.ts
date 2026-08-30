import { useState, useCallback, useEffect, useMemo } from "react";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  deckId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReviewed: string | null;
  createdAt: string;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  cardCount: number;
  cardsReviewed: number;
}

export interface DeckStats {
  totalCards: number;
  cardsDueToday: number;
  cardsReviewedToday: number;
  masteryPercent: number;
  averageEaseFactor: number;
}

const DECK_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
];

const STORAGE_KEY = "cc-flashcards";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function loadDecks(): FlashcardDeck[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY + "-decks") ?? "[]"); } catch { return []; }
}

function loadCards(): Flashcard[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY + "-cards") ?? "[]"); } catch { return []; }
}

function saveDecks(decks: FlashcardDeck[]): void {
  localStorage.setItem(STORAGE_KEY + "-decks", JSON.stringify(decks));
}

function saveCards(cards: Flashcard[]): void {
  localStorage.setItem(STORAGE_KEY + "-cards", JSON.stringify(cards));
}

/** SM-2 spaced repetition: quality 0-5 */
function sm2Update(card: Flashcard, quality: number): Flashcard {
  let { easeFactor, interval, repetitions } = card;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
  }
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);
  return { ...card, easeFactor, interval, repetitions, nextReview: daysFromNow(interval), lastReviewed: new Date().toISOString() };
}

export interface UseFlashcardsReturn {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  selectedDeckId: string | null;
  setSelectedDeckId: (id: string | null) => void;
  addDeck: (name: string, description: string) => string;
  removeDeck: (id: string) => void;
  addCard: (deckId: string, front: string, back: string) => void;
  removeCard: (id: string) => void;
  reviewCard: (cardId: string, quality: number) => void;
  getDueCards: (deckId?: string) => Flashcard[];
  getDeckStats: (deckId: string) => DeckStats;
  studySession: Flashcard[];
  sessionIndex: number;
  advanceSession: () => void;
  resetSession: () => void;
  clearAllData: () => void;
  deckColors: string[];
}

export function useFlashcards(): UseFlashcardsReturn {
  const [decks, setDecks] = useState<FlashcardDeck[]>(loadDecks);
  const [cards, setCards] = useState<Flashcard[]>(loadCards);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);

  useEffect(() => { saveDecks(decks); }, [decks]);
  useEffect(() => { saveCards(cards); }, [cards]);
  useEffect(() => {
    setDecks((prev) => prev.map((d) => ({ ...d, cardCount: cards.filter((c) => c.deckId === d.id).length })));
  }, [cards]);

  const addDeck = useCallback((name: string, description: string): string => {
    const id = `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const color = DECK_COLORS[decks.length % DECK_COLORS.length];
    setDecks((prev) => [...prev, { id, name: name.trim(), description: description.trim(), color, createdAt: new Date().toISOString(), cardCount: 0, cardsReviewed: 0 }]);
    return id;
  }, [decks.length]);

  const removeDeck = useCallback((id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id));
    setCards((prev) => prev.filter((c) => c.deckId !== id));
    if (selectedDeckId === id) setSelectedDeckId(null);
  }, [selectedDeckId]);

  const addCard = useCallback((deckId: string, front: string, back: string) => {
    setCards((prev) => [...prev, {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      front: front.trim(), back: back.trim(), deckId,
      easeFactor: 2.5, interval: 0, repetitions: 0,
      nextReview: new Date().toISOString(), lastReviewed: null, createdAt: new Date().toISOString(),
    }]);
  }, []);

  const removeCard = useCallback((id: string) => { setCards((prev) => prev.filter((c) => c.id !== id)); }, []);

  const reviewCard = useCallback((cardId: string, quality: number) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? sm2Update(c, quality) : c)));
  }, []);

  const getDueCards = useCallback((deckId?: string): Flashcard[] => {
    const now = new Date();
    return cards.filter((c) => {
      if (deckId && c.deckId !== deckId) return false;
      return new Date(c.nextReview) <= now;
    });
  }, [cards]);

  const getDeckStats = useCallback((deckId: string): DeckStats => {
    const deckCards = cards.filter((c) => c.deckId === deckId);
    const due = deckCards.filter((c) => new Date(c.nextReview) <= new Date());
    const today = todayStr();
    const reviewedToday = deckCards.filter((c) => c.lastReviewed && c.lastReviewed.startsWith(today));
    const mastered = deckCards.filter((c) => c.repetitions >= 3);
    return {
      totalCards: deckCards.length,
      cardsDueToday: due.length,
      cardsReviewedToday: reviewedToday.length,
      masteryPercent: deckCards.length > 0 ? (mastered.length / deckCards.length) * 100 : 0,
      averageEaseFactor: deckCards.length > 0 ? deckCards.reduce((s, c) => s + c.easeFactor, 0) / deckCards.length : 2.5,
    };
  }, [cards]);

  const studySession = useMemo(() => {
    if (!selectedDeckId) return [];
    const due = getDueCards(selectedDeckId);
    for (let i = due.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [due[i], due[j]] = [due[j], due[i]];
    }
    return due;
  }, [selectedDeckId, getDueCards]);

  const advanceSession = useCallback(() => { setSessionIndex((p) => p + 1); }, []);
  const resetSession = useCallback(() => { setSessionIndex(0); }, []);
  const clearAllData = useCallback(() => {
    setDecks([]); setCards([]); setSelectedDeckId(null); setSessionIndex(0);
    localStorage.removeItem(STORAGE_KEY + "-decks");
    localStorage.removeItem(STORAGE_KEY + "-cards");
  }, []);

  return { decks, cards, selectedDeckId, setSelectedDeckId, addDeck, removeDeck, addCard, removeCard, reviewCard, getDueCards, getDeckStats, studySession, sessionIndex, advanceSession, resetSession, clearAllData, deckColors: DECK_COLORS };
}

export { DECK_COLORS };
