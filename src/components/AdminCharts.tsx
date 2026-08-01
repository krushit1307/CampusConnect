import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartData = [
  { month: "January", reports: 45, resolved: 35 },
  { month: "February", reports: 80, resolved: 65 },
  { month: "March", reports: 65, resolved: 50 },
  { month: "April", reports: 120, resolved: 110 },
  { month: "May", reports: 95, resolved: 80 },
  { month: "June", reports: 140, resolved: 125 },
];

const chartConfig = {
  reports: {
    label: "Reports",
    color: "var(--lime)",
  },
  resolved: {
    label: "Resolved",
    color: "var(--sky)",
  },
} satisfies ChartConfig;

export default function AdminCharts() {
  return (
    <div className="neu-border bg-white p-6 rounded-none text-black dark:bg-brand-gray-base-800 dark:border-cream dark:text-cream shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
      <h3 className="font-mono text-sm font-bold uppercase mb-4 tracking-wider">
        Reports Analytics Summary
      </h3>
      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <AreaChart
          data={chartData}
          margin={{
            left: 0,
            right: 12,
          }}
        >
          <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.1)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
            style={{ fontSize: "12px", fontFamily: "monospace" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            style={{ fontSize: "12px", fontFamily: "monospace" }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Area
            dataKey="resolved"
            type="natural"
            fill="var(--sky)"
            fillOpacity={0.4}
            stroke="var(--sky)"
            strokeWidth={2}
            stackId="a"
          />
          <Area
            dataKey="reports"
            type="natural"
            fill="var(--lime)"
            fillOpacity={0.4}
            stroke="var(--lime)"
            strokeWidth={2}
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
