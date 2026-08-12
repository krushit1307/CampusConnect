import { useEffect, useState } from "react";
import {
  Brain,
  Cpu,
  CloudRain,
  Sun,
  Cloud,
  AlertCircle,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

interface PredictiveTurnoutProps {
  rsvpCount: number;
  latitude: number | null;
  longitude: number | null;
  location?: string;
  clubName: string;
}

interface PredictionResult {
  likelyTurnout: number;
  predictedAttendees: number;
}

export function PredictiveTurnout({
  rsvpCount,
  latitude,
  longitude,
  location = "",
  clubName,
}: PredictiveTurnoutProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [weatherScore, setWeatherScore] = useState<number>(0.8);
  const [weatherText, setWeatherText] = useState<string>("Pleasant / Clear");
  const [historicalRatio, setHistoricalRatio] = useState<number>(0.85); // Default high club turnout
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // 1. Fetch weather forecast from Open-Meteo API
  useEffect(() => {
    let active = true;

    async function fetchWeather() {
      // If we don't have lat/long, try parsing from location name or use default
      if (latitude === null || longitude === null) {
        setWeatherScore(0.8);
        setWeatherText("Optimal Weather (Default)");
        return;
      }

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather API failed");

        const data = await res.json();
        if (!active) return;

        const code = data?.current_weather?.weathercode ?? 0;

        // Map WMO weather codes to scores and labels
        let score = 0.8;
        let text = "Cloudy / Pleasant";

        if (code === 0) {
          score = 1.0;
          text = "Sunny / Clear";
        } else if (code >= 1 && code <= 3) {
          score = 0.85;
          text = "Partly Cloudy";
        } else if (code === 45 || code === 48) {
          score = 0.7;
          text = "Foggy / Hazy";
        } else if (code >= 51 && code <= 57) {
          score = 0.5;
          text = "Light Drizzle";
        } else if (code >= 61 && code <= 67) {
          score = 0.4;
          text = "Moderate Rain";
        } else if (code >= 71 && code <= 77) {
          score = 0.3;
          text = "Snowing / Cold";
        } else if (code >= 80 && code <= 82) {
          score = 0.3;
          text = "Heavy Rain Showers";
        } else if (code >= 95) {
          score = 0.1;
          text = "Thunderstorm / Severe";
        }

        setWeatherScore(score);
        setWeatherText(text);
      } catch (err) {
        console.warn("[Predictive Turnout] Fetching weather forecast failed, falling back:", err);
        if (active) {
          setWeatherScore(0.8);
          setWeatherText("Sunny / Mild (Fallback)");
        }
      }
    }

    fetchWeather();
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  // 2. Load Web Worker and run turnout prediction model
  useEffect(() => {
    if (rsvpCount === 0) {
      setPrediction({ likelyTurnout: 0.8, predictedAttendees: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    let worker: Worker | null = null;

    try {
      worker = new Worker(new URL("/workers/prediction.js", window.location.origin));

      worker.onmessage = (event) => {
        const { type, likelyTurnout, predictedAttendees, error } = event.data;

        if (type === "result") {
          setPrediction({ likelyTurnout, predictedAttendees });
          setLoading(false);
        } else if (type === "error") {
          setErrorMsg(error || "Model execution failed");
          setLoading(false);
          worker?.terminate();
        }
      };

      // Feed historical turnout variables into worker
      worker.postMessage({
        rsvpCount,
        historicalRatio,
        weatherScore,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to start TF.js Web Worker");
      setLoading(false);
    }

    return () => {
      if (worker) worker.terminate();
    };
  }, [rsvpCount, weatherScore, historicalRatio]);

  const getWeatherIcon = () => {
    if (weatherScore >= 0.85) return <Sun className="h-5 w-5 text-amber-500" />;
    if (weatherScore >= 0.6) return <Cloud className="h-5 w-5 text-gray-500" />;
    return <CloudRain className="h-5 w-5 text-blue-500 animate-bounce" />;
  };

  if (loading) {
    return (
      <div className="neu-border bg-white p-6 animate-pulse flex flex-col gap-3">
        <div className="h-4 w-48 bg-black/10 rounded-none" />
        <div className="h-10 w-24 bg-black/10 rounded-none mt-2" />
        <div className="h-4 w-full bg-black/10 rounded-none mt-1" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="neu-border bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
        <div>
          <span className="font-mono text-sm font-bold text-red-800 uppercase block">
            RSVP Prediction Error
          </span>
          <span className="font-mono text-xs text-red-600 block mt-1">{errorMsg}</span>
        </div>
      </div>
    );
  }

  const turnoutPercentage = Math.round((prediction?.likelyTurnout ?? 0.8) * 100);
  const expectedCount = prediction?.predictedAttendees ?? 0;

  return (
    <div className="neu-border bg-white p-6 space-y-4">
      {/* Header Info */}
      <div className="flex justify-between items-center border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-900" />
          <h3 className="font-display text-sm font-bold uppercase tracking-tight text-black">
            Turnout Prediction Analytics
          </h3>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 border border-black/10">
          <Cpu className="h-3 w-3" />
          TF.JS CLIENT INFERENCE
        </div>
      </div>

      {/* Main Turnout Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-4xl font-extrabold text-black">{turnoutPercentage}%</span>
          <span className="font-mono text-sm text-gray-500 block uppercase font-bold mt-1">
            Likely Turnout Rate
          </span>
        </div>

        <div className="text-left sm:text-right font-mono">
          <span className="text-xl font-bold text-indigo-900">
            {expectedCount} / {rsvpCount}
          </span>
          <span className="text-xs text-gray-500 block uppercase mt-1">Expected Attendees</span>
        </div>
      </div>

      {/* Prediction Factors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-black/10 pt-4 font-mono text-xs">
        {/* Weather Factor */}
        <div className="bg-gray-50 p-3 border border-black/10 flex flex-col justify-between h-20">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Weather Factor</span>
          <div className="flex items-center gap-1.5 mt-2">
            {getWeatherIcon()}
            <span className="font-bold text-black truncate">{weatherText}</span>
          </div>
        </div>

        {/* Historical Turnout Factor */}
        <div className="bg-gray-50 p-3 border border-black/10 flex flex-col justify-between h-20">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Club History</span>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="font-bold text-black">{(historicalRatio * 100).toFixed(0)}% Avg</span>
          </div>
        </div>

        {/* Saturation Factor */}
        <div className="bg-gray-50 p-3 border border-black/10 flex flex-col justify-between h-20">
          <span className="text-[10px] text-gray-500 uppercase font-bold">RSVP Saturation</span>
          <div className="flex items-center gap-1.5 mt-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            <span className="font-bold text-black">
              {rsvpCount > 80 ? "High Saturation" : rsvpCount > 30 ? "Moderate" : "Low saturation"}
            </span>
          </div>
        </div>
      </div>

      <p className="font-mono text-[10px] text-gray-500 leading-normal">
        * Predictions are calculated locally by fitting a multi-feature linear regression model
        using TensorFlow.js layers in a sandboxed Web Worker.
      </p>
    </div>
  );
}
export default PredictiveTurnout;
