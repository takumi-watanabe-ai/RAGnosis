"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ProgressStep {
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  isStreaming?: boolean;
}

export function ProgressSteps({ steps, isStreaming }: ProgressStepsProps) {
  const [expanded, setExpanded] = useState(true);

  if (!steps || steps.length === 0) return null;

  const totalSteps = steps.length;

  // Map step names to friendly agent names
  const agentNames: Record<string, string> = {
    query_planner: "Query Planner",
    query_expander: "Query Expander",
    search_engine: "Search Engine",
    answer_generator: "Answer Generator",
    quality_checker: "Quality Checker",
    start: "System",
  };

  // Group consecutive steps by agent
  interface AgentSection {
    agent: string;
    messages: { message: string; originalStep: string }[];
  }

  const sections: AgentSection[] = [];
  let currentAgent: string | null = null;

  steps.forEach((step) => {
    const agent = step.step;

    if (agent !== currentAgent) {
      // New agent section
      sections.push({
        agent,
        messages: [{ message: step.message, originalStep: step.step }],
      });
      currentAgent = agent;
    } else {
      // Same agent, add to current section
      sections[sections.length - 1].messages.push({
        message: step.message,
        originalStep: step.step,
      });
    }
  });

  return (
    <div className="mb-4 border border-stone-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-normal text-charcoal">
            Thought Process
          </span>
          <span className="text-xs text-stone/60 font-mono">
            {totalSteps} {totalSteps === 1 ? "step" : "steps"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-stone" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone" />
        )}
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 text-xs bg-white">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1.5">
              {/* Agent section header */}
              <div className="font-semibold text-charcoal text-[13px] tracking-wide">
                {agentNames[section.agent] || section.agent}
              </div>

              {/* Messages within this agent section */}
              {section.messages.map((item, msgIndex) => {
                const hasMultipleLines = item.message.includes("\n");

                return (
                  <div key={msgIndex} className="flex items-start gap-2 pl-3">
                    {/* Message indicator */}
                    <span className="text-stone-400 mt-0.5 flex-shrink-0">
                      →
                    </span>

                    {/* Message content */}
                    <div className="flex-1 min-w-0">
                      {hasMultipleLines ? (
                        // Multi-line content (like query variations)
                        <div className="space-y-0.5">
                          {item.message.split("\n").map((line, lineIndex) => {
                            // First line is the main message
                            if (lineIndex === 0) {
                              return (
                                <div
                                  key={lineIndex}
                                  className="text-stone-700 font-light"
                                >
                                  {line}
                                </div>
                              );
                            }
                            // Subsequent lines are indented details
                            return (
                              <div
                                key={lineIndex}
                                className="pl-3 text-stone-500 font-mono text-[11px] leading-relaxed"
                              >
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Single-line content
                        <div className="text-stone-700 font-light leading-relaxed">
                          {item.message}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {isStreaming && (
            <div className="flex items-start gap-2 pl-3">
              <span className="text-stone-400 mt-0.5 flex-shrink-0">→</span>
              <div className="flex-1 text-stone-500 font-light leading-relaxed animate-pulse">
                Streaming response...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
