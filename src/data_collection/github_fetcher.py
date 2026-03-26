"""
GitHub repository fetcher for RAG/LLM framework adoption signals.

Fetches TOP repos overall to track RAG framework market share and ranking.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class GitHubRepo:
    """GitHub repository data model with ranking context."""
    id: str
    repo_name: str
    owner: str
    description: str
    stars: int
    forks: int
    watchers: int
    open_issues: int
    language: str
    topics: List[str]
    created_at: str
    updated_at: str
    url: str
    ranking_position: int  # Position in overall top repos
    is_rag_related: bool  # Whether this is RAG/LLM/AI related
    rag_category: Optional[str]  # "rag_framework", "vector_db", "llm_tool", "agent_framework"
    source: str = "github"
    scraped_at: str = datetime.now().isoformat()


class GitHubFetcher:
    """Fetcher for GitHub repository market share and ranking."""

    API_URL = "https://api.github.com"

    # RAG-related categories (SPECIFIC to RAG/retrieval/embedding)
    RAG_CATEGORIES = {
        "rag_framework": [
            "langchain", "llamaindex", "haystack", "semantic-kernel",
            "gpt-index", "langflow", "flowise", "ragas"
        ],
        "vector_db": [
            "qdrant", "chroma", "chromadb", "weaviate", "milvus",
            "pinecone", "faiss", "pgvector", "vectordb"
        ],
        "embedding_tool": [
            "sentence-transformers", "instructor-embedding",
            "text-embeddings", "embedding"
        ],
        "agent_framework": [
            "autogpt", "auto-gpt", "babyagi", "crewai", "agentgpt",
            "superagi", "agent", "agentic"
        ],
    }

    # Keywords for RAG detection (SPECIFIC - no generic LLM terms)
    RAG_KEYWORDS = [
        # Core RAG concepts
        "rag", "retrieval augmented", "retrieval-augmented",
        "vector database", "vector store", "vector search",

        # Embedding/semantic search
        "embedding", "embeddings", "sentence-transformers",
        "semantic search", "similarity search",

        # RAG frameworks (specific names)
        "langchain", "llamaindex", "haystack",

        # Agent-specific (not general chatbot)
        "agent", "agentic", "multi-agent",

        # Retrieval-specific
        "retrieval", "document retrieval", "context retrieval"
    ]

    def __init__(self, output_dir: str = "data", api_token: Optional[str] = None):
        """Initialize fetcher."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()

        if api_token:
            self.session.headers.update({
                'Authorization': f'token {api_token}',
                'Accept': 'application/vnd.github.v3+json'
            })
        else:
            self.session.headers.update({
                'Accept': 'application/vnd.github.v3+json'
            })

    def fetch_top_repos(
        self,
        max_repos: int = 200,
        min_stars: int = 1000,
        created_after: Optional[str] = None
    ) -> List[GitHubRepo]:
        """
        Fetch top repos OVERALL by stars.

        This gives us:
        - Absolute rankings (e.g., "LangChain is #47 overall")
        - RAG market share (e.g., "8% of top 200 are RAG frameworks")
        - Trend tracking (ranking changes over time)

        Args:
            max_repos: How many top repos to fetch (recommended: 200-500)
            min_stars: Minimum stars to include (filters noise)
            created_after: Only repos created after this date (YYYY-MM-DD)

        Returns:
            List of all top repos with RAG classification
        """
        logger.info(f"📥 Fetching top {max_repos} GitHub repos (min {min_stars} stars)...")
        logger.info("   This provides ranking context for RAG framework market share")

        repos = []

        try:
            # Build search query
            query_parts = [f"stars:>{min_stars}"]

            if created_after:
                query_parts.append(f"created:>{created_after}")

            query = " ".join(query_parts)

            # Fetch repos with pagination
            per_page = 100
            max_pages = (max_repos // per_page) + 1

            for page in range(1, max_pages + 1):
                params = {
                    "q": query,
                    "sort": "stars",
                    "order": "desc",
                    "per_page": per_page,
                    "page": page
                }

                response = self.session.get(
                    f"{self.API_URL}/search/repositories",
                    params=params,
                    timeout=10
                )

                if response.status_code == 403:
                    logger.error("❌ GitHub API rate limit exceeded")
                    logger.info("   Set GITHUB_API_TOKEN in .env for higher limits")
                    break

                response.raise_for_status()
                data = response.json()

                if "items" not in data or not data["items"]:
                    break

                for repo_data in data["items"]:
                    if len(repos) >= max_repos:
                        break

                    repo = self._parse_repo(repo_data, ranking_position=len(repos) + 1)

                    if repo:
                        repos.append(repo)

                        rag_indicator = "🎯" if repo.is_rag_related else "  "
                        logger.info(
                            f"{rag_indicator} #{repo.ranking_position:3d} {repo.repo_name} "
                            f"({repo.stars:,}⭐)"
                        )

                if len(repos) >= max_repos:
                    break

            logger.info(f"\n✅ Fetched {len(repos)} repos")
            return repos

        except requests.RequestException as e:
            logger.error(f"❌ Failed to fetch repos: {e}")
            return []

    def _parse_repo(self, data: Dict, ranking_position: int) -> Optional[GitHubRepo]:
        """Parse repo data and classify if RAG-related."""
        try:
            repo_name = data.get("full_name", "")
            if not repo_name:
                return None

            owner = data.get("owner", {}).get("login", "")
            description = data.get("description", "")
            stars = data.get("stargazers_count", 0)
            forks = data.get("forks_count", 0)
            watchers = data.get("watchers_count", 0)
            open_issues = data.get("open_issues_count", 0)
            language = data.get("language", "")
            topics = data.get("topics", [])
            created_at = data.get("created_at", "")
            updated_at = data.get("updated_at", "")
            url = data.get("html_url", "")

            # Classify if RAG-related
            is_rag_related = self._is_rag_related(repo_name, description, topics)
            rag_category = self._get_rag_category(repo_name, description, topics) if is_rag_related else None

            # Generate ID
            repo_id = f"gh_repo_{repo_name.replace('/', '_')}"

            return GitHubRepo(
                id=repo_id,
                repo_name=repo_name,
                owner=owner,
                description=description,
                stars=stars,
                forks=forks,
                watchers=watchers,
                open_issues=open_issues,
                language=language,
                topics=topics,
                created_at=created_at,
                updated_at=updated_at,
                url=url,
                ranking_position=ranking_position,
                is_rag_related=is_rag_related,
                rag_category=rag_category
            )

        except Exception as e:
            logger.debug(f"Error parsing repo: {e}")
            return None

    def _is_rag_related(self, repo_name: str, description: str, topics: List[str]) -> bool:
        """Determine if repo is RAG/retrieval/embedding related (SPECIFIC, not general LLM)."""
        text = f"{repo_name} {description} {' '.join(topics)}".lower()

        # Check against all category keywords
        for category_repos in self.RAG_CATEGORIES.values():
            for keyword in category_repos:
                if keyword.lower() in text:
                    return True

        # Check specific RAG keywords
        for keyword in self.RAG_KEYWORDS:
            if keyword.lower() in text:
                return True

        # EXPLICITLY EXCLUDE general LLM tools (not RAG-specific)
        exclude_keywords = [
            "llm inference", "model training", "fine-tuning", "finetune",
            "model server", "llm server"
        ]

        for exclude in exclude_keywords:
            if exclude in text and not any(rag_kw in text for rag_kw in ["rag", "retrieval", "vector", "embedding"]):
                return False

        return False

    def _get_rag_category(self, repo_name: str, description: str, topics: List[str]) -> str:
        """Classify RAG repo into category."""
        text = f"{repo_name} {description} {' '.join(topics)}".lower()

        for category, keywords in self.RAG_CATEGORIES.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    return category

        return "other_rag"

    def save_repos(self, repos: List[GitHubRepo], filename: str = "github_repos.json"):
        """Save repos to JSON file."""
        filepath = self.output_dir / filename
        repos_dict = [asdict(repo) for repo in repos]

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(repos_dict, f, indent=2, ensure_ascii=False)

        logger.info(f"💾 Saved {len(repos)} repos to {filepath}")
        return filepath

    def analyze_market_share(self, repos: List[GitHubRepo]) -> Dict:
        """Analyze RAG framework market share and rankings."""
        total = len(repos)
        rag_repos = [r for r in repos if r.is_rag_related]

        # Category breakdown
        categories = {}
        for repo in rag_repos:
            cat = repo.rag_category or "unknown"
            categories[cat] = categories.get(cat, 0) + 1

        # Top RAG repos
        top_rag = sorted(rag_repos, key=lambda r: r.ranking_position)[:10]

        # Market share percentage
        market_share_pct = (len(rag_repos) / total * 100) if total > 0 else 0

        return {
            "total_repos": total,
            "rag_repos_count": len(rag_repos),
            "market_share_pct": market_share_pct,
            "categories": categories,
            "top_rag_repos": [
                {
                    "rank": r.ranking_position,
                    "name": r.repo_name,
                    "category": r.rag_category,
                    "stars": r.stars,
                    "language": r.language
                }
                for r in top_rag
            ]
        }


def main():
    """Main entry point for GitHub fetcher."""
    import os
    from dotenv import load_dotenv

    load_dotenv()

    api_token = os.getenv("GITHUB_API_TOKEN")
    if api_token:
        logger.info("✓ Using GitHub API token (5000 req/hour)")
    else:
        logger.info("⚠️  No GitHub API token (60 req/hour limit)")
        logger.info("   Set GITHUB_API_TOKEN in .env for higher limits")

    fetcher = GitHubFetcher(api_token=api_token)

    # Fetch top 200 repos overall
    # Filter: created in last 2 years (more relevant)
    two_years_ago = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

    repos = fetcher.fetch_top_repos(
        max_repos=200,
        min_stars=1000,
        created_after=two_years_ago
    )

    if repos:
        fetcher.save_repos(repos, "github_repos.json")

        # Analyze market share
        analysis = fetcher.analyze_market_share(repos)

        # Display results
        logger.info("\n" + "="*60)
        logger.info("📊 RAG/LLM FRAMEWORK MARKET SHARE ANALYSIS")
        logger.info("="*60)
        logger.info(f"Total repos analyzed: {analysis['total_repos']}")
        logger.info(f"RAG-related repos: {analysis['rag_repos_count']} ({analysis['market_share_pct']:.1f}%)")

        logger.info("\n📋 Category breakdown:")
        for category, count in sorted(analysis['categories'].items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {category}: {count}")

        logger.info("\n🏆 Top 10 RAG repos (by overall ranking):")
        for repo in analysis['top_rag_repos']:
            logger.info(f"  #{repo['rank']:3d} {repo['name']}")
            logger.info(f"       Category: {repo['category']} | Stars: {repo['stars']:,} | Lang: {repo['language']}")

        logger.info("="*60 + "\n")
        logger.info("✅ GitHub fetch complete!")
        logger.info("💡 This data shows RAG framework adoption vs overall GitHub ecosystem")
        logger.info("Next step: Run Supabase ingestion pipeline")
    else:
        logger.error("❌ No repos fetched.")


if __name__ == "__main__":
    main()
