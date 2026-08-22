// =============================================================================
// Route: /overlay/poll/:poll_id
// Issue: #3337 - Live Audience Poll Overlay for Virtual Streams
// Description: A bare, transparent-background page meant to be pasted into
// OBS/vMix as a "Browser Source" so live poll results can be composited
// directly on top of a video feed.
// =============================================================================

import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import { usePollOverlayResults } from "@/hooks/usePollOverlayResults";

const BAR_COLORS = ["#22d3ee", "#a3e635", "#fbbf24", "#f472b6", "#818cf8", "#fb7185"];

export default function PollOverlayRoute() {
  const { poll_id } = useParams<{ poll_id: string }>();
  const { poll, results, totalVotes, isLoading, notFound } = usePollOverlayResults(poll_id);

  // Force a transparent page background so OBS/vMix can key the overlay
  // straight onto the video feed instead of the app's usual page background.
  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";

    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
    };
  }, []);

  // Stay fully blank on a transparent background instead of showing loading
  // or error UI — this route is composited directly into a live video feed.
  if (isLoading || notFound || !poll) {
    return <div style={{ background: "transparent", width: "100vw", height: "100vh" }} />;
  }

  const chartData = results.map((r) => ({
    name: r.text,
    votes: r.votes,
    percentage: totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0,
  }));

  return (
    <div
      style={{
        background: "transparent",
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "flex-end",
        padding: "48px",
        boxSizing: "border-box",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          background: "rgba(10, 10, 10, 0.62)",
          borderRadius: "20px",
          padding: "32px 40px",
          width: "100%",
          backdropFilter: "blur(4px)",
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            fontSize: "40px",
            fontWeight: 800,
            marginBottom: "20px",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {poll.question}
        </h1>

        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 100)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
            barCategoryGap={20}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={260}
              tick={{ fontSize: 26, fontWeight: 700, fill: "#ffffff" }}
              tickLine={false}
              axisLine={false}
            />
            <Bar
              dataKey="votes"
              radius={[0, 10, 10, 0]}
              barSize={52}
              isAnimationActive
              animationDuration={400}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
              <LabelList
                dataKey="percentage"
                position="right"
                formatter={(value: number) => `${value}%`}
                style={{ fontSize: 28, fontWeight: 800, fill: "#ffffff" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p style={{ color: "#ffffff", fontSize: "18px", fontWeight: 700, marginTop: "12px" }}>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}