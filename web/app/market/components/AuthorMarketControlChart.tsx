"use client";

import { useState, useEffect } from "react";
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { AuthorConcentration } from "@/lib/market-analysis";
import { useResponsiveRightMargin } from "./useResponsiveRightMargin";

interface AuthorMarketControlChartProps {
  authors: AuthorConcentration[];
}

interface AuthorWithCumulative extends AuthorConcentration {
  cumulative_share: number;
}

export function AuthorMarketControlChart({
  authors,
}: AuthorMarketControlChartProps) {
  const [leftMargin, setLeftMargin] = useState(120);
  const rightMargin = useResponsiveRightMargin();

  useEffect(() => {
    function updateMargin() {
      const width = window.innerWidth;
      // Desktop (>1024px): 120, Tablet (768-1024px): 5, Mobile (<768px): 0
      if (width >= 1024) {
        setLeftMargin(120);
      } else if (width >= 768) {
        setLeftMargin(5);
      } else {
        setLeftMargin(0);
      }
    }

    updateMargin();
    window.addEventListener("resize", updateMargin);
    return () => window.removeEventListener("resize", updateMargin);
  }, []);

  // Calculate cumulative market share for Pareto chart
  // Add model count to author label for context
  const authorMarketData = authors.slice(0, 10).map((author, index, arr) => {
    const cumulativeShare = arr
      .slice(0, index + 1)
      .reduce((sum, a) => sum + a.market_share, 0);
    return {
      ...author,
      author_label: `${author.author} (${author.model_count})`,
      cumulative_share: Number(cumulativeShare.toFixed(1)),
    };
  });

  if (authorMarketData.length === 0) {
    return null;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart
          data={authorMarketData}
          layout="vertical"
          margin={{ top: 40, right: rightMargin, left: leftMargin, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            xAxisId="bar"
            type="number"
            stroke="#666666"
            tick={{ fontSize: 10 }}
            label={{
              value: "Market Share %",
              position: "insideBottom",
              offset: -5,
              style: { fontSize: 11, fill: "#666666" },
            }}
          />
          <XAxis
            xAxisId="line"
            type="number"
            orientation="top"
            stroke="#666666"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            label={{
              value: "Cumulative %",
              position: "insideTop",
              offset: -10,
              style: { fontSize: 11, fill: "#666666" },
            }}
          />
          <YAxis
            type="category"
            dataKey="author_label"
            stroke="#666666"
            tick={{ fontSize: 10 }}
            width={leftMargin > 0 ? 140 : 100}
          />
          <Tooltip content={<AuthorTooltip />} />
          <Bar
            xAxisId="bar"
            dataKey="market_share"
            fill="#e5e5e5"
            name="Market Share"
          />
          <Line
            xAxisId="line"
            type="monotone"
            dataKey="cumulative_share"
            stroke="#222222"
            strokeWidth={2}
            dot={{ fill: "#222222", r: 4 }}
            name="Cumulative %"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-6 p-4 border border-stone-border bg-white">
        <div className="text-xs text-charcoal font-light leading-relaxed">
          <span className="font-medium">Ecosystem Players (3+ models):</span>{" "}
          Top 3 authors control{" "}
          {authorMarketData
            .slice(0, 3)
            .reduce((sum, a) => sum + a.market_share, 0)
            .toFixed(1)}
          %, top 10 control{" "}
          {authorMarketData
            .reduce((sum, a) => sum + a.market_share, 0)
            .toFixed(1)}
          % of total downloads. Numbers in parentheses show model count. Steep
          cumulative line = high concentration risk.
        </div>
      </div>
    </>
  );
}

function AuthorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AuthorWithCumulative }>;
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-stone-border p-3 shadow-sm max-w-xs">
        <div className="text-xs text-charcoal uppercase tracking-wide mb-2 font-medium">
          {data.author}
        </div>
        <div className="text-xs text-stone font-light space-y-1">
          <div>Models: {data.model_count}</div>
          <div>
            Downloads:{" "}
            {data.total_downloads >= 1000000
              ? `${(data.total_downloads / 1000000).toFixed(1)}M`
              : data.total_downloads >= 1000
                ? `${(data.total_downloads / 1000).toFixed(0)}K`
                : data.total_downloads.toLocaleString()}
          </div>
          <div>Market Share: {data.market_share.toFixed(1)}%</div>
          <div>Cumulative: {data.cumulative_share.toFixed(1)}%</div>
          <div>Categories: {data.categories.join(", ")}</div>
        </div>
      </div>
    );
  }
  return null;
}
