# RAGnosis - Requirements Document

> **Diagnose the RAG market with AI-powered intelligence**

**Status:** POC Phase
**Target Audience:** VCs, Product Managers, Founders in AI/RAG space
**Last Updated:** 2026-03-25

---

## Executive Summary

**RAGnosis** is an AI-powered market intelligence platform that helps investors and product leaders make data-driven decisions about RAG (Retrieval-Augmented Generation) technology investments and product strategy.

**Core Value Proposition:**
- **For VCs:** Identify promising RAG startups before they peak
- **For Product Managers:** Track competitive RAG features and adoption patterns
- **For Founders:** Understand market positioning and technical trends

**Key Differentiator:** Combines SQL analytics (precise trend data) with agentic AI research (synthesizes insights from unstructured sources like papers, blogs, and discussions).

---

## Problem Statement

### Current Pain Points

1. **Fragmented Information**
   - RAG trends scattered across HuggingFace, GitHub, ArXiv, blogs
   - No single source of truth for market intelligence
   - Time-consuming manual research

2. **Lagging Indicators**
   - Traditional market research reports are 6+ months behind
   - By the time trends are documented, opportunities are gone

3. **Technical Depth Required**
   - Understanding RAG requires technical expertise
   - Decision-makers lack time to read papers and analyze repos
   - Need synthesis, not raw data

### Target User Personas

**1. Sarah (Venture Capitalist)**
- **Goal:** Identify RAG startups worth investing in
- **Needs:**
  - Early signals of technology adoption
  - Competitive landscape analysis
  - Technical due diligence on RAG architectures
- **Success:** Invests in RAG startup 6 months before it becomes hot

**2. Mike (Product Manager at AI Company)**
- **Goal:** Decide if/how to add RAG to product
- **Needs:**
  - What RAG patterns are proven?
  - Which frameworks have momentum?
  - What are common failure modes?
- **Success:** Ships RAG feature that customers love

**3. Lisa (Founder Building RAG Product)**
- **Goal:** Position product in crowded market
- **Needs:**
  - Competitive feature analysis
  - Market gaps and opportunities
  - Technical differentiation strategies
- **Success:** Finds unique positioning angle

---

## Solution Overview

### Two-Layer Architecture

**Layer 1: SQL Analytics Dashboard**
- Precise, queryable time-series data
- Fast aggregations and trend analysis
- Historical snapshots for comparison

**Layer 2: Agentic Research Assistant**
- Natural language queries
- Multi-step reasoning and planning
- Synthesizes insights from unstructured content
- Provides sourced, comprehensive answers

### Core Capabilities

#### 1. Market Trend Analysis (SQL)
- RAG framework adoption (GitHub stars, forks over time)
- Model popularity (HuggingFace downloads, rankings)
- Search interest evolution (Google Trends)
- Market share metrics (RAG vs non-RAG models)

#### 2. Competitive Intelligence (Agent + RAG)
- "What RAG features did competitors launch this month?"
- Searches: Product Hunt, HackerNews, blog announcements
- Synthesizes: Timeline, feature comparison, market reception

#### 3. Technical Due Diligence (Agent + RAG)
- "Technical risks in current RAG systems?"
- Searches: ArXiv papers, technical blogs, GitHub issues
- Synthesizes: Common failure modes, architectural patterns, best practices

#### 4. Investment Signals (Agent + SQL + RAG)
- "Which RAG frameworks are VCs betting on?"
- Combines: Funding data, GitHub activity, blog mentions
- Synthesizes: Investment thesis, momentum indicators

---

## Technical Architecture

### Data Sources

**Structured Data (SQL Tables)**
```
hf_models:
  - model_name, downloads, likes, ranking_position
  - snapshot_date (daily snapshots)
  - is_rag_related, rag_category

github_repos:
  - repo_name, stars, forks, language
  - snapshot_date (daily snapshots)
  - is_rag_related, rag_category

google_trends:
  - keyword, current_interest, trend_direction
  - snapshot_date (daily snapshots)
```

**Unstructured Data (Vector Store)**
```
ragnosis_docs:
  - text (full content)
  - embedding (vector(384))
  - doc_type: arxiv_paper | blog_post | hn_post | reddit_post
  - metadata: {url, title, author, date, source}
```

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface (Vercel)               │
│  ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ Analytics        │    │ AI Research Assistant    │  │
│  │ Dashboard        │    │ (Chat Interface)         │  │
│  └──────────────────┘    └──────────────────────────┘  │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
                ▼                      ▼
