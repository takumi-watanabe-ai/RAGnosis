"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  getLanguageTopicMatrix,
  getTaskAnalysis,
  getTopicAnalysis,
  getModelCompetitivePosition,
  getRepoCompetitivePosition,
  getRagTechStackSankey,
  type LanguageTopicMatrix,
  type TaskAnalysis,
  type TopicAnalysis,
  type ModelCompetitivePosition,
  type RepoCompetitivePosition,
  type RagTechStackSankeyFlow,
} from "@/lib/market-analysis";
import {
  getTrendsTimeSeries,
  type TrendsTimeSeries,
} from "@/lib/trends-analysis";
import {
  getTopModels,
  getTopRepos,
  type ModelData,
  type RepoData,
} from "@/lib/analytics";
import { Section } from "./components/Section";
import { TrendsChart } from "./components/TrendsChart";
import { OpportunityAnalysis } from "./components/OpportunityAnalysis";
import { CompetitivePositionAnalysis } from "./components/CompetitivePositionAnalysis";
import { LanguageTopicHeatmap } from "./components/LanguageTopicHeatmap";
import { RagTechStackSankey } from "./components/RagTechStackSankey";
import { TopModelsRepos } from "./components/TopModelsRepos";
import { EcosystemStats } from "@/app/components/EcosystemStats";
import { MarketSkeleton } from "./components/MarketSkeleton";

export default function MarketAnalyticsPage() {
  const [langMatrix, setLangMatrix] = useState<LanguageTopicMatrix[]>([]);
  const [tasks, setTasks] = useState<TaskAnalysis[]>([]);
  const [topics, setTopics] = useState<TopicAnalysis[]>([]);
  const [modelPositions, setModelPositions] = useState<
    ModelCompetitivePosition[]
  >([]);
  const [repoPositions, setRepoPositions] = useState<RepoCompetitivePosition[]>(
    [],
  );
  const [sankeyFlows, setSankeyFlows] = useState<RagTechStackSankeyFlow[]>([]);
  const [trendsData, setTrendsData] = useState<TrendsTimeSeries[]>([]);
  const [topModels, setTopModels] = useState<ModelData[]>([]);
  const [topRepos, setTopRepos] = useState<RepoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch device
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);

    async function loadData() {
      try {
        const [
          matrixData,
          taskData,
          topicData,
          modelPosData,
          repoPosData,
          sankeyData,
          trendsData,
          modelsData,
          reposData,
        ] = await Promise.all([
          getLanguageTopicMatrix(),
          getTaskAnalysis(),
          getTopicAnalysis(),
          getModelCompetitivePosition(),
          getRepoCompetitivePosition(),
          getRagTechStackSankey(),
          getTrendsTimeSeries(),
          getTopModels(10),
          getTopRepos(10),
        ]);

        setLangMatrix(matrixData);
        setTasks(taskData);
        setTopics(topicData);
        setModelPositions(modelPosData);
        setRepoPositions(repoPosData);
        setSankeyFlows(sankeyData);
        setTrendsData(trendsData);
        setTopModels(modelsData);
        setTopRepos(reposData);
      } catch (err) {
        console.error("Error loading market analysis:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load market data",
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <MarketSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-charcoal text-sm tracking-wide mb-4 uppercase">
            Error
          </div>
          <div className="text-stone text-xs font-light">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      {/* Main Content */}
      <main className="px-2 sm:px-12 py-8 sm:py-12">
        <div className="w-full">
          {/* Title */}
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-charcoal mb-3 uppercase">
              RAG Ecosystem Market Structure
            </h1>
            <p className="text-sm sm:text-base text-stone font-light">
              Deep analysis of concentration, competition, and opportunities
            </p>
          </div>

          {/* Ecosystem Overview Stats */}
          <EcosystemStats />

          {/* Google Trends - All Keywords */}
          {trendsData.length > 0 && (
            <Section
              title="Market Interest Over Time"
              subtitle="Search interest trends across RAG ecosystem keywords"
            >
              <TrendsChart trendsData={trendsData} />
            </Section>
          )}

          {/* Opportunity Analysis */}
          <Section
            title="Opportunity Analysis"
            subtitle="Multi-dimensional scoring: market size, competition, concentration, success rate. Bubble size = Market size."
          >
            <OpportunityAnalysis
              tasks={tasks}
              topics={topics}
              isTouchDevice={isTouchDevice}
            />
          </Section>

          {/* Competitive Position Analysis */}
          <Section
            title="Competitive Position Map"
            subtitle="Repos by age vs stars (bubble = engagement). Toggle to see models by recency vs downloads."
          >
            <CompetitivePositionAnalysis
              modelPositions={modelPositions}
              repoPositions={repoPositions}
              isTouchDevice={isTouchDevice}
            />
          </Section>

          {/* Top Repos & Models */}
          <Section
            title="Top Repositories & Models"
            subtitle="Leading repositories by stars and models by downloads"
          >
            <TopModelsRepos topModels={topModels} topRepos={topRepos} />
          </Section>

          {/* RAG Tech Stack Sankey */}
          <Section
            title="RAG Ecosystem Overview"
            subtitle="Explore GitHub repositories and HuggingFace models categorized by RAG use cases"
          >
            <RagTechStackSankey flows={sankeyFlows} />
          </Section>

          {/* Language × Topic Matrix */}
          <Section
            title="Language × Topic Matrix"
            subtitle="Which languages dominate which topics?"
          >
            <LanguageTopicHeatmap langMatrix={langMatrix} />
          </Section>
        </div>
      </main>
    </div>
  );
}
