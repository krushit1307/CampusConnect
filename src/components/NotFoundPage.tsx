import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Gamepad2,
  Compass,
  AlertOctagon,
  Volume2,
  VolumeX,
  Coffee,
  GraduationCap,
  ArrowLeft,
  RotateCcw,
  Play,
  Sparkles,
} from "lucide-react";

// Synthesized Audio engine using Web Audio API to avoid external assets dependency
function playSound(
  type: "click" | "point" | "damage" | "start" | "gameover",
  soundEnabled: boolean,
) {
  if (!soundEnabled) return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "point") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.06); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "damage") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "start") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "gameover") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.warn("Web Audio API is not supported or was blocked:", e);
  }
}

interface FallingItem {
  id: number;
  x: number;
  y: number;
  type: "cap" | "coffee" | "gradeA" | "gradeF";
  speed: number;
}

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"status" | "game" | "navigator">("status");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Game state
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem("campusconnect_404_highscore");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [basketX, setBasketX] = useState<number>(50); // percentage 0-100
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);

  // SVG Interactive state
  const [svgReaction, setSvgReaction] = useState<string>("Click me to debug!");
  const [clicksOnSvg, setClicksOnSvg] = useState<number>(0);

  // Handle Tab Switch
  const switchTab = (tab: "status" | "game" | "navigator") => {
    setActiveTab(tab);
    playSound("click", soundEnabled);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Only process shortcuts if not focused on inputs
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      if (activeTab === "navigator") {
        if (key === "D") {
          playSound("click", soundEnabled);
          navigate("/dashboard");
        } else if (key === "C") {
          playSound("click", soundEnabled);
          navigate("/clubs");
        } else if (key === "E") {
          playSound("click", soundEnabled);
          navigate("/events");
        } else if (key === "F") {
          playSound("click", soundEnabled);
          navigate("/feed");
        } else if (key === "S") {
          playSound("click", soundEnabled);
          navigate("/settings");
        }
      }

      // Control mini-game if active
      if (activeTab === "game" && gameActive) {
        if (e.key === "ArrowLeft" || key === "A") {
          setBasketX((prev) => Math.max(5, prev - 8));
        } else if (e.key === "ArrowRight" || key === "D") {
          setBasketX((prev) => Math.min(95, prev + 8));
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [activeTab, gameActive, soundEnabled, navigate]);

  // Mini-Game Loop
  useEffect(() => {
    if (!gameActive || gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const tick = () => {
      setFallingItems((prevItems) => {
        const nextItems: FallingItem[] = [];

        // Update positions
        for (const item of prevItems) {
          const nextY = item.y + item.speed;

          // Check collision with basket (approx basket y range: 88% to 96%)
          if (nextY >= 86 && nextY <= 94) {
            const distance = Math.abs(item.x - basketX);
            if (distance < 12) {
              // Caught item!
              if (item.type === "gradeF") {
                playSound("damage", soundEnabled);
                setScore((s) => Math.max(0, s - 15));
              } else {
                playSound("point", soundEnabled);
                const points = item.type === "gradeA" ? 30 : item.type === "coffee" ? 20 : 10;
                setScore((s) => {
                  const newScore = s + points;
                  if (newScore > highScore) {
                    setHighScore(newScore);
                    localStorage.setItem("campusconnect_404_highscore", newScore.toString());
                  }
                  return newScore;
                });
              }
              // Skip adding to nextItems since it is caught
              continue;
            }
          }

          // Keep item if it has not reached the bottom
          if (nextY < 100) {
            nextItems.push({ ...item, y: nextY });
          } else {
            // Missed a positive item results in minor score loss
            if (item.type !== "gradeF") {
              setScore((s) => Math.max(0, s - 2));
            }
          }
        }

        // Randomly spawn new items
        if (Math.random() < 0.08 && nextItems.length < 5) {
          const types: Array<FallingItem["type"]> = ["cap", "cap", "coffee", "gradeA", "gradeF"];
          const randomType = types[Math.floor(Math.random() * types.length)];
          nextItems.push({
            id: Date.now() + Math.random(),
            x: Math.floor(Math.random() * 85) + 8, // 8% to 93%
            y: 0,
            type: randomType,
            speed: Math.random() * 2 + 2, // speed 2 to 4
          });
        }

        return nextItems;
      });
    };

    gameLoopRef.current = window.setInterval(tick, 50);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameActive, gameOver, basketX, soundEnabled, highScore]);

  const startGame = () => {
    playSound("start", soundEnabled);
    setScore(0);
    setBasketX(50);
    setFallingItems([]);
    setGameOver(false);
    setGameActive(true);
  };

  const handleSvgClick = () => {
    const reactions = [
      "Ouch! Don't click too hard!",
      "Synth sound synthesized!",
      "I am searchin' for the route too...",
      "Is that a bug or a feature?",
      "Try the Catch the Cap game!",
      "Did you know CampusConnect supports dark mode?",
      "404: Classroom empty. Professor left.",
    ];
    playSound("point", soundEnabled);
    const count = clicksOnSvg + 1;
    setClicksOnSvg(count);
    setSvgReaction(reactions[count % reactions.length]);
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-[#111111] text-[#111111] dark:text-cream flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none selection:bg-brand-yellow-base selection:text-black">
      {/* Outer Console-like Neubrutalist Box */}
      <div className="max-w-2xl w-full bg-white dark:bg-[#171717] border-4 border-[#111111] dark:border-cream shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] dark:shadow-[8px_8px_0px_0px_rgba(243,241,228,1)] overflow-hidden">
        {/* Terminal Window Header Bar */}
        <div className="bg-brand-yellow-base border-b-4 border-[#111111] dark:border-cream p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-red-light border-2 border-black inline-block" />
            <span className="w-3.5 h-3.5 rounded-full bg-brand-orange-base border-2 border-black inline-block" />
            <span className="w-3.5 h-3.5 rounded-full bg-brand-emerald-base border-2 border-black inline-block" />
            <span className="font-mono text-xs font-bold ml-2 uppercase text-black hidden sm:inline">
              CampusConnect_Host // Error_404
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle Button */}
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-1 border-2 border-black bg-white hover:bg-cream active:translate-y-0.5 rounded-none transition-all shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]"
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-black" />
              ) : (
                <VolumeX className="h-4 w-4 text-black" />
              )}
            </button>
            <span className="font-mono text-xs font-black bg-black text-white px-2 py-0.5 uppercase">
              Not Found
            </span>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex border-b-4 border-[#111111] dark:border-cream bg-cream dark:bg-[#1a1a1a]">
          <button
            onClick={() => switchTab("status")}
            className={`flex-1 py-3 px-2 font-mono text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2 border-r-4 border-[#111111] dark:border-cream transition-colors ${
              activeTab === "status"
                ? "bg-white dark:bg-[#171717] text-[#111111] dark:text-cream"
                : "bg-cream dark:bg-[#1a1a1a] text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            <AlertOctagon className="h-4 w-4" />
            Status (404)
          </button>

          <button
            onClick={() => switchTab("game")}
            className={`flex-1 py-3 px-2 font-mono text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2 border-r-4 border-[#111111] dark:border-cream transition-colors ${
              activeTab === "game"
                ? "bg-white dark:bg-[#171717] text-[#111111] dark:text-cream"
                : "bg-cream dark:bg-[#1a1a1a] text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            Catch the Cap
          </button>

          <button
            onClick={() => switchTab("navigator")}
            className={`flex-1 py-3 px-2 font-mono text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2 transition-colors ${
              activeTab === "navigator"
                ? "bg-white dark:bg-[#171717] text-[#111111] dark:text-cream"
                : "bg-cream dark:bg-[#1a1a1a] text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            <Compass className="h-4 w-4" />
            Navigator
          </button>
        </div>

        {/* Console Content Window */}
        <div className="p-6 sm:p-8 min-h-[340px] flex flex-col justify-between bg-white dark:bg-[#171717]">
          {/* TAB 1: STATUS VISUAL */}
          {activeTab === "status" && (
            <div className="text-center flex flex-col items-center">
              <div className="w-full flex justify-center mb-6 relative">
                {/* Visual student character container with interaction */}
                <div
                  onClick={handleSvgClick}
                  className="cursor-pointer group relative bg-brand-yellow-bg border-4 border-[#111111] p-4 shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] dark:shadow-[4px_4px_0px_0px_rgba(243,241,228,0.2)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(17,17,17,1)] transition-all max-w-[280px] w-full"
                >
                  <div className="absolute top-2 right-2 bg-brand-red-light text-black text-[10px] font-mono px-1 border-2 border-black font-bold uppercase animate-pulse">
                    Lost
                  </div>

                  {/* Interactive character SVG */}
                  <svg
                    viewBox="0 0 120 120"
                    className="w-32 h-32 mx-auto group-hover:scale-105 transition-transform"
                    aria-label="Illustration of a lost student looking at a map"
                  >
                    {/* Head */}
                    <rect
                      x="35"
                      y="25"
                      width="50"
                      height="50"
                      fill="#f5c66b"
                      stroke="black"
                      strokeWidth="3"
                    />

                    {/* Hair */}
                    <rect x="30" y="20" width="60" height="12" fill="black" />

                    {/* Eyes (Dazed style) */}
                    <text x="45" y="48" fontSize="14" fontWeight="bold" fontFamily="monospace">
                      x
                    </text>
                    <text x="65" y="48" fontSize="14" fontWeight="bold" fontFamily="monospace">
                      x
                    </text>

                    {/* Mouth (Confused line) */}
                    <path
                      d="M 48 60 Q 60 55 72 60"
                      fill="none"
                      stroke="black"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Graduation Hat floating off-center */}
                    <g className="animate-[bounce_2.8s_infinite]">
                      <polygon
                        points="60,2 10,12 60,22 110,12"
                        fill="black"
                        stroke="black"
                        strokeWidth="2"
                      />
                      <rect
                        x="48"
                        y="16"
                        width="24"
                        height="8"
                        fill="#123a57"
                        stroke="black"
                        strokeWidth="2"
                      />
                    </g>

                    {/* Book/Map in hands */}
                    <rect
                      x="40"
                      y="80"
                      width="40"
                      height="30"
                      fill="white"
                      stroke="black"
                      strokeWidth="3"
                    />
                    <line x1="48" y1="90" x2="72" y2="90" stroke="black" strokeWidth="2" />
                    <line x1="48" y1="100" x2="64" y2="100" stroke="black" strokeWidth="2" />
                  </svg>

                  <div className="mt-2 bg-black dark:bg-cream text-white dark:text-black font-mono text-[11px] py-1 px-2 border-2 border-black font-black uppercase">
                    {svgReaction}
                  </div>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-3 text-black dark:text-white">
                Page Not Found
              </h1>

              <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-6 leading-relaxed">
                The path you followed does not exist. It might have been relocated, or is taking a
                break until finals are done.
              </p>

              <div className="flex gap-4">
                <Link
                  to="/dashboard"
                  onClick={() => playSound("click", soundEnabled)}
                  className="px-5 py-2.5 bg-brand-red-light dark:bg-brand-red-light border-2 border-black font-mono text-xs uppercase font-black tracking-wider text-black shadow-[3px_3px_0px_0px_rgba(17,17,17,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => switchTab("navigator")}
                  className="px-5 py-2.5 bg-white dark:bg-[#222] border-2 border-black dark:border-cream font-mono text-xs uppercase font-black tracking-wider text-black dark:text-cream shadow-[3px_3px_0px_0px_rgba(17,17,17,1)] dark:shadow-[3px_3px_0px_0px_rgba(243,241,228,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  Explore Sitemap
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MINI-GAME */}
          {activeTab === "game" && (
            <div className="flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 bg-cream dark:bg-[#222] p-2 border-2 border-black dark:border-cream font-mono text-xs font-bold text-black dark:text-cream">
                <div className="flex gap-4">
                  <span>
                    SCORE: <b className="text-brand-red-light">{score}</b>
                  </span>
                  <span>
                    HIGH: <b>{highScore}</b>
                  </span>
                </div>
                <span>CONTROLS: A/D OR ARROWS</span>
              </div>

              {/* Game play area */}
              <div
                ref={gameAreaRef}
                className="w-full h-56 bg-brand-yellow-bg-light dark:bg-[#1a1a1a] border-4 border-black relative overflow-hidden"
              >
                {!gameActive ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-center z-10">
                    <Sparkles className="h-8 w-8 text-brand-yellow-base mb-2 animate-bounce" />
                    <h3 className="font-mono text-base font-black text-white uppercase tracking-wider">
                      {gameOver ? "Academic Warning!" : "Catch the Cap!"}
                    </h3>
                    <p className="font-mono text-[11px] text-gray-300 max-w-xs mb-4">
                      Catch graduation items. Avoid the F grades to keep your GPA high!
                    </p>
                    {gameOver && (
                      <p className="font-mono text-xs text-brand-red-lighter font-black mb-3">
                        FINAL SCORE: {score}
                      </p>
                    )}
                    <button
                      onClick={startGame}
                      className="px-6 py-2.5 bg-brand-emerald-base border-2 border-black text-black font-mono text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                    >
                      {gameOver ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {gameOver ? "Try Again" : "Play Now"}
                    </button>
                  </div>
                ) : null}

                {/* Score popups/effects (rendered when game is active) */}
                {gameActive && (
                  <>
                    {/* Control Buttons for touch/clicks */}
                    <div className="absolute bottom-2 left-2 flex gap-1 z-20">
                      <button
                        onClick={() => setBasketX((prev) => Math.max(5, prev - 12))}
                        className="w-8 h-8 bg-white border-2 border-black font-mono font-black text-xs active:bg-cream"
                      >
                        &lt;
                      </button>
                      <button
                        onClick={() => setBasketX((prev) => Math.min(95, prev + 12))}
                        className="w-8 h-8 bg-white border-2 border-black font-mono font-black text-xs active:bg-cream"
                      >
                        &gt;
                      </button>
                    </div>

                    {/* Falling items */}
                    {fallingItems.map((item) => (
                      <div
                        key={item.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                        style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      >
                        {item.type === "cap" && (
                          <div className="bg-black text-white p-1 border border-black rounded-none shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                            <GraduationCap className="h-4.5 w-4.5 text-brand-yellow-base" />
                          </div>
                        )}
                        {item.type === "coffee" && (
                          <div className="bg-brand-peach-light text-black p-1 border border-black rounded-none">
                            <Coffee className="h-4.5 w-4.5" />
                          </div>
                        )}
                        {item.type === "gradeA" && (
                          <div className="bg-brand-emerald-base text-black p-0.5 font-mono text-[10px] font-black border-2 border-black px-1.5 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                            A+
                          </div>
                        )}
                        {item.type === "gradeF" && (
                          <div className="bg-brand-red-light text-black p-0.5 font-mono text-[10px] font-black border-2 border-black px-1.5 animate-pulse">
                            F
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Basket (The graduation student catcher) */}
                    <div
                      className="absolute bottom-1 -translate-x-1/2 w-16 h-7 bg-brand-red-light border-3 border-black flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                      style={{ left: `${basketX}%` }}
                    >
                      <span className="font-mono text-[9px] font-black uppercase text-black">
                        GRADUATE
                      </span>
                    </div>
                  </>
                )}
              </div>

              {gameActive && (
                <button
                  onClick={() => {
                    setGameActive(false);
                    setGameOver(true);
                    playSound("gameover", soundEnabled);
                  }}
                  className="mt-4 px-4 py-1.5 bg-white border-2 border-black font-mono text-xs font-black uppercase hover:bg-cream transition-colors text-black"
                >
                  Quit Game
                </button>
              )}
            </div>
          )}

          {/* TAB 3: NAVIGATOR */}
          {activeTab === "navigator" && (
            <div className="flex flex-col">
              <h2 className="font-mono text-xs font-black uppercase tracking-wider mb-3 text-gray-500 dark:text-gray-400">
                Quick Portal Jump (Use Keyboard Keys)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  {
                    label: "Dashboard Overview",
                    path: "/dashboard",
                    key: "D",
                    color: "bg-brand-blue-light",
                  },
                  {
                    label: "Clubs Directory",
                    path: "/clubs",
                    key: "C",
                    color: "bg-brand-yellow-base",
                  },
                  {
                    label: "Events & Maps",
                    path: "/events/map",
                    key: "E",
                    color: "bg-brand-peach-light",
                  },
                  { label: "Student Feed", path: "/feed", key: "F", color: "bg-brand-green-bg" },
                  {
                    label: "Account Settings",
                    path: "/settings",
                    key: "S",
                    color: "bg-brand-red-lighter",
                  },
                ].map((item) => (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={() => playSound("click", soundEnabled)}
                    className="flex items-center justify-between p-3 border-2 border-black hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(17,17,17,1)] active:translate-y-0 transition-all bg-white dark:bg-[#1a1a1a]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 border border-black ${item.color}`} />
                      <span className="font-mono text-xs font-black uppercase text-black dark:text-white">
                        {item.label}
                      </span>
                    </div>
                    <kbd className="bg-black text-white font-mono text-[10px] font-bold px-1.5 border border-black rounded-none uppercase">
                      [{item.key}]
                    </kbd>
                  </Link>
                ))}
              </div>

              <div className="flex justify-center">
                <Link
                  to="/"
                  onClick={() => playSound("click", soundEnabled)}
                  className="flex items-center gap-2 font-mono text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white uppercase"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                  Back to main landing page
                </Link>
              </div>
            </div>
          )}

          {/* Footer Info inside Console */}
          <div className="mt-6 pt-4 border-t-2 border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>HTTP STATUS // CODE_404</span>
            <span>CAMPUSCONNECT INC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
