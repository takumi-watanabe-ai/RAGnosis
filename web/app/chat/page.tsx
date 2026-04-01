"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SimpleChatInterface,
  SimpleChatInterfaceHandle,
} from "@/components/SimpleChatInterface";
import { QuickQuestions } from "@/components/QuickQuestions";
import { Settings, type SettingsConfig } from "@/components/Settings";
import { Menu, PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsConfig>({
    showSources: true,
    topK: 5,
    temperature: 0.7,
    maxTokens: 500,
  });
  const chatRef = useRef<SimpleChatInterfaceHandle>(null);

  const handleQuestionSelect = (question: string) => {
    chatRef.current?.sendMessage(question);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    chatRef.current?.clearChat();
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold leading-none">
                R
              </span>
            </div>
            <span className="text-lg font-bold text-gray-900 leading-none flex items-center">
              RAGnosis
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <QuickQuestions onSelectQuestion={handleQuestionSelect} />
        </div>
        <div className="p-4 border-t border-gray-200">
          <Settings settings={settings} onSettingsChange={setSettings} />
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 hover:opacity-80"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold leading-none">
                    R
                  </span>
                </div>
                <span className="text-lg font-bold text-gray-900 leading-none flex items-center">
                  RAGnosis
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <QuickQuestions onSelectQuestion={handleQuestionSelect} />
            </div>
            <div className="p-4 border-t border-gray-200">
              <Settings settings={settings} onSettingsChange={setSettings} />
            </div>
          </aside>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="gap-2 border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 font-medium"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <SimpleChatInterface
            ref={chatRef}
            initialQuestion={searchParams.get("q")}
            settings={settings}
          />
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return <ChatPageContent />;
}
