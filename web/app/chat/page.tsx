"use client";

import { useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  SimpleChatInterface,
  SimpleChatInterfaceHandle,
} from "@/components/SimpleChatInterface";
import { QuickQuestions } from "@/components/QuickQuestions";
import { Settings, type SettingsConfig } from "@/components/Settings";
import { Header } from "@/components/Header";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsConfig>({
    showSources: false,
    topK: 5,
    temperature: 0.7,
    maxTokens: 500,
  });
  const chatRef = useRef<SimpleChatInterfaceHandle>(null);

  const handleQuestionSelect = (question: string) => {
    chatRef.current?.sendMessage(question);
    setSidebarOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-cream">
      <Header
        showMobileMenu
        onMenuClick={() => setSidebarOpen(true)}
        onNewChatClick={() => chatRef.current?.clearChat()}
      />

      {/* Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex md:flex-col w-64 border-r border-stone-border bg-cream">
          <div className="overflow-y-auto px-6 py-8">
            <QuickQuestions onSelectQuestion={handleQuestionSelect} />
          </div>
          <div className="mt-auto px-6 h-[76px] flex items-center border-t border-stone-border">
            <Settings settings={settings} onSettingsChange={setSettings} />
          </div>
        </aside>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-charcoal/60"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-cream border-r border-stone-border flex flex-col">
              <div className="px-6 py-6 border-b border-stone-border flex items-center justify-end">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-xs text-stone hover:text-charcoal transition-colors uppercase tracking-wider font-normal"
                >
                  Close
                </button>
              </div>
              <div className="overflow-y-auto px-6 py-8">
                <QuickQuestions onSelectQuestion={handleQuestionSelect} />
              </div>
              <div className="mt-auto px-6 h-[76px] flex items-center border-t border-stone-border">
                <Settings settings={settings} onSettingsChange={setSettings} />
              </div>
            </aside>
          </div>
        )}

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
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
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-cream flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
