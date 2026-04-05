"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import type { RepoCompetitivePosition } from "@/lib/market-analysis";
import { useResponsiveMargin } from "./useResponsiveMargin";
import { useResponsiveYOffset } from "./useResponsiveYOffset";
import { useResponsiveRightMargin } from "./useResponsiveRightMargin";

interface RepoPositionChartProps {
  repoPositions: RepoCompetitivePosition[];
  isTouchDevice: boolean;
}

export function RepoPositionChart({
  repoPositions,
  isTouchDevice,
}: RepoPositionChartProps) {
  const leftMargin = useResponsiveMargin();
  const rightMargin = useResponsiveRightMargin();
  const yOffset = useResponsiveYOffset();

  if (repoPositions.length === 0) {
    return null;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart
          margin={{ top: 20, right: rightMargin, bottom: 60, left: leftMargin }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            type="number"
            dataKey="months_old"
            name="Months Old"
            stroke="#666666"
            domain={[0, (dataMax: number) => Math.ceil(dataMax / 12) * 12]}
            tickCount={8}
            label={{
              value: "Project Age (Months Since Creation) →",
              position: "bottom",
              offset: 40,
              style: { fontSize: 12, fill: "#666666" },
            }}
          />
          <YAxis
            type="number"
            dataKey="stars"
            name="Stars"
            scale="log"
            domain={[
              (dataMin: number) => Math.max(dataMin * 0.8, 100),
              (dataMax: number) => dataMax * 1.2,
            ]}
            tickCount={8}
            stroke="#666666"
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              }
              return value.toString();
            }}
            label={{
              value: "Market Authority (Stars) →",
              angle: -90,
              position: "insideLeft",
              offset: yOffset,
              style: {
                fontSize: 12,
                fill: "#666666",
                textAnchor: "middle",
              },
            }}
          />
          <ZAxis
            type="number"
            dataKey="forks"
            range={[15, 1800]}
            name="Forks"
          />
          <Tooltip
            content={<RepoPositionTooltip />}
            cursor={{ strokeDasharray: "3 3" }}
            wrapperStyle={{ pointerEvents: "auto" }}
            allowEscapeViewBox={{ x: true, y: true }}
            animationDuration={0}
            trigger={isTouchDevice ? "click" : "hover"}
          />
          <Scatter data={repoPositions} fill="#222222">
            {repoPositions.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getCategoryColor(entry.category)}
                opacity={0.7}
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: "pointer", touchAction: "auto" }}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-stone-border bg-white">
          <div className="text-xs text-charcoal font-medium mb-2 uppercase tracking-wide">
            Quadrants
          </div>
          <div className="text-xs text-stone font-light space-y-1">
            <div>
              <span className="font-medium">Top-left:</span> Modern Leaders -
              High stars, new projects (0-12mo)
            </div>
            <div>
              <span className="font-medium">Top-right:</span> Legacy Standards -
              High stars, mature projects (24mo+)
            </div>
            <div>
              <span className="font-medium">Bottom-left:</span> Emerging - New
              projects gaining traction
            </div>
            <div>
              <span className="font-medium">Bottom-right:</span> Historical -
              Old projects, lower adoption
            </div>
          </div>
        </div>
        <div className="p-4 border border-stone-border bg-white">
          <div className="text-xs text-charcoal font-medium mb-2 uppercase tracking-wide">
            Topic Categories
          </div>
          <div className="text-xs text-stone font-light space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#4682b4" }} />
              <span>Generation/LLM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#2e8b57" }} />
              <span>RAG/Retrieval</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#d2691e" }} />
              <span>Agents/Orchestration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#999999" }} />
              <span>Other</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getCategoryColor(category: string): string {
  if (!category) return "#999999";
  const cat = category.toLowerCase();

  // Generation/LLM (Blue) - 188+ repos
  if (
    cat.includes("llm") || // 188
    cat.includes("openai") || // 92
    cat.includes("chatgpt") || // 71
    cat.includes("gpt") || // 45
    cat.includes("chatbot") || // 37
    cat.includes("large-language-model") ||
    cat.includes("claude") || // 32
    cat.includes("llama") // 39
  ) {
    return "#4682b4"; // Blue
  }

  // RAG/Retrieval (Green) - 113+ repos
  if (
    cat.includes("rag") || // 113
    cat.includes("retrieval-augmented") || // 36
    cat.includes("embedding") || // 31
    cat.includes("semantic-search") || // 29
    cat.includes("vector-database") || // 38
    cat.includes("vector-search") // 34
  ) {
    return "#2e8b57"; // Green
  }

  // Agents/Orchestration (Orange) - 63+ repos
  if (
    cat.includes("agent") || // 63 + 54 + 51 = 168
    cat.includes("langchain") || // 58
    cat.includes("mcp") || // 50
    cat.includes("orchestr") ||
    cat.includes("workflow")
  ) {
    return "#d2691e"; // Orange
  }

  // Other (Gray)
  return "#999999";
}

function RepoPositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RepoCompetitivePosition }>;
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-stone-border p-3 shadow-sm max-w-xs">
        <div className="text-xs text-charcoal uppercase tracking-wide mb-2 font-medium">
          {data.repo_name}
        </div>
        <div className="text-xs text-stone font-light space-y-1">
          <div>Category: {data.category}</div>
          <div>Owner: {data.owner}</div>
          <div>Stars: {data.stars.toLocaleString()}</div>
          <div>Forks: {data.forks.toLocaleString()}</div>
          <div>
            Created:{" "}
            {data.created_at
              ? new Date(data.created_at).toLocaleDateString()
              : "Unknown"}
          </div>
          <div>
            Age: {data.months_old ?? "Unknown"}{" "}
            {data.months_old === 1 ? "month" : "months"} old
          </div>
          <div>
            Last updated: {data.days_since_update ?? "Unknown"}{" "}
            {data.days_since_update === 1 ? "day" : "days"} ago
          </div>
          <div>Market Share: {data.market_share.toFixed(2)}%</div>
          <div>Rank: #{data.ranking_position}</div>
        </div>
      </div>
    );
  }
  return null;
}
