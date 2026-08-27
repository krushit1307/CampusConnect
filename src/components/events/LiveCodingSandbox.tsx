import React, { useEffect, useState } from "react";
import { Play, Copy, RefreshCw, Terminal, Code2, Users, Check, ExternalLink } from "lucide-react";
import {
  liveCodingService,
  executeCodeSandbox,
  MasterSandbox,
  SupportedLanguage,
  CodeExecutionResult,
} from "@/services/liveCodingService";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

interface LiveCodingSandboxProps {
  eventId: string;
  isSpeaker?: boolean;
  initialCode?: string;
}

export const LiveCodingSandbox: React.FC<LiveCodingSandboxProps> = ({
  eventId,
  isSpeaker = false,
  initialCode = `// Workshop Live Sandbox\n// Follow the speaker or experiment on your side!\n\nfunction calculateMetrics(participants) {\n  return participants * 1.5;\n}\n\nconst result = calculateMetrics(42);\nconsole.log("Total Impact Score:", result);`,
}) => {
  const [sandbox, setSandbox] = useState<MasterSandbox | null>(null);
  const [speakerCode, setSpeakerCode] = useState(initialCode);
  const [attendeeCode, setAttendeeCode] = useState(initialCode);
  const [language, setLanguage] = useState<SupportedLanguage>("javascript");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initSandbox = async () => {
      const sb = await liveCodingService.getOrCreateSandbox(eventId, initialCode);
      if (sb) {
        setSandbox(sb);
        setSpeakerCode(sb.master_code || initialCode);
        if (!isSpeaker) {
          setAttendeeCode(sb.master_code || initialCode);
        }
      }
    };

    initSandbox();

    // Subscribe to realtime updates on the master sandbox
    const channel = supabase
      .channel(`live-sandbox-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "event_code_sandboxes",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as MasterSandbox;
          if (updated && updated.master_code !== undefined) {
            setSpeakerCode(updated.master_code);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, initialCode, isSpeaker]);

  const handleSpeakerCodeChange = async (newCode: string) => {
    setSpeakerCode(newCode);
    if (sandbox && isSpeaker) {
      await liveCodingService.updateMasterCode(sandbox.id, newCode);
    }
  };

  const handleRunCode = async () => {
    try {
      setRunning(true);
      const targetCode = isSpeaker ? speakerCode : attendeeCode;
      const result: CodeExecutionResult = await executeCodeSandbox(targetCode, language);

      setOutput(result.output);

      if (sandbox) {
        await liveCodingService.logExecution({
          sandboxId: sandbox.id,
          code: targetCode,
          language,
          result,
        });
      }

      if (result.status === "success") {
        toast.success(`Executed in ${result.executionTimeMs}ms`);
      } else if (result.status === "error") {
        toast.error("Runtime error encountered");
      } else {
        toast.warning("Execution timed out");
      }
    } catch (err) {
      console.error(err);
      toast.error("Execution failed");
    } finally {
      setRunning(false);
    }
  };

  const handleCopySpeakerCode = () => {
    setAttendeeCode(speakerCode);
    setCopied(true);
    toast.success("Synced speaker's latest code into your editor!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card text-card-foreground border rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Interactive Live Coding Sandbox</h2>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Zero-install browser IDE for workshops & hackathons.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            className="text-xs bg-background border rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="javascript">JavaScript (Node v20)</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python 3.11</option>
          </select>

          <button
            onClick={handleRunCode}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {running ? "Running..." : "Run Code"}
          </button>
        </div>
      </div>

      {/* Editor Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x border-b">
        {/* Left Side: Speaker's Master Sandbox */}
        <div className="flex flex-col bg-muted/10 min-h-[340px]">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 text-xs">
            <span className="font-semibold flex items-center gap-1.5 text-foreground">
              <Users className="w-3.5 h-3.5 text-primary" />
              Speaker's Master Sandbox {isSpeaker ? "(Host Edit Mode)" : "(Live Stream)"}
            </span>
            {!isSpeaker && (
              <button
                onClick={handleCopySpeakerCode}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "Synced" : "Copy to My Editor"}
              </button>
            )}
          </div>
          <textarea
            value={speakerCode}
            onChange={(e) => isSpeaker && handleSpeakerCodeChange(e.target.value)}
            readOnly={!isSpeaker}
            rows={14}
            className={`w-full p-4 text-xs font-mono bg-transparent border-0 focus:outline-none resize-none leading-relaxed ${
              !isSpeaker ? "cursor-default text-muted-foreground" : "text-foreground"
            }`}
            placeholder="// Speaker code will stream here in real-time..."
          />
        </div>

        {/* Right Side: Attendee's Isolated Workspace */}
        <div className="flex flex-col bg-background min-h-[340px]">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 text-xs">
            <span className="font-semibold flex items-center gap-1.5 text-foreground">
              <Code2 className="w-3.5 h-3.5 text-emerald-500" />
              Your Isolated Sandbox
            </span>
            <span className="text-[11px] text-muted-foreground">Experiment safely</span>
          </div>
          <textarea
            value={attendeeCode}
            onChange={(e) => setAttendeeCode(e.target.value)}
            rows={14}
            className="w-full p-4 text-xs font-mono bg-transparent border-0 focus:outline-none resize-none leading-relaxed text-foreground"
            placeholder="// Write, modify, and test your code here..."
          />
        </div>
      </div>

      {/* Terminal Output Console */}
      <div className="bg-zinc-950 text-zinc-100 p-4 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Runtime Console Output
            </span>
          </div>
          {output && (
            <button
              onClick={() => setOutput(null)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap max-h-36 min-h-12 leading-relaxed text-emerald-400/90">
          {output || '// Press "Run Code" above to execute and view stdout logs.'}
        </pre>
      </div>
    </div>
  );
};
