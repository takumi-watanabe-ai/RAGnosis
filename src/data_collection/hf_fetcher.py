"""
HuggingFace models fetcher for RAG/LLM adoption signals.

Fetches TOP trending models to track RAG market share and ranking changes over time.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

import requests
from huggingface_hub import HfApi, ModelCard, ModelCardData

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class HFModel:
    """HuggingFace model data model with ranking context."""
    id: str
    model_name: str
    task: str
    downloads: int
    likes: int
    last_updated: Optional[str]
    description: str
    tags: List[str]
    author: str
    url: str
    ranking_position: int  # Position in overall top models
    is_rag_related: bool  # Whether this is RAG/embedding/LLM related
    rag_category: Optional[str]  # "embedding", "llm", "rag_tool", etc.
    source: str = "huggingface"
    scraped_at: str = datetime.now().isoformat()


class HFModelFetcher:
    """Fetcher for HuggingFace model market share and ranking."""

    API_URL = "https://huggingface.co/api/models"

    # RAG-related tags (for classification, not filtering)
    RAG_TAGS = {
        "embedding": ["feature-extraction", "sentence-similarity", "embeddings"],
        "generation": ["text-generation", "text2text-generation"],
        "rag_tool": ["rag", "retrieval"],
        "reranking": ["text-ranking", "reranker"],  # Verified from research
    }

    # All relevant tags (for identifying RAG-related models)
    ALL_RAG_TAGS = [
        "feature-extraction", "sentence-similarity", "embeddings",
        "rag", "retrieval", "sentence-transformers",
        "text-ranking", "reranker"  # Reranking models (verified from BAAI/bge-reranker, mixedbread-ai)
    ]

    def __init__(self, output_dir: str = "data", api_token: Optional[str] = None):
        """Initialize fetcher."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.api_token = api_token
        self.hf_api = HfApi(token=api_token)

    def fetch_top_models(
        self,
        max_models: int = 200,
        sort_by: str = "downloads"
    ) -> List[HFModel]:
        """
        Fetch top models OVERALL (not filtered).

        This gives us:
        - Absolute rankings (e.g., "model X is #47 overall")
        - RAG market share (e.g., "12% of top 200 are RAG models")
        - Trend tracking (ranking changes over time)

        Args:
            max_models: How many top models to fetch (recommended: 200-500)
            sort_by: 'downloads' (most popular), 'likes' (most liked),
                     or 'lastModified' (recently updated)

        Returns:
            List of all top models with RAG classification
        """
        logger.info(f"📥 Fetching top {max_models} models (sort: {sort_by})...")
        logger.info("   This provides ranking context for RAG market share analysis")

        models = []

        try:
            # Use HuggingFace Hub API to fetch models with full metadata
            logger.info("   Using HuggingFace Hub API for richer model data...")

            model_infos = list(self.hf_api.list_models(
                sort=sort_by,
                direction=-1,
                limit=max_models,
                full=True,  # Get full model info including card data
            ))

            logger.info(f"   Fetched {len(model_infos)} models from Hub API")

            for idx, model_info in enumerate(model_infos):
                if len(models) >= max_models:
                    break

                model = self._parse_model_info(model_info, ranking_position=idx + 1)

                if model and self._is_valid_model(model):
                    models.append(model)

                    rag_indicator = "🎯" if model.is_rag_related else "  "
                    logger.info(
                        f"{rag_indicator} #{model.ranking_position:3d} {model.model_name} "
                        f"({model.downloads:,} downloads)"
                    )

            logger.info(f"\n✅ Fetched {len(models)} models")
            return models

        except Exception as e:
            logger.error(f"❌ Failed to fetch models: {e}")
            return []

    def _fetch_model_description(self, model_id: str) -> str:
        """Fetch model description from model card."""
        try:
            # Try to get description from card_data first (faster)
            card = ModelCard.load(model_id)

            # Try card_data summary or base_model
            if card.data:
                # Check for common description fields
                if hasattr(card.data, 'summary') and card.data.summary:
                    return card.data.summary
                if hasattr(card.data, 'description') and card.data.description:
                    return card.data.description

            # Fall back to extracting first paragraph from README
            if card.text:
                # Get first meaningful paragraph (skip headers, skip empty lines)
                lines = card.text.split('\n')
                description_lines = []
                for line in lines:
                    line = line.strip()
                    # Skip markdown headers, yaml frontmatter, empty lines
                    if line and not line.startswith('#') and not line.startswith('---'):
                        description_lines.append(line)
                        # Get first ~200 chars of meaningful content
                        if len(' '.join(description_lines)) > 200:
                            break

                if description_lines:
                    return ' '.join(description_lines)[:500]  # Limit length

            return ""

        except Exception as e:
            logger.debug(f"Could not fetch description for {model_id}: {e}")
            return ""

    def _parse_model_info(self, model_info, ranking_position: int) -> Optional[HFModel]:
        """Parse ModelInfo object from Hub API and classify if RAG-related."""
        try:
            model_name = model_info.id
            if not model_name:
                return None

            # Extract metadata from ModelInfo
            downloads = getattr(model_info, 'downloads', 0) or 0
            likes = getattr(model_info, 'likes', 0) or 0
            last_updated = getattr(model_info, 'lastModified', None)
            if last_updated:
                last_updated = last_updated.isoformat() if hasattr(last_updated, 'isoformat') else str(last_updated)

            # Extract tags
            tags = getattr(model_info, 'tags', []) or []
            tags = [str(t) for t in tags if t]

            # Extract task
            task = getattr(model_info, 'pipeline_tag', 'unknown') or 'unknown'
            if task == 'unknown':
                # Try to infer from tags
                for tag in tags:
                    if tag in self.ALL_RAG_TAGS:
                        task = tag
                        break

            # Skip description fetch during pipeline (optimization - will fetch during embedding)
            # Description is extracted from full model card during embedding phase
            description = ""

            # Classify if RAG-related (using tags/task only, no description needed for most cases)
            is_rag_related = self._is_rag_related(tags, task, model_name, description)
            rag_category = self._get_rag_category(tags, task) if is_rag_related else None

            # Extract author
            author = getattr(model_info, 'author', None) or (model_name.split("/")[0] if "/" in model_name else "unknown")

            # Generate URL and ID
            url = f"https://huggingface.co/{model_name}"
            model_id = f"hf_model_{model_name.replace('/', '_')}"

            return HFModel(
                id=model_id,
                model_name=model_name,
                task=task,
                downloads=downloads,
                likes=likes,
                last_updated=last_updated,
                description=description,
                tags=tags,
                author=author,
                url=url,
                ranking_position=ranking_position,
                is_rag_related=is_rag_related,
                rag_category=rag_category
            )

        except Exception as e:
            logger.debug(f"Error parsing model: {e}")
            return None

    def _is_rag_related(self, tags: List[str], task: str, name: str, description: str) -> bool:
        """Determine if model is RAG/embedding/retrieval related."""
        # Check tags
        for tag in tags:
            if tag.lower() in [t.lower() for t in self.ALL_RAG_TAGS]:
                return True

        # Check task
        if task.lower() in [t.lower() for t in self.ALL_RAG_TAGS]:
            return True

        # Check name/description for SPECIFIC RAG keywords
        text = f"{name} {description}".lower()
        specific_rag_keywords = [
            "rag", "retrieval augmented", "retrieval-augmented",
            "embedding", "sentence-transformers", "sentence transformers",
            "vector search", "semantic search",
            "langchain", "llamaindex", "haystack",
            "rerank", "reranker", "reranking",  # Verified from BAAI/bge-reranker, mixedbread-ai
            "cross-encoder", "text-ranking"  # Verified from cross-encoder/ms-marco models
        ]

        return any(keyword in text for keyword in specific_rag_keywords)

    def _get_rag_category(self, tags: List[str], task: str) -> Optional[str]:
        """Classify RAG model into category."""
        for category, category_tags in self.RAG_TAGS.items():
            if task in category_tags or any(tag in category_tags for tag in tags):
                return category
        return "other_rag"

    def _is_valid_model(self, model: HFModel) -> bool:
        """Basic quality filter (very permissive since we want all top models)."""
        # Only filter obvious junk
        if model.downloads < 10:
            return False
        return True

    def save_models(self, models: List[HFModel], filename: str = "hf_models.json"):
        """Save models to JSON file."""
        filepath = self.output_dir / filename
        models_dict = [asdict(model) for model in models]

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(models_dict, f, indent=2, ensure_ascii=False)

        logger.info(f"💾 Saved {len(models)} models to {filepath}")
        return filepath

    def analyze_market_share(self, models: List[HFModel]) -> Dict:
        """Analyze RAG market share and rankings."""
        total = len(models)
        rag_models = [m for m in models if m.is_rag_related]

        # Category breakdown
        categories = {}
        for model in rag_models:
            cat = model.rag_category or "unknown"
            categories[cat] = categories.get(cat, 0) + 1

        # Top RAG models
        top_rag = sorted(rag_models, key=lambda m: m.ranking_position)[:10]

        # Market share percentage
        market_share_pct = (len(rag_models) / total * 100) if total > 0 else 0

        return {
            "total_models": total,
            "rag_models_count": len(rag_models),
            "market_share_pct": market_share_pct,
            "categories": categories,
            "top_rag_models": [
                {
                    "rank": m.ranking_position,
                    "name": m.model_name,
                    "category": m.rag_category,
                    "downloads": m.downloads
                }
                for m in top_rag
            ]
        }


