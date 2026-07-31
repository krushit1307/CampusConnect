import ReactECharts from "echarts-for-react";

interface EChartsWrapperProps {
  option: Record<string, unknown>;
  style?: React.CSSProperties;
  opts?: {
    renderer?: "canvas" | "svg";
  };
}

export default function EChartsWrapper({ option, style, opts }: EChartsWrapperProps) {
  return <ReactECharts option={option} style={style} opts={opts} />;
}
