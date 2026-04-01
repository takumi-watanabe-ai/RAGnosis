# RAGnosis Web - Next.js Frontend

Modern, professional React + Next.js interface for RAGnosis using shadcn/ui components and lucide-react icons.

## Features

### 🎨 Modern UI
- **Message bubbles** - Clean, chat-style interface with user/assistant distinction
- **Professional icons** - Lucide React icons throughout (Sparkles for AI, User for profile)
- **Gradient accents** - Blue gradient for AI avatar and branding
- **Smooth animations** - Loading states with bouncing dots, fade-in effects
- **shadcn/ui components** - Button, Tooltip components for consistency

### 💬 Chat Interface
- **Copy messages** - One-click copy button with confirmation feedback
- **Clear chat** - Start fresh with "New Chat" button in header
- **Markdown rendering** - Full support for headers, lists, code, links
- **Source citations** - Clean cards with hover states
- **Loading states** - Animated thinking indicator
- **Auto-scroll** - Smooth scroll to latest messages

### ⚡ Quick Questions
- **Suggested prompts** - 6 curated questions on welcome screen
- **Sidebar categories** - Organized by topic (Embeddings, Vector DBs, etc.)
- **One-click send** - Click any question to instantly ask

### 🎯 UX Enhancements
- **Welcome screen** - Engaging intro with feature highlights
- **Responsive design** - Works on mobile, tablet, desktop
- **Keyboard shortcuts** - Enter to send, Shift+Enter for new line
- **Professional styling** - Clean, minimal, familiar design

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
NEXT_PUBLIC_EDGE_FUNCTION_URL=http://localhost:54321/functions/v1/rag-chat
NEXT_PUBLIC_SUPABASE_KEY=  # Optional for local dev
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
web/
├── app/
│   ├── page.tsx              # Landing page
│   ├── chat/page.tsx         # Chat interface
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── SimpleChatInterface.tsx  # Main chat UI
│   ├── QuickQuestions.tsx       # Category sidebar
│   ├── SourceCard.tsx           # Search result cards
│   └── ui/                      # shadcn components
│       ├── button.tsx
│       └── tooltip.tsx
└── lib/
    ├── api.ts                # Edge function client
    ├── quick-questions.ts    # Question data
    └── utils.ts              # Utilities (cn)
```

## Components

### SimpleChatInterface
Main chat component with:
- Message rendering (user/assistant bubbles)
- Markdown support with custom styling
- Copy functionality
- Source display
- Loading states
- Suggested questions on empty state

### QuickQuestions
Collapsible sidebar with categorized questions:
- 🔢 Embeddings
- 🗄️ Vector DBs
- 🔧 RAG Frameworks
- ⚖️ Comparisons
- 🔍 How-to
- 🔧 Troubleshooting
- 📈 Trends

### UI Components (shadcn)
- **Button** - Variants: default, outline, ghost, link
- **Tooltip** - Hover tooltips with animations

## Usage with Backend

Make sure the Supabase edge function is running:

```bash
# In the root directory
make web
```

This starts:
- Edge function at `http://localhost:54321/functions/v1/rag-chat`
- Next.js dev server at `http://localhost:3000`

## Styling

- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Pre-built accessible components
- **lucide-react** - Professional icon library
- **Custom colors** - Blue accent (#3b82f6), Gray neutrals

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS
- **Components**: shadcn/ui (Radix primitives)
- **Icons**: Lucide React
- **Markdown**: react-markdown + remark-gfm
- **Runtime**: Edge Functions

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment

The app can be deployed to:
- Vercel (recommended for Next.js)
- Netlify
- Cloudflare Pages
- Self-hosted

Update `NEXT_PUBLIC_EDGE_FUNCTION_URL` to your production edge function URL.

## Design Philosophy

- **Familiar** - Patterns users know from ChatGPT, Claude
- **Professional** - Clean, minimal, trustworthy
- **Functional** - Every element serves a purpose
- **Accessible** - Built on Radix UI primitives
- **Fast** - Optimized for performance
