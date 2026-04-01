"use client";

import { useEffect, useRef } from "react";
import { Thread, useThreadRuntime } from "@assistant-ui/react";
import { useRAGRuntime } from "@/lib/useRAGRuntime";
import { SourceCard } from "./SourceCard";
import type { SearchResult } from "@/lib/api";

interface ChatInterfaceProps {
  initialQuestion?: string | null;
}

export function ChatInterface({ initialQuestion }: ChatInterfaceProps) {
  const runtime = useRAGRuntime();

  return (
    <Thread
      runtime={runtime}
      className="h-full"
      assistantMessage={{
        components: {
          Text: ({ part }) => {
            return <div className="whitespace-pre-wrap">{part.text}</div>;
          },
        },
      }}
      components={{
        AssistantMessage: ({ message }) => {
          const sources = message.metadata?.sources as
            | SearchResult[]
            | undefined;

          return (
            <div className="space-y-4">
              <div className="whitespace-pre-wrap text-gray-900">
                {message.content.map((part, idx) => {
                  if (part.type === "text") {
                    return (
                      <div key={idx} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {sources && sources.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-3 text-gray-700">
                    Sources
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sources.map((source) => (
                      <SourceCard key={source.position} source={source} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        },
        ThreadRoot: ({ children }) => {
          const threadRuntime = useThreadRuntime();
          const lastQuestionRef = useRef<string | null>(null);

          useEffect(() => {
            if (
              initialQuestion &&
              initialQuestion !== lastQuestionRef.current
            ) {
              lastQuestionRef.current = initialQuestion;
              threadRuntime.append({
                role: "user",
                content: [{ type: "text", text: initialQuestion }],
              });
            }
          }, [initialQuestion, threadRuntime]);

          return <>{children}</>;
        },
      }}
    />
  );
}