┌───────────────────────┐  ┌─────────────────────────────┐
│  Supabase Client      │  │  Vercel Edge Function       │
│  (SQL queries)        │  │  (Agent Orchestration)      │
└───────────┬───────────┘  └────────────┬────────────────┘
            │                           │
            │              ┌────────────┴────────────┐
            │              │                         │
            ▼              ▼                         ▼
┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
│  Supabase SQL    │  │  pgvector   │  │  LLM             │
│  (Time-series)   │  │  (RAG)      │  │  (OpenRouter)    │
└──────────────────┘  └─────────────┘  └──────────────────┘
            ▲              ▲
            │              │
┌───────────┴──────────────┴───────────┐
│     Daily Ingestion Pipeline         │
│  (GitHub Actions / Cron Job)         │
│                                       │
│  1. Fetch structured data → SQL      │
│  2. Scrape unstructured → Vector DB  │
└───────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js (Vercel deployment)
- Tailwind CSS
- Recharts (analytics visualizations)

**Backend:**
- Vercel Edge Functions (agent orchestration)
- Supabase (PostgreSQL + pgvector)
- LangChain (agent framework)

**Data Pipeline:**
- Python (scrapers and processors)
- GitHub Actions (scheduled runs)
- sentence-transformers (embeddings)

**LLM:**
- OpenRouter API (production)
- Ollama (local development)

---

## POC Scope

### Phase 1: Foundation (Week 1-2)

**Goal:** Establish data pipeline and basic analytics

**Deliverables:**
- [x] SQL tables with time-series data (HF, GitHub, Trends)
- [x] Daily ingestion pipeline
- [ ] Basic analytics dashboard
- [ ] Deployed on Vercel

**Success Criteria:**
- 30 days of historical data
- Dashboard loads in <2s
- Data updates daily automatically

### Phase 2: Content Layer (Week 3)

**Goal:** Add unstructured content for RAG

**Data Sources:**
1. **ArXiv Papers** (~50 papers)
   - Search: "retrieval augmented generation", "RAG systems"
   - Extract: Title, abstract, full text, citations

2. **Technical Blogs** (~100 posts)
   - Sources: Anthropic, LangChain, Pinecone, Weaviate RSS
   - Content: RAG tutorials, case studies, architecture posts

3. **HackerNews** (~200 posts)
   - Filter: RAG, vector database, embedding mentions
   - Content: Launch announcements, discussions

**Deliverables:**
- [ ] Content scrapers (arxiv_fetcher.py, blog_fetcher.py, hn_fetcher.py)
- [ ] Vector embeddings generated and stored
- [ ] Basic semantic search working

**Success Criteria:**
- 300+ documents embedded in pgvector
- Search latency <500ms
- Relevant results for test queries

### Phase 3: Agentic Assistant (Week 4)

**Goal:** Build the AI research assistant

**Agent Capabilities:**
1. **Planning:** Break down complex queries into sub-tasks
2. **Tool Use:**
   - sql_query() - Execute SQL for trend data
   - vector_search() - Semantic search over content
   - web_search() - Optional: latest info (future)
3. **Synthesis:** Combine findings into coherent answer
4. **Attribution:** Cite all sources

**Deliverables:**
- [ ] Agent orchestration (LangChain ReAct agent)
- [ ] Tool definitions and implementations
- [ ] Chat interface with streaming responses
- [ ] "Thinking" visualization (show agent steps)

**Success Criteria:**
- Answers 5 demo queries correctly
- Shows reasoning steps
- Provides 3+ sources per answer
- Response time <10s

### Phase 4: Polish (Week 5)

**Goal:** Production-ready demo

**Deliverables:**
- [ ] Error handling and fallbacks
- [ ] Rate limiting and caching
- [ ] SEO optimization
- [ ] Demo video (2 min)
- [ ] Landing page copy

**Launch Checklist:**
- [ ] Custom domain (ragnosis.com)
- [ ] Analytics tracking (PostHog/Plausible)
- [ ] Share on Twitter, HN, LinkedIn
- [ ] Add to portfolio site

---

## Demo Scenarios

### Scenario 1: VC Evaluation

**User:** "Should I invest in a RAG startup focused on legal document search?"

