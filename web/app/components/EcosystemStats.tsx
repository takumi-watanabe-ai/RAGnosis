"use client";

import { useEffect, useState } from "react";
import { getEcosystemOverview, type EcosystemOverview } from "@/lib/analytics";

function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)} K`;
  }
  return num.toString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-border bg-white p-4 sm:p-6">
      <div className="text-xs sm:text-sm text-stone font-light uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-medium text-charcoal tracking-tight">
        {value}
      </div>
    </div>
  );
}

export function EcosystemStats() {
  const [overview, setOverview] = useState<EcosystemOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getEcosystemOverview();
        setOverview(data);
      } catch (err) {
        console.error("Error loading ecosystem overview:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !overview) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
      <StatCard
        label="Models"
        value={parseInt(overview.total_models).toLocaleString()}
      />
      <StatCard
        label="Repositories"
        value={parseInt(overview.total_repos).toLocaleString()}
      />
      <StatCard
        label="Total Downloads"
        value={formatLargeNumber(parseInt(overview.total_downloads))}
      />
      <StatCard
        label="Total Stars"
        value={formatLargeNumber(parseInt(overview.total_stars))}
      />
    </div>
  );
}
