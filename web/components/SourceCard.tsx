import { ExternalLink } from "lucide-react";
import type { SearchResult } from "@/lib/api";

interface SourceCardProps {
  source: SearchResult;
}

export function SourceCard({ source }: SourceCardProps) {
  const domain = new URL(source.url).hostname;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate mb-1 text-gray-900">
            {source.metadata.title}
          </div>
          <div className="text-xs text-gray-600 truncate">{domain}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      </div>
    </a>
  );
}
