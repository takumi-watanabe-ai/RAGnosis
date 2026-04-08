"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
  onNewChatClick?: () => void;
  showMobileMenu?: boolean;
}

export function Header({
  onMenuClick,
  onNewChatClick,
  showMobileMenu = false,
}: HeaderProps) {
  return (
    <header className="border-b border-stone-border bg-cream">
      <div className="px-6 sm:px-12 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-4">
            {showMobileMenu && (
              <button
                onClick={onMenuClick}
                className="md:hidden flex items-center justify-center text-charcoal hover:opacity-70 transition-opacity p-0 border-0 bg-transparent"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <Link
              href="/"
              className="flex items-center hover:opacity-70 transition-opacity"
            >
              <span className="text-sm font-medium tracking-[0.2em] text-charcoal uppercase">
                RAGnosis
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/market"
              className="text-sm font-medium tracking-wide text-charcoal hover:opacity-70 transition-opacity uppercase"
            >
              Market
            </Link>
            {onNewChatClick ? (
              <button
                onClick={onNewChatClick}
                className="text-sm font-medium tracking-wide text-charcoal hover:opacity-70 transition-opacity uppercase p-0 border-0 bg-transparent cursor-pointer"
              >
                New Chat
              </button>
            ) : (
              <Link
                href="/chat"
                className="text-sm font-medium tracking-wide text-charcoal hover:opacity-70 transition-opacity uppercase"
              >
                Chat
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
