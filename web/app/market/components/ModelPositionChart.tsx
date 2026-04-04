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
import type { ModelCompetitivePosition } from "@/lib/market-analysis";
import { useResponsiveMargin } from "./useResponsiveMargin";
import { useResponsiveYOffset } from "./useResponsiveYOffset";
import { useResponsiveRightMargin } from "./useResponsiveRightMargin";

interface ModelPositionChartProps {
  modelPositions: ModelCompetitivePosition[];
  isTouchDevice: boolean;
}

export function ModelPositionChart({
  modelPositions,
  isTouchDevice,
}: ModelPositionChartProps) {
  const leftMargin = useResponsiveMargin();
  const rightMargin = useResponsiveRightMargin();
  const yOffset = useResponsiveYOffset();

  if (modelPositions.length === 0) {
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
            dataKey="days_since_update"
            name="Days Since Update"
            stroke="#666666"
            domain={[0, (dataMax: number) => Math.ceil(dataMax / 100) * 100]}
            tickCount={6}
            label={{
              value: "Age/Staleness (Days Since Update) →",
              position: "bottom",
              offset: 40,
              style: { fontSize: 12, fill: "#666666" },
            }}
          />
          <YAxis
            type="number"
            dataKey="downloads"
            name="Downloads"
            scale="log"
            domain={[
              (dataMin: number) => Math.max(dataMin * 0.8, 1000),
              (dataMax: number) => dataMax * 1.2,
            ]}
            tickCount={8}
            stroke="#666666"
            tickFormatter={(value) => {
              if (value >= 1000000) {
                const millions = value / 1000000;
                return millions >= 10
                  ? `${millions.toFixed(0)}M`
                  : `${millions.toFixed(1)}M`;
              }
              return `${(value / 1000).toFixed(0)}K`;
            }}
            label={{
              value: "Market Authority (Downloads) →",
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
            dataKey="likes"
            range={[15, 1800]}
            name="Likes"
          />
          <Tooltip
            content={<ModelPositionTooltip />}
            cursor={{ strokeDasharray: "3 3" }}
            wrapperStyle={{ pointerEvents: "auto" }}
            allowEscapeViewBox={{ x: true, y: true }}
            animationDuration={0}
            trigger={isTouchDevice ? "click" : "hover"}
          />
          <Scatter data={modelPositions} fill="#222222">
            {modelPositions.map((entry, index) => (
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
              <span className="font-medium">Top-right:</span> Legacy Standards -
              High authority, mature/stable
            </div>
            <div>
              <span className="font-medium">Bottom-right:</span> Stale - Old but
              low adoption
            </div>
            <div>
              <span className="font-medium">Top-left:</span> Rising Stars - High
              authority, actively maintained
            </div>
            <div>
              <span className="font-medium">Bottom-left:</span> New/Emerging -
              Fresh projects building traction
            </div>
          </div>
        </div>
        <div className="p-4 border border-stone-border bg-white">
          <div className="text-xs text-charcoal font-medium mb-2 uppercase tracking-wide">
            Task Categories
          </div>
          <div className="text-xs text-stone font-light space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#2e8b57" }} />
              <span>RAG/Retrieval</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#4682b4" }} />
              <span>Generation/LLM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#d2691e" }} />
              <span>Vision/Multimodal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: "#999999" }} />
              <span>Other/Unknown</span>
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

  // RAG/Retrieval (Green) - 281 models total
  if (
    cat.includes("sentence-similarity") || // 109
    cat.includes("text-ranking") || // 95
    cat.includes("feature-extraction") || // 77
    cat.includes("embedding") ||
    cat.includes("visual-document-retrieval") || // 50
    cat.includes("rerank") ||
    cat.includes("cross-encoder")
  ) {
    return "#2e8b57"; // Green
  }

  // Generation/LLM (Blue) - 309 models total
  if (
    cat.includes("text-generation") || // 153
    cat.includes("translation") || // 56
    cat.includes("question-answering") || // 50
    cat.includes("summarization") || // 36
    cat.includes("text2text") ||
    cat.includes("conversational")
  ) {
    return "#4682b4"; // Blue
  }

  // Vision/Multimodal (Orange) - 222 models total
  if (
    cat.includes("image-text-to-text") || // 105
    cat.includes("image-feature-extraction") || // 49
    cat.includes("visual-question-answering") || // 30
    cat.includes("image-to-text") || // 18
    cat.includes("visual") ||
    cat.includes("image") ||
    cat.includes("multimodal")
  ) {
    return "#d2691e"; // Orange
  }

  // Unknown (Gray) - everything else
  return "#999999";
}

function ModelPositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ModelCompetitivePosition }>;
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-stone-border p-3 shadow-sm max-w-xs">
        <div className="text-xs text-charcoal uppercase tracking-wide mb-2 font-medium">
          {data.model_name}
        </div>
        <div className="text-xs text-stone font-light space-y-1">
          <div>Category: {data.category}</div>
          <div>Author: {data.author}</div>
          <div>
            Downloads:{" "}
            {data.downloads >= 1000000
              ? `${(data.downloads / 1000000).toFixed(1)}M`
              : `${(data.downloads / 1000).toFixed(0)}K`}
          </div>
          <div>Likes: {data.likes.toLocaleString()}</div>
          <div>
            Last Updated:{" "}
            {data.last_updated
              ? new Date(data.last_updated).toLocaleDateString()
              : "Unknown"}
          </div>
          <div>Days Since Update: {data.days_since_update ?? "Unknown"}</div>
          <div>Market Share: {data.market_share.toFixed(1)}%</div>
          <div>Rank: #{data.ranking_position}</div>
        </div>
      </div>
    );
  }
  return null;
}
