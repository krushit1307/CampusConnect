import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Network,
  ServerCrash,
  Activity,
  Globe,
  Ban,
  ShieldCheck,
  Radar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ReviewLog {
  id: number;
  ip: string;
  asn: number;
  org: string;
  isDatacenter: boolean;
  status: "PUBLISHED" | "QUARANTINED";
}

export const BotnetReviewRadar: React.FC = () => {
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [datacenterRatio, setDatacenterRatio] = useState(0);

  const datacenterAsns = [
    { asn: 14618, org: "Amazon.com" },
    { asn: 14061, org: "DigitalOcean, LLC" },
    { asn: 24940, org: "Hetzner Online GmbH" },
    { asn: 9009, org: "M247 Europe VPN" },
  ];

  const residentialAsns = [
    { asn: 7922, org: "Comcast Cable" },
    { asn: 7018, org: "AT&T Services" },
    { asn: 11111, org: "Campus ResNet" },
  ];

  const generateMockIp = () =>
    `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setLogs((prev) => {
          // Simulate 95% Datacenter traffic during an attack
          const isDc = Math.random() < 0.95;
          const source = isDc
            ? datacenterAsns[Math.floor(Math.random() * datacenterAsns.length)]
            : residentialAsns[Math.floor(Math.random() * residentialAsns.length)];

          const newLog: ReviewLog = {
            id: Date.now(),
            ip: generateMockIp(),
            asn: source.asn,
            org: source.org,
            isDatacenter: isDc,
            status: "PUBLISHED",
          };

          const updatedLogs = [newLog, ...prev].slice(0, 100);

          // Calculate Ratio
          const dcCount = updatedLogs.filter((l) => l.isDatacenter).length;
          const ratio = dcCount / updatedLogs.length;
          setDatacenterRatio(ratio);

          // Trigger Quarantine Protocol
          if (updatedLogs.length > 20 && ratio > 0.8) {
            setIsUnderAttack(true);
            // Retroactively quarantine
            return updatedLogs.map((l) => (l.isDatacenter ? { ...l, status: "QUARANTINED" } : l));
          }

          return updatedLogs;
        });
      }, 300); // High velocity influx
    } else {
      setIsUnderAttack(false);
      setDatacenterRatio(0);
      setLogs([]);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <Network className="h-10 w-10 text-cyan-500" />
            Botnet Review Bombing Defense
          </h1>
          <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
            Graph analysis fails when malicious actors use highly distributed, fragmented IP arrays.
            This system intercepts inbound review traffic and resolves the physical Autonomous
            System Number (ASN). If volumetric analysis detects that {">"}80% of recent traffic
            originates from commercial Datacenters (AWS, DigitalOcean, Hetzner), it mathematically
            proves synthetic sybil abuse and triggers autonomous quarantining.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Analytics */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden h-full">
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-cyan-400" />
                Traffic Velocity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Datacenter Origin %
                </p>
                <p
                  className={`text-5xl font-black ${isUnderAttack ? "text-red-500" : "text-cyan-400"}`}
                >
                  {(datacenterRatio * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Total Ingress Size
                </p>
                <p className="text-3xl font-black text-white">
                  {logs.length} <span className="text-sm font-normal text-slate-500">reqs</span>
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-5 mt-auto">
              <Button
                onClick={() => setIsSimulating(!isSimulating)}
                variant={isSimulating ? "destructive" : "default"}
                className={`w-full font-black h-12 uppercase tracking-widest transition-all ${!isSimulating ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}`}
              >
                {isSimulating ? "Halt Attack" : "Simulate Botnet Attack"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Ingress Logs & WAF State */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          <Card
            className={`bg-slate-900 border-slate-800 shadow-2xl flex-1 transition-all duration-700 ${isUnderAttack ? "border-red-900/50 shadow-[0_0_50px_rgba(239,68,68,0.15)]" : ""}`}
          >
            <CardHeader
              className={`${isUnderAttack ? "bg-red-950/40" : "bg-slate-950/40"} border-b border-slate-800 pb-5 transition-colors duration-500 flex flex-row items-center justify-between`}
            >
              <CardTitle
                className={`flex items-center gap-3 text-xl ${isUnderAttack ? "text-red-500" : "text-white"}`}
              >
                {isUnderAttack ? (
                  <ShieldAlert className="h-6 w-6 animate-pulse" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                )}
                {isUnderAttack ? "ACTIVE BOTNET REVIEW BOMBING DETECTED" : "Event Reputation Safe"}
              </CardTitle>
              {isUnderAttack && (
                <div className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded animate-pulse">
                  WAF SHADOWBAN ENGAGED
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">
                        <Radar className="h-4 w-4" />
                      </th>
                      <th className="px-4 py-3">Source IP</th>
                      <th className="px-4 py-3">ASN Network</th>
                      <th className="px-4 py-3">Infrastructure Type</th>
                      <th className="px-4 py-3 text-right">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`transition-colors ${log.status === "QUARANTINED" ? "bg-red-950/10" : "hover:bg-slate-800/30"}`}
                      >
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(log.id).toISOString().substring(11, 23)}
                        </td>
                        <td
                          className={`px-4 py-3 ${log.isDatacenter ? "text-rose-400" : "text-emerald-400"}`}
                        >
                          {log.ip}
                        </td>
                        <td className="px-4 py-3 text-white">
                          AS{log.asn} ({log.org})
                        </td>
                        <td className="px-4 py-3">
                          {log.isDatacenter ? (
                            <span className="flex items-center gap-2 text-rose-300">
                              <ServerCrash className="h-3 w-3" /> DATACENTER
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-emerald-300">
                              <Globe className="h-3 w-3" /> RESIDENTIAL
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.status === "QUARANTINED" ? (
                            <span className="inline-flex items-center gap-1 text-red-500 font-bold bg-red-950 px-2 py-1 rounded border border-red-900">
                              <Ban className="h-3 w-3" /> QUARANTINED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                              <ShieldCheck className="h-3 w-3" /> PUBLISHED
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-600 font-sans">
                          Awaiting live review ingress telemetry...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BotnetReviewRadar;
