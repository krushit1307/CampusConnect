import { useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { getSupabaseUrl } from "@/lib/supabase/client";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import Code2 from "lucide-react/dist/esm/icons/code-2";
import Copy from "lucide-react/dist/esm/icons/copy";
import Check from "lucide-react/dist/esm/icons/check";
import { toast } from "sonner";

export default function ApiPlayground() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const baseApiUrl = `${getSupabaseUrl()}/functions/v1/public-api`;
  const endpointUrl = `${baseApiUrl}/v1/public/events/upcoming`;
  const docsUrl = `${baseApiUrl}/docs`;

  const curlCommand = `curl -X GET "${endpointUrl}"`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopiedUrl(true);
      toast.success("Endpoint URL copied to clipboard!");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("Failed to copy URL.");
    }
  };

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopiedCurl(true);
      toast.success("cURL command copied to clipboard!");
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      toast.error("Failed to copy cURL.");
    }
  };

  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Header Block */}
        <header className="border-4 border-black bg-lime p-6 shadow-[8px_8px_0_0_#000] mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-block border-2 border-black bg-black text-cream px-2 py-0.5 font-mono text-xs font-bold uppercase mb-2">
                Developer Portal
              </div>
              <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black sm:text-4xl">
                API Playground
              </h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-black/60">
                Safely query public campus events data legally
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse border border-black" />
              <span className="font-mono text-xs font-bold uppercase text-black">
                Rate Limit: 60 req/min
              </span>
            </div>
          </div>
        </header>

        {/* Quickstart & Docs Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Quickstart Side Panel */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="border-4 border-black bg-white p-6 shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 border-b-2 border-black pb-2 mb-4">
                <Terminal className="h-5 w-5 text-black" />
                <h2 className="font-display text-lg font-black uppercase text-black">
                  Quick Start
                </h2>
              </div>
              <p className="font-mono text-xs text-zinc-600 mb-4 leading-relaxed">
                Build iOS/Android widgets, Discord bots, or terminal clients legally without scraping HTML.
              </p>

              {/* Endpoint Link */}
              <div className="space-y-2 mb-4">
                <label className="font-mono text-[10px] font-bold uppercase text-zinc-500">
                  REST Endpoint
                </label>
                <div className="flex border-2 border-black shadow-[2px_2px_0_0_#000] overflow-hidden">
                  <input
                    type="text"
                    readOnly
                    value={endpointUrl}
                    className="flex-1 min-w-0 bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] text-zinc-700 outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="border-l-2 border-black bg-yellow-350 p-2 hover:bg-yellow-400 cursor-pointer active:translate-y-[1px]"
                    aria-label="Copy endpoint URL"
                  >
                    {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* cURL command */}
              <div className="space-y-2">
                <label className="font-mono text-[10px] font-bold uppercase text-zinc-500">
                  cURL Test Command
                </label>
                <div className="flex border-2 border-black shadow-[2px_2px_0_0_#000] overflow-hidden">
                  <input
                    type="text"
                    readOnly
                    value={curlCommand}
                    className="flex-1 min-w-0 bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] text-zinc-700 outline-none"
                  />
                  <button
                    onClick={handleCopyCurl}
                    className="border-l-2 border-black bg-yellow-350 p-2 hover:bg-yellow-400 cursor-pointer active:translate-y-[1px]"
                    aria-label="Copy cURL command"
                  >
                    {copiedCurl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Promise panel */}
            <div className="border-4 border-black bg-yellow-50 p-6 shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 border-b-2 border-black pb-2 mb-4">
                <Code2 className="h-5 w-5 text-black" />
                <h2 className="font-display text-lg font-black uppercase text-black">
                  Privacy Guard
                </h2>
              </div>
              <ul className="space-y-2.5 font-mono text-xs text-zinc-700 list-disc list-inside">
                <li>Strictly read-only REST client scope.</li>
                <li>Zero exposure of user PII or phone numbers.</li>
                <li>Only returns scheduled events of public clubs.</li>
                <li>Rate-limiting applied strictly per client IP.</li>
              </ul>
            </div>
          </aside>

          {/* Interactive Swagger UI Documentation (iframe) */}
          <section className="lg:col-span-2 flex flex-col border-4 border-black bg-white shadow-[8px_8px_0_0_#000] overflow-hidden min-h-[600px]">
            <div className="border-b-4 border-black bg-zinc-550 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black flex items-center justify-between">
              <span>Interactive OpenAPI Specification</span>
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-zinc-700"
              >
                Open in new tab
              </a>
            </div>
            <iframe
              src={docsUrl}
              title="Campus Connect OpenAPI Docs Playground"
              className="flex-1 w-full border-none min-h-[550px]"
            />
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
