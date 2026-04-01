"use client";

import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Send, Copy, Check, User, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendChatMessage } from "@/lib/api";
import { SourceCard } from "./SourceCard";
import type { SearchResult } from "@/lib/api";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { quickQuestions } from "@/lib/quick-questions";
import type { SettingsConfig } from "./Settings";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SearchResult[];
  metadata?: {
    intent?: string;
  };
}

interface SimpleChatInterfaceProps {
  initialQuestion?: string | null;
  settings: SettingsConfig;
}

export interface SimpleChatInterfaceHandle {
  sendMessage: (text: string) => void;
  clearChat: () => void;
}

export const SimpleChatInterface = forwardRef<
  SimpleChatInterfaceHandle,
  SimpleChatInterfaceProps
>(({ initialQuestion, settings }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQuestionSentRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialQuestion && !initialQuestionSentRef.current) {
      initialQuestionSentRef.current = true;
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(text, settings.topK);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        metadata: response.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
    initialQuestionSentRef.current = false;
  };

  useImperativeHandle(ref, () => ({
    sendMessage: handleSendMessage,
    clearChat,
  }));

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get 6 suggested questions from different categories
  const suggestedQuestions = [
    quickQuestions.find((q) => q.category === "embeddings")?.text || "",
    quickQuestions.find((q) => q.category === "vector-dbs")?.text || "",
    quickQuestions.find((q) => q.category === "rag-frameworks")?.text || "",
    quickQuestions.find((q) => q.category === "comparisons")?.text || "",
    quickQuestions.find((q) => q.category === "how-to")?.text || "",
    quickQuestions.find((q) => q.category === "troubleshooting")?.text || "",
  ].filter(Boolean);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-white">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900">
                  Welcome to RAGnosis
                </h2>
                <p className="text-gray-600 max-w-md mb-6">
                  AI-powered market intelligence for RAG technology decisions.
                  Get expert insights from 4,000+ articles and real-time data.
                </p>

                {/* Suggested Questions */}
                <div className="w-full max-w-2xl mt-6">
                  <p className="text-sm text-gray-500 mb-3">
                    Try asking about:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestedQuestions.slice(0, 6).map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(question)}
                        className="text-left px-4 py-3 text-sm text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}

                <div
                  className={`flex-1 max-w-[85%] ${message.role === "user" ? "flex flex-col items-end" : ""}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-50 text-gray-900 border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-gray-900 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-3 text-gray-900 leading-6">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-3 space-y-2 list-none">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-3 space-y-2 list-decimal ml-4">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-gray-900 leading-6 pl-0">
                                {children}
                              </li>
                            ),
                            strong: ({ children }) => (
                              <strong className="text-gray-900 font-semibold">
                                {children}
                              </strong>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-xl font-bold text-gray-900 mb-4 mt-6 pb-2 border-b-2 border-blue-500">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-lg font-bold text-blue-600 mb-3 mt-5">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-base font-semibold text-gray-900 mb-2 mt-4 italic">
                                {children}
                              </h3>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto mb-3">
                                {children}
                              </pre>
                            ),
                            a: ({ children, href }) => (
                              <a
                                href={href}
                                className="text-blue-600 hover:text-blue-700 font-medium no-underline hover:underline decoration-2 underline-offset-2 transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-white">{message.content}</div>
                    )}
                  </div>

                  {/* Copy button for assistant messages */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mt-1 ml-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-800 hover:text-gray-900 hover:bg-gray-100"
                            onClick={() =>
                              handleCopy(message.content, message.id)
                            }
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedId === message.id ? "Copied!" : "Copy message"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}

                  {/* Sources */}
                  {settings.showSources &&
                    message.sources &&
                    message.sources.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-semibold mb-3 text-gray-900">
                          Sources
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {message.sources.map((source) => (
                            <SourceCard key={source.position} source={source} />
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-700" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end">
              {messages.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={clearChat}
                      className="flex-shrink-0 h-[44px] px-3 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear chat</TooltipContent>
                </Tooltip>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about RAG models, trends, or implementation challenges..."
                className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-[200px]"
                rows={1}
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 h-[44px] px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});

SimpleChatInterface.displayName = "SimpleChatInterface";
