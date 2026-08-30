/**
 * Event Catering Predictive Forecast Dashboard Page
 * Route: /events/:eventId/catering-forecast
 * Issue #4290
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  DietaryPredictionResult,
  HistoricalEventDietarySample,
} from '../../types/dietaryPredictiveModel';
import { dietaryPredictiveService } from '../../services/dietaryPredictiveService';
import { DietaryPredictiveEstimateWidget } from '../../components/events/DietaryPredictiveEstimateWidget';
import { DietaryHistoricalTrendsChart } from '../../components/events/DietaryHistoricalTrendsChart';
import {
  Utensils,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronLeft,
  Calendar,
  Building,
} from 'lucide-react';

export default function EventCateringForecastPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [capacity, setCapacity] = useState(500);
  const [prediction, setPrediction] = useState<DietaryPredictionResult | null>(null);
  const [historicalSamples, setHistoricalSamples] = useState<HistoricalEventDietarySample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (targetCapacity = capacity) => {
    setIsLoading(true);
    try {
      const samples = await dietaryPredictiveService.fetchClubHistoricalDietary('club-tech');
      setHistoricalSamples(samples);

      const pred = await dietaryPredictiveService.generateDietaryPrediction(
        targetCapacity,
        'club-tech',
        eventId || 'evt-gala-2026',
        'Campus Tech Club'
      );
      setPrediction(pred);
    } catch (err) {
      console.error('Failed to load catering forecast:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(capacity);
  }, [eventId]);

  const handleCapacityChange = (newCapacity: number) => {
    setCapacity(newCapacity);
    if (historicalSamples.length > 0) {
      dietaryPredictiveService
        .generateDietaryPrediction(
          newCapacity,
          'club-tech',
          eventId || 'evt-gala-2026',
          'Campus Tech Club'
        )
        .then(setPrediction);
    }
  };

  const handleOrderSubmit = async (pred: DietaryPredictionResult) => {
    await dietaryPredictiveService.savePredictionOrder(pred);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Pre-RSVP Dietary Predictive Analytics
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Machine-estimated catering procurement breakdown derived from past 5 club
              events and campus demographic priors.
            </p>
          </div>
        </div>

        <button
          onClick={() => loadData(capacity)}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
          title="Recalculate Model"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Grid: Prediction Widget & Historical Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {prediction && (
            <DietaryPredictiveEstimateWidget
              prediction={prediction}
              onCapacityChange={handleCapacityChange}
              onOrderSubmit={handleOrderSubmit}
            />
          )}
        </div>

        <div className="space-y-6">
          <DietaryHistoricalTrendsChart samples={historicalSamples} />
        </div>
      </div>
    </div>
  );
}
