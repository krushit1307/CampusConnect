// =============================================================================
// File: src/components/events/LivePollingCategoryClusterView.tsx
// Task: Real-Time Live Polling — NLP Free-Text Response Categorization Engine
// Description: Presenter and audience view displaying real-time categorized topic
//              clusters with percentage progress bars, sentiment pills, keyword chips,
//              sample quotes drawer, and theme upvoting.
// =============================================================================

import { useState } from "react";
import {
  PieChart,
  List,
  Sparkles,
  Search,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import {
  type LivePollAnalysisResult,
  type CategorizedPollCluster,
} from "@/services/livePollingCategorizerService";

export interface LivePollingCategoryClusterViewProps {
  pollAnalysis: LivePollAnalysisResult;
  onUpvoteCluster?: (clusterId: string) => void;
  onRefresh?: () => void;
}

export function LivePollingCategoryClusterView({
  pollAnalysis,
  onUpvoteCluster,
  onRefresh,
}: LivePollingCategoryClusterViewProps) {
  const [viewMode, setViewMode] = useState<"clusters" | "raw">("clusters");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  const { questionTitle, totalResponses, clusters } = pollAnalysis;

  const filteredClusters = clusters.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.toLowerCase().includes(q)) ||
      c.sampleQuotes.some((sq) => sq.toLowerCase().includes(q))
    );
  });

  const getSentimentBadge = (tone: "POSITIVE" | "NEUTRAL" | "CRITICAL") => {
    switch (tone) {
      case "POSITIVE":
        return (
          <span className="inline-flex items-center gap-1 border border-black bg-emerald-100 text-emerald-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
            <CheckCircle className="h-3 w-3 text-emerald-700" /> Positive
          </span>
        );
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 border border-black bg-rose-100 text-rose-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
            <AlertCircle className="h-3 w-3 text-rose-700" /> Critical
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 border border-black bg-gray-100 text-gray-800 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
            Neutral
          </span>
        );
    }
  };

  const toggleExpand = (clusterId: string) => {
    setExpandedClusterId(expandedClusterId === clusterId ? null : clusterId);
  };

  return (
    <div
      className="neu-border border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000] space-y-5"
      data-testid="live-polling-cluster-view"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-black pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            <h2 className="font-display text-xl font-black uppercase text-black tracking-tight">
              Real-Time Response Clusters
            </h2>
          </div>
          <p className="font-mono text-xs text-gray-600 font-bold mt-0.5">
            {questionTitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="border-2 border-black bg-amber-400 text-black font-mono text-xs font-black uppercase px-3 py-1 shadow-[2px_2px_0_0_#000]"
            data-testid="live-poll-total-counter"
          >
            {totalResponses} Answers Categorized
          </span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="border-2 border-black bg-gray-100 hover:bg-gray-200 p-1.5 cursor-pointer shadow-[2px_2px_0_0_#000]"
              title="Refresh Clusters"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar: Search & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-2 border-black bg-gray-50 pl-8 pr-3 py-1.5 font-mono text-xs outline-none focus:bg-white shadow-[2px_2px_0_0_#000]"
            data-testid="cluster-search-input"
          />
        </div>

        <div className="flex items-center border-2 border-black bg-gray-100 p-0.5 shadow-[2px_2px_0_0_#000]">
          <button
            type="button"
            onClick={() => setViewMode("clusters")}
            className={`flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
              viewMode === "clusters"
                ? "bg-black text-white"
                : "text-gray-700 hover:text-black"
            }`}
            data-testid="view-mode-clusters"
          >
            <PieChart className="h-3.5 w-3.5" /> Categorized Clusters ({clusters.length})
          </button>

          <button
            type="button"
            onClick={() => setViewMode("raw")}
            className={`flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
              viewMode === "raw"
                ? "bg-black text-white"
                : "text-gray-700 hover:text-black"
            }`}
            data-testid="view-mode-raw"
          >
            <List className="h-3.5 w-3.5" /> Raw Response Feed
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "clusters" ? (
        <div className="space-y-3.5" data-testid="clusters-list-container">
          {filteredClusters.length === 0 ? (
            <p className="font-mono text-xs text-gray-500 italic py-8 text-center border-2 border-dashed border-gray-300">
              No matching topic clusters found.
            </p>
          ) : (
            filteredClusters.map((cluster) => {
              const isExpanded = expandedClusterId === cluster.id;

              return (
                <div
                  key={cluster.id}
                  className="border-3 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] space-y-3 transition-all hover:translate-y-[-1px]"
                  data-testid={`cluster-card-${cluster.id}`}
                >
                  {/* Cluster Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-base font-black uppercase text-black">
                          {cluster.title}
                        </h3>
                        {getSentimentBadge(cluster.sentimentTone)}
                      </div>

                      {/* Keywords Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cluster.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="bg-indigo-50 border border-indigo-300 text-indigo-900 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-gray-900 bg-gray-100 border border-black px-2 py-1">
                        {cluster.responseCount} answers ({cluster.percentage}%)
                      </span>

                      {onUpvoteCluster && (
                        <button
                          type="button"
                          onClick={() => onUpvoteCluster(cluster.id)}
                          className="flex items-center gap-1 border-2 border-black bg-amber-300 hover:bg-amber-400 text-black font-mono text-xs font-bold px-2.5 py-1 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px]"
                          data-testid={`upvote-btn-${cluster.id}`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          <span>{cluster.upvoteCount}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Volume Percentage Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-3.5 w-full border-2 border-black bg-gray-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, cluster.percentage)}%` }}
                        className="h-full bg-indigo-500 transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Collapsible Sample Quotes Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(cluster.id)}
                      className="flex items-center gap-1 font-mono text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                      data-testid={`toggle-quotes-${cluster.id}`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {isExpanded ? "Hide Sample Quotes" : `View Sample Quotes (${cluster.sampleQuotes.length})`}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 border-2 border-black bg-amber-50/70 p-3 space-y-2 font-mono text-xs shadow-[2px_2px_0_0_#000]">
                        <span className="font-bold text-amber-950 uppercase text-[10px] block">
                          Representative Attendee Quotes:
                        </span>
                        <ul className="space-y-1.5 text-amber-900">
                          {cluster.sampleQuotes.map((quote, qIdx) => (
                            <li key={qIdx} className="border-l-2 border-amber-600 pl-2 font-medium italic">
                              "{quote}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Raw Response Feed View */
        <div className="border-2 border-black bg-gray-50 p-4 space-y-2 shadow-[4px_4px_0_0_#000]" data-testid="raw-feed-container">
          <h3 className="font-mono text-xs font-black uppercase text-black mb-2">
            All Raw Submissions ({totalResponses})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {clusters
              .flatMap((c) => c.responses)
              .map((res) => (
                <div
                  key={res.id}
                  className="border border-black bg-white p-2.5 font-mono text-xs flex justify-between items-center"
                >
                  <span className="text-gray-900 font-medium">"{res.text}"</span>
                  {res.createdAt && (
                    <span className="text-[10px] text-gray-500 ml-2">
                      {new Date(res.createdAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