def main():
    """Main entry point for HF fetcher (for testing only - use pipeline.py for production)."""
    import os
    from dotenv import load_dotenv

    load_dotenv()

    api_token = os.getenv("HUGGINGFACE_API_KEY")
    if api_token:
        logger.info("✓ Using HuggingFace API token")
    else:
        logger.info("⚠️  No HF API token found (rate limits may apply)")

    fetcher = HFModelFetcher(api_token=api_token)
    models = fetcher.fetch_top_models(max_models=200, sort_by="downloads")

    if models:
        analysis = fetcher.analyze_market_share(models)

        # Display results
        logger.info("\n" + "="*60)
        logger.info("📊 RAG/LLM MARKET SHARE ANALYSIS")
        logger.info("="*60)
        logger.info(f"Total models analyzed: {analysis['total_models']}")
        logger.info(f"RAG-related models: {analysis['rag_models_count']} ({analysis['market_share_pct']:.1f}%)")

        logger.info("\n📋 Category breakdown:")
        for category, count in sorted(analysis['categories'].items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {category}: {count}")

        logger.info("\n🏆 Top 10 RAG models (by overall ranking):")
        for model in analysis['top_rag_models']:
            logger.info(f"  #{model['rank']:3d} {model['name']}")
            logger.info(f"       Category: {model['category']} | Downloads: {model['downloads']:,}")

        logger.info("="*60 + "\n")
        logger.info("✅ Fetch complete! Use pipeline.py to insert to database.")
    else:
        logger.error("❌ No models fetched.")


if __name__ == "__main__":
    main()