**Agent Actions:**
1. **Trend Analysis:** Queries SQL for RAG adoption in legal tech
2. **Market Research:** Searches papers/blogs about RAG in legal domain
3. **Competitive Landscape:** Finds existing players and their traction
4. **Technical Assessment:** Identifies common challenges (hallucination, citation accuracy)

**Output:**
```
📊 Market Analysis:
- Legal RAG startups raised $X in last 12 months
- GitHub activity up 45% YoY in legal NLP projects
- 3 major competitors: [names with traction metrics]

🔬 Technical Insights:
- Key challenge: Citation accuracy (source: Paper X, Blog Y)
- Proven approach: Hybrid retrieval (source: Blog Z)
- Differentiation opportunity: Multi-jurisdictional knowledge

💡 Recommendation:
Market is heating up but not saturated. Technical moat requires...

📚 Sources:
- ArXiv: "RAG for Legal Documents" (2024)
- LangChain Blog: "Building Legal AI"
- HN Discussion: "Legal AI startups"
```

### Scenario 2: Product Decision

**User:** "What RAG frameworks should we evaluate for our product?"

**Agent Actions:**
1. **Popularity Trends:** Queries SQL for framework adoption (stars, downloads)
2. **Feature Comparison:** Searches docs/blogs for capabilities
3. **Production Readiness:** Analyzes GitHub issues, community feedback
4. **Cost Analysis:** Finds pricing and resource requirements

**Output:**
```
🏆 Top 3 Frameworks (by momentum):

1. LangChain
   - Stars: 75k (+15k this quarter)
   - Best for: Rapid prototyping, rich ecosystem
   - Caveat: Performance tuning needed at scale

2. LlamaIndex
   - Stars: 45k (+8k this quarter)
   - Best for: Document-heavy applications
   - Caveat: Steeper learning curve

3. Haystack
   - Stars: 25k (stable)
   - Best for: Production pipelines
   - Caveat: Less community buzz

📊 Adoption Signals:
- LangChain: Most blog posts (120 in Q1)
- LlamaIndex: Best documentation quality
- Haystack: Most enterprise deployments

📚 Sources: [10+ sources with links]
```

### Scenario 3: Competitive Analysis

**User:** "What RAG features did Anthropic ship recently?"

**Agent Actions:**
1. **Announcement Search:** Searches blogs, HN, Product Hunt
2. **Technical Details:** Finds papers, documentation
3. **Market Reception:** Analyzes discussion sentiment
4. **Comparison:** Compares to OpenAI, Google approaches

**Output:**
```
🚀 Recent Anthropic RAG Launches:

1. Claude with Citations (Feb 2024)
   - Feature: Inline source attribution
   - Reception: 500+ HN upvotes, largely positive
   - Technical: Custom retrieval pipeline (source: blog)

2. Extended Context RAG (Jan 2024)
   - Feature: 200k token context with retrieval
   - Impact: Reduces need for traditional RAG
   - Trade-off: Cost vs accuracy

📊 Competitive Position:
- More transparent than OpenAI's approach
- Less customizable than LangChain solutions
- Premium pricing limits adoption

📚 Sources: [Anthropic blog, HN threads, papers]
```

---

## Success Metrics

### POC Success (Week 5)

**User Engagement:**
- [ ] 100+ unique visitors to demo
- [ ] 20+ agent queries tested
- [ ] 5+ positive feedback/testimonials

**Technical Performance:**
- [ ] Analytics dashboard loads <2s
- [ ] Agent response time <10s average
- [ ] 90%+ query success rate
- [ ] Zero downtime during demo period

**Showcase Value:**
- [ ] LinkedIn post: 50+ reactions
- [ ] HackerNews: Front page (top 30)
- [ ] Portfolio: Featured as primary project

### Long-term Goals (Post-POC)

**Product-Market Fit:**
- 1,000+ registered users
- 50+ weekly active researchers
- 10+ paying customers (freemium model)

**Hiring Outcome:**
- 3+ inbound interview requests
- 1+ job offer for RAG/Agentic AI role
- Demonstrates: Technical depth, product sense, execution

---

## Non-Goals (Out of Scope for POC)

