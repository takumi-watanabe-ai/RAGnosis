"use client";

import { useState } from "react";
import { quickQuestions, categories } from "@/lib/quick-questions";
import { ChevronDown } from "lucide-react";

interface QuickQuestionsProps {
  onSelectQuestion: (question: string) => void;
}

export function QuickQuestions({ onSelectQuestion }: QuickQuestionsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    setActiveCategory(activeCategory === categoryId ? null : categoryId);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
        Quick Questions
      </div>
      {categories.map((category) => {
        const categoryQuestions = quickQuestions.filter(
          (q) => q.category === category.id,
        );
        const isActive = activeCategory === category.id;

        return (
          <div
            key={category.id}
            className="border-b border-gray-200 last:border-0 pb-2"
          >
            <button
              onClick={() => toggleCategory(category.id)}
              className="flex items-center justify-between w-full py-2.5 px-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 rounded transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <category.icon className="h-4 w-4 text-blue-600" />
                <span>{category.label}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-600 transition-transform ${
                  isActive ? "rotate-180" : ""
                }`}
              />
            </button>
            {isActive && (
              <div className="pt-2 pb-3 space-y-1.5">
                {categoryQuestions.map((question) => (
                  <button
                    key={question.id}
                    onClick={() => onSelectQuestion(question.text)}
                    className="block w-full text-left px-3 py-2.5 text-sm text-gray-800 hover:bg-blue-50 hover:text-blue-900 rounded-md transition-colors leading-relaxed"
                  >
                    {question.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
