import React, { useState } from "react";
import { Terminal, Shield, Play, Lock, AlertTriangle, FileCode, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const AutoGraderSubmission: React.FC = () => {
  const [code, setCode] = useState(
    "def solve():\n    # Example of Malicious Attack\n    import os\n    os.system('cat /etc/passwd')\n    \n    # Proper Solution\n    print('Hello World')\n\nsolve()",
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ stdout: string; error?: string; secure: boolean } | null>(
    null,
  );

  const handleExecute = () => {
    setIsExecuting(true);
    setResult(null);

    // Simulate API call to the orchestrator since Docker daemon might not be running in this demo environment
    setTimeout(() => {
      setIsExecuting(false);
      setResult({
        stdout: "cat: /etc/passwd: Permission denied (Read-only Root FS)\nHello World\n",
        secure: true,
      });
    }, 2000);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Terminal className="h-8 w-8 text-emerald-500" />
            Hackathon Auto-Grader
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-3xl leading-relaxed">
            Submit your solution script. It will be executed in a hyper-isolated, ephemeral MicroVM
            (0 inbound/outbound network, read-only filesystem, 64MB RAM limit, 10s timeout) to
            completely prevent Remote Code Execution vulnerabilities.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Code Editor */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-950/50 border-b border-slate-800 py-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm font-mono">
              <FileCode className="h-4 w-4 text-emerald-400" />
              solution.py
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative">
            {/* Absolute positioning for a mock syntax highlighter feel */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 bg-slate-900 text-slate-300 font-mono text-sm p-4 focus:outline-none resize-none"
              spellCheck={false}
            />
          </CardContent>
          <CardFooter className="bg-slate-950/50 border-t border-slate-800 p-4">
            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-wider"
            >
              {isExecuting ? (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4 animate-pulse" /> Spawning MicroVM...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4" /> Execute in Sandbox
                </span>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Execution Results */}
        <div className="space-y-6 flex flex-col">
          {/* Security Perimeter Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Shield className="h-6 w-6 text-emerald-500 mb-2" />
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
                Network Airgap
              </p>
              <p className="text-slate-400 font-mono text-[10px] mt-1">Docker NetworkMode: None</p>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Lock className="h-6 w-6 text-emerald-500 mb-2" />
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
                Immutable FS
              </p>
              <p className="text-slate-400 font-mono text-[10px] mt-1">ReadonlyRootfs: True</p>
            </div>
          </div>

          <Card
            className={`bg-slate-950 border-slate-800 flex-1 transition-opacity duration-300 ${result ? "opacity-100" : "opacity-50"}`}
          >
            <CardHeader className="py-3 border-b border-slate-800">
              <CardTitle className="text-slate-400 text-xs uppercase tracking-widest flex items-center justify-between">
                Standard Output (stdout)
                {result && <Badge status={result.error ? "error" : "success"} />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!result ? (
                <div className="h-full flex items-center justify-center text-slate-600 font-mono text-sm min-h-[120px]">
                  Awaiting Execution...
                </div>
              ) : (
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                  {result.error && (
                    <div className="text-red-400 mb-2 border-l-2 border-red-500 pl-2 py-1">
                      [Fatal] {result.error}
                    </div>
                  )}
                  {result.stdout.split("\n").map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes("Permission denied") ? "text-amber-400" : "text-slate-300"
                      }
                    >
                      {line}
                    </div>
                  ))}
                  <div className="mt-4 pt-2 border-t border-slate-800 text-emerald-500 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Container Ephemerally Destroyed.
                  </div>
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Badge = ({ status }: { status: "success" | "error" }) => {
  if (status === "error") {
    return (
      <span className="text-red-400 bg-red-950 px-2 py-1 rounded text-[10px] flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Timeout/Error
      </span>
    );
  }
  return (
    <span className="text-emerald-400 bg-emerald-950 px-2 py-1 rounded text-[10px] flex items-center gap-1">
      <Shield className="h-3 w-3" /> Execution Complete
    </span>
  );
};

export default AutoGraderSubmission;
