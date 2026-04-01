import Link from "next/link";
import { ArrowRight, Search, TrendingUp, Lightbulb, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">R</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">RAGnosis</h1>
            </div>
            <Link
              href="/chat"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Launch Chat
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center">
          <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            AI-Powered RAG Intelligence
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
            Making smart decisions about RAG technology? Get quantitative
            metrics from HuggingFace and GitHub, plus expert knowledge from
            4,000+ blog articles.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Start Asking Questions
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Search className="h-6 w-6" />}
            title="Market Intelligence"
            description="Real-time data from HuggingFace models, GitHub repos, and Google Trends"
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Expert Knowledge"
            description="Insights from 4,000+ blog articles by teams who built RAG in production"
          />
          <FeatureCard
            icon={<Lightbulb className="h-6 w-6" />}
            title="Smart Answers"
            description="LLM-powered query understanding with hybrid search and reranking"
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="For Decision Makers"
            description="Built for engineers, CTOs, architects, and hiring managers"
          />
        </div>

        {/* Quick Examples */}
        <div className="py-16 border-t border-gray-200 ">
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Ask Anything About RAG
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <ExampleQuestion text="What are the top embedding models?" />
            <ExampleQuestion text="LangChain vs LlamaIndex?" />
            <ExampleQuestion text="How to improve retrieval accuracy?" />
            <ExampleQuestion text="Best vector database for small projects?" />
            <ExampleQuestion text="Why is my RAG hallucinating?" />
            <ExampleQuestion text="What's trending in RAG right now?" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200  mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-700 ">
            <p>
              Built to showcase production RAG systems, LLM-powered query
              understanding, and hybrid search architectures.
            </p>
            <p className="mt-2">© 2026 RAGnosis. Open Source.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg border border-gray-200  bg-white ">
      <div className="mb-3 text-gray-900 ">{icon}</div>
      <h4 className="text-lg font-semibold mb-2 text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600 ">{description}</p>
    </div>
  );
}

function ExampleQuestion({ text }: { text: string }) {
  return (
    <Link
      href={`/chat?q=${encodeURIComponent(text)}`}
      className="p-4 rounded-lg border border-gray-200  bg-white  hover:border-gray-300  transition-colors text-sm text-gray-900"
    >
      {text}
    </Link>
  );
}