**Explicitly NOT building:**
- ❌ Real-time data (daily updates sufficient)
- ❌ User authentication (public demo)
- ❌ Custom alerts/notifications
- ❌ API for third-party access
- ❌ Mobile app
- ❌ Multi-language support
- ❌ Financial/investment advice (legal liability)
- ❌ Predictive models (descriptive only)

---

## Risk Assessment

### Technical Risks

**1. LLM Hallucination**
- **Risk:** Agent fabricates data or misinterprets sources
- **Mitigation:**
  - Always show sources for verification
  - Use structured SQL queries for quantitative claims
  - Prompt engineering: "Only use provided sources"

**2. Query Latency**
- **Risk:** Agent takes >30s, users bounce
- **Mitigation:**
  - Stream responses (show thinking steps)
  - Cache common queries
  - Limit tool calls to 5 max

**3. Content Staleness**
- **Risk:** Outdated information misleads users
- **Mitigation:**
  - Display data freshness dates
  - Daily ingestion pipeline
  - Agent mentions recency in answers

### Market Risks

**1. Limited Differentiation**
- **Risk:** Looks like another chatbot
- **Mitigation:**
  - Emphasize agentic planning (visible thinking)
  - Show SQL + RAG hybrid approach
  - Focus on B2B use case, not consumer

**2. Narrow Audience**
- **Risk:** Only RAG enthusiasts care
- **Mitigation:**
  - Target decision-makers (VCs, PMs), not just engineers
  - Solve business problems, not technical curiosity
  - Expand to broader AI market intelligence (future)

---

## Development Phases (Post-POC)

### Phase 5: Monetization (Month 2)
- User authentication (Supabase Auth)
- Freemium model: 10 queries/month free
- Pro tier: $49/month unlimited
- API access for power users

### Phase 6: Expansion (Month 3-4)
- Funding data integration (Crunchbase API)
- Company profiles (deep dives on RAG startups)
- Custom alerts ("Notify me when X framework hits Y stars")
- Slack/Discord integration

### Phase 7: Platform (Month 5-6)
- User-generated research queries
- Share/collaborate on findings
- Export reports (PDF, slides)
- Team workspaces

---

## Appendix

### A. Data Source APIs

**Already Integrated:**
- HuggingFace API (models, downloads)
- GitHub API (repos, stars, activity)
- Google Trends (pytrends library)

**POC Additions:**
- ArXiv API (papers)
- RSS Feeds (blog posts)
- HackerNews API (discussions)

**Future Consideration:**
- Crunchbase API (funding data) - $$
- Product Hunt API (launches)
- Reddit API (discussions)
- Twitter/X API (sentiment) - $$$

### B. Agent Prompt Templates

**System Prompt:**
```
You are RAGnosis, an AI research analyst specializing in RAG market intelligence.

Your role: Help VCs, PMs, and founders make data-driven decisions about RAG technology.

Your capabilities:
- sql_query(): Execute SQL queries on time-series data (HF models, GitHub repos, Google Trends)
- vector_search(): Search papers, blogs, and discussions semantically
- Think step-by-step before answering
- Always cite sources
- Admit uncertainty when data is insufficient

Response format:
1. Brief answer (1-2 sentences)
2. Supporting analysis with data
3. Relevant context/caveats
4. Sources (with links)

Remember: You're advising business decisions, not just answering trivia. Focus on actionable insights.
```

**Tool Use Example:**
```
Question: "Is interest in RAG rising?"

Thought: I need to check multiple signals:
1. GitHub star growth (SQL)
2. HuggingFace model downloads (SQL)
3. Google search trends (SQL)
4. Blog post frequency (vector search)

Action: sql_query("SELECT...")
Observation: [results]

Action: vector_search("RAG adoption trends 2024")
Observation: [results]

Thought: Data shows mixed signals. GitHub up 40%, but...

Final Answer: [synthesis with sources]
```

### C. Competitive Landscape

**Similar Tools:**
- **Crunchbase** - Funding data, but no technical insights
- **Google Trends** - Search interest, but no synthesis
- **GitHub Trending** - Star tracking, but no context
- **AngelList** - Startup discovery, but not RAG-specific

**RAGnosis Differentiator:**
- Only tool combining technical + market signals
- AI agent synthesizes insights, not just raw data
- RAG-specific focus vs general startup tracking
- Targets decision-makers, not just developers

---

**Document Version:** 1.0
**Next Review:** After POC completion
**Owner:** Portfolio Project
**Status:** Active Development
