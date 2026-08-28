import React, { useState } from "react";
import { Handshake, Clock, Flame, Users, CalendarDays, Loader2, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

export const SyndicateBiddingDashboard: React.FC = () => {
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Mock State for UI
  const item = {
    name: "Sony 4K Auditorium Projector",
    date: "Oct 15, 2026",
    highest_solo_bid: 5000, // CS Club
    highest_solo_club: "CS Club",
  };

  const currentSyndicate = {
    name: "Arts & Letters Coalition",
    total_points: 2500, // Poetry (1500) + Art (1000)
    members: [
      { name: "Poetry Club", points: 1500, time: "18:00 - 20:00" },
      { name: "Art Club", points: 1000, time: "20:00 - 22:00" },
    ],
  };

  const handleJoinSyndicate = () => {
    setIsJoining(true);
    setTimeout(() => {
      setIsJoining(false);
      setJoined(true);
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Handshake className="h-8 w-8 text-indigo-500" />
            Syndicate Bidding Pool
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl">
            Combine points with other clubs to outbid massive solo organizations. If you win, the
            system strictly enforces your Fractional Temporal Booking logic on the calendar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Auction Status */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="bg-slate-950/50 border-b border-slate-800 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Live Auction: {item.name}
            </CardTitle>
            <CardDescription className="text-slate-400 font-mono">
              <CalendarDays className="inline-block h-4 w-4 mr-1 mb-1" />
              Reservation Date: {item.date}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold uppercase tracking-wider">
                <span className="text-slate-500">Highest Solo Bid ({item.highest_solo_club})</span>
                <span className="text-white">{item.highest_solo_bid} PTS</span>
              </div>
              <Progress value={100} className="h-2 bg-slate-800 [&>div]:bg-orange-500" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold uppercase tracking-wider">
                <span className="text-indigo-400">Syndicate Pool ({currentSyndicate.name})</span>
                <span className="text-indigo-400">
                  {joined ? currentSyndicate.total_points + 2600 : currentSyndicate.total_points}{" "}
                  PTS
                </span>
              </div>
              <Progress
                value={
                  ((joined ? currentSyndicate.total_points + 2600 : currentSyndicate.total_points) /
                    item.highest_solo_bid) *
                  100
                }
                className="h-2 bg-slate-800 [&>div]:bg-indigo-500"
              />
            </div>

            {joined && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-md text-sm font-bold text-center animate-in fade-in zoom-in">
                Syndicate has overtaken the highest solo bid! (5,100 &gt; 5,000)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Join Syndicate Form */}
        <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <CardHeader className="border-b border-slate-800/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              Join Fractional Pool
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {!joined ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">
                      Your Bid (Points)
                    </label>
                    <Input
                      type="number"
                      defaultValue={2600}
                      className="bg-slate-950 border-slate-800 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Time Split</label>
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue="22:00"
                        className="bg-slate-950 border-slate-800 text-white font-mono"
                      />
                      <ArrowRight className="h-4 w-4 text-slate-600" />
                      <Input
                        defaultValue="23:59"
                        className="bg-slate-950 border-slate-800 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-950/30 p-3 rounded-lg border border-indigo-900/50 flex gap-3 text-sm">
                  <Clock className="h-5 w-5 text-indigo-400 shrink-0" />
                  <p className="text-indigo-200/80 font-mono leading-relaxed text-xs">
                    If this syndicate wins, the system will instantly generate 3 contiguous
                    reservations on the item's calendar. You only get access during your exact
                    fractional block.
                  </p>
                </div>

                <Button
                  onClick={handleJoinSyndicate}
                  disabled={isJoining}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold tracking-wider uppercase h-12"
                >
                  {isJoining ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Contribute & Join Syndicate"
                  )}
                </Button>
              </>
            ) : (
              <div className="h-full flex flex-col justify-center items-center py-6 text-center">
                <Handshake className="h-16 w-16 text-emerald-500 mb-4" />
                <h3 className="text-xl font-black text-white tracking-tight mb-2">
                  Syndicate Joined
                </h3>
                <p className="text-slate-400 font-mono text-sm max-w-xs">
                  Your 2,600 points have been securely escrowed. You are locked in for the 22:00 -
                  23:59 time block.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Syndicate Members Manifest */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-white text-sm uppercase tracking-wider font-bold">
                Fractional Ownership Manifest
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-left text-sm font-mono text-slate-300">
                <thead className="bg-slate-950 text-xs text-slate-500 uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Club</th>
                    <th className="px-6 py-4">Contributed</th>
                    <th className="px-6 py-4">Fractional Split (Block)</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {currentSyndicate.members.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-bold text-white">{m.name}</td>
                      <td className="px-6 py-4 text-indigo-400">{m.points} PTS</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" /> {m.time}
                      </td>
                      <td className="px-6 py-4 text-emerald-500">Locked</td>
                    </tr>
                  ))}
                  {joined && (
                    <tr className="hover:bg-slate-800/30 bg-indigo-500/5">
                      <td className="px-6 py-4 font-bold text-white">Music Club (You)</td>
                      <td className="px-6 py-4 text-indigo-400">2600 PTS</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" /> 22:00 - 23:59
                      </td>
                      <td className="px-6 py-4 text-emerald-500">Locked</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SyndicateBiddingDashboard;
