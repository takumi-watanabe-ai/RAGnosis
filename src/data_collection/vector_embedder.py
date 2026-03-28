"""
Unified vector embedding pipeline for RAGnosis.

Embeds HF models, GitHub repos, and blog articles into a single documents table.
"""

import json
import logging
import os
from datetime import date
from pathlib import Path
from typing import List, Dict, Set
from dotenv import load_dotenv

from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Load config for embedding model
CONFIG_PATH = (
    Path(__file__).parent.parent.parent
    / "supabase"
    / "functions"
    / "_shared"
    / "config.json"
)
with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)


class UnifiedVectorEmbedder:
    """Creates and manages vector embeddings for all document types in unified table."""

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        documents_table: str = "documents",
        embedding_model: str = None,
    ):
        """Initialize unified vector embedder."""
        logger.info("🚀 Initializing Unified Vector Embedder...")

        # Use config value if not provided
        if embedding_model is None:
            embedding_model = CONFIG["embedding"]["model_python"]

        # Initialize Supabase client
        self.client: Client = create_client(supabase_url, supabase_key)
        self.documents_table = documents_table

        # Initialize embedding model
        logger.info(f"📦 Loading embedding model: {embedding_model}")
        self.embedder = SentenceTransformer(embedding_model)
        self.embedding_dim = self.embedder.get_sentence_embedding_dimension()
        logger.info(f"   Embedding dimension: {self.embedding_dim}")

        # Verify dimension matches config
        expected_dim = CONFIG["embedding"]["dimensions"]
        if self.embedding_dim != expected_dim:
            raise ValueError(
                f"Embedding dimension mismatch: got {self.embedding_dim}, expected {expected_dim}"
            )

        logger.info(f"✅ Unified vector embedder initialized")

    def _chunk_text(self, text: str, chunk_size: int = 1800, overlap: int = 300) -> List[str]:
        """
        Chunk text into overlapping segments.

        Args:
            text: Text to chunk
            chunk_size: Target chunk size in characters (~450 tokens, leaves room for prefix)
            overlap: Overlap between chunks (16.7% for semantic continuity)

        Returns:
            List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at paragraph boundary
            if end < len(text):
                # Look for paragraph break within last 20% of chunk
                search_start = end - int(chunk_size * 0.2)
                para_break = text.rfind('\n\n', search_start, end)

                if para_break != -1:
                    end = para_break + 2  # Include newlines
                else:
                    # Fall back to sentence boundary
                    sent_break = text.rfind('. ', search_start, end)
                    if sent_break != -1:
                        end = sent_break + 2

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Move to next chunk with overlap
            start = end - overlap if end < len(text) else end

        return chunks

    def get_existing_ids(self) -> Set[str]:
        """Get all existing IDs from documents table to avoid duplicates."""
        logger.info(f"🔍 Checking existing entries in {self.documents_table}...")

        try:
            response = self.client.table(self.documents_table).select("id").execute()
            existing_ids = {row["id"] for row in response.data}
            logger.info(f"   Found {len(existing_ids)} existing documents")
            return existing_ids

        except Exception as e:
            logger.warning(f"⚠️  Could not fetch IDs: {e}")
            return set()

    def fetch_models_from_sql(self, snapshot_date: str = None) -> List[Dict]:
        """Fetch RAG-related models from time-series table."""
        if snapshot_date is None:
            snapshot_date = date.today().isoformat()

        logger.info(f"📂 Fetching models from hf_models (snapshot_date: {snapshot_date})...")

        try:
            response = (
                self.client.table("hf_models")
                .select("*")
                .eq("snapshot_date", snapshot_date)
                .eq("is_rag_related", True)
                .execute()
            )

            models = response.data
            logger.info(f"   Found {len(models)} RAG-related models")
            return models

        except Exception as e:
            logger.error(f"❌ Failed to fetch models: {e}")
            return []

    def fetch_repos_from_sql(self, snapshot_date: str = None) -> List[Dict]:
        """Fetch RAG-related repos from time-series table."""
        if snapshot_date is None:
            snapshot_date = date.today().isoformat()

        logger.info(f"📂 Fetching repos from github_repos (snapshot_date: {snapshot_date})...")

        try:
            response = (
                self.client.table("github_repos")
                .select("*")
                .eq("snapshot_date", snapshot_date)
                .eq("is_rag_related", True)
                .execute()
            )

            repos = response.data
            logger.info(f"   Found {len(repos)} RAG-related repos")
            return repos

        except Exception as e:
            logger.error(f"❌ Failed to fetch repos: {e}")
            return []

    def fetch_articles_from_sql(self) -> List[Dict]:
        """Fetch blog articles from source table."""
        logger.info(f"📂 Fetching articles from blog_articles...")

        try:
            response = self.client.table("blog_articles").select("*").execute()
            articles = response.data
            logger.info(f"   Found {len(articles)} articles")
            return articles

        except Exception as e:
            logger.error(f"❌ Failed to fetch articles: {e}")
            return []

    def prepare_documents(
        self, models: List[Dict], repos: List[Dict], articles: List[Dict], existing_ids: Set[str]
    ) -> List[Dict]:
        """
        Prepare all documents for embedding.
        - NEW documents: Create fresh embeddings
        - EXISTING models/repos: Re-embed if metadata changed (downloads/stars)
        - EXISTING articles: Skip (don't change)

        Returns list of documents with unified schema.
        """
        logger.info("\n🔄 Preparing documents for embedding...")

        documents = []
        updated_count = 0

        # Process models (always re-embed to get latest metadata)
        for model in models:
            model_id = model["id"]

            # Always process models from latest snapshot (they're small, ~40 total)
            # This ensures download counts and popularity rankings stay current
            if model_id in existing_ids:
                updated_count += 1

            doc = {
                "id": model_id,
                "name": model["model_name"],
                "description": model.get("description", ""),
                "url": model["url"],
                "doc_type": "hf_model",
                "rag_category": model.get("rag_category"),
                "topics": model.get("tags", []),  # HF tags → topics
                # Metadata
                "downloads": model.get("downloads"),
                "likes": model.get("likes"),
                "ranking_position": model.get("ranking_position"),
                "author": model.get("author"),
                "task": model.get("task"),  # NEW: task field
                "snapshot_date": model.get("snapshot_date"),
            }
            documents.append(doc)

        # Process repos (always re-embed to get latest metadata)
        for repo in repos:
            repo_id = repo["id"]

            # Always process repos from latest snapshot (they're small, ~20 total)
            # This ensures star counts and popularity rankings stay current
            if repo_id in existing_ids:
                updated_count += 1

            doc = {
                "id": repo_id,
                "name": repo["repo_name"],
                "description": repo.get("description", ""),
                "url": repo["url"],
                "doc_type": "github_repo",
                "rag_category": repo.get("rag_category"),
                "topics": repo.get("topics", []),  # GitHub topics
                # Metadata
                "stars": repo.get("stars"),
                "forks": repo.get("forks"),
                "ranking_position": repo.get("ranking_position"),
                "owner": repo.get("owner"),
                "language": repo.get("language"),
                "snapshot_date": repo.get("snapshot_date"),
            }
            documents.append(doc)

        # Process blog articles with conditional chunking
        CHUNK_THRESHOLD = 2000  # Only chunk if exceeds single chunk size

        for article in articles:
            article_id = article["id"]

            if article_id in existing_ids:
                logger.debug(f"   Skipping existing article: {article_id}")
                continue

            full_content = article.get("content", "")
            title = article["title"]

            # Conditional chunking based on content length
            if len(full_content) <= CHUNK_THRESHOLD:
                # Short article: single document
                doc = {
                    "id": article_id,
                    "parent_id": None,
                    "chunk_index": 0,
                    "name": title,
                    "description": full_content,
                    "url": article["url"],
                    "doc_type": "blog_article",
                    "rag_category": None,  # Blogs don't have rag_category
                    "topics": article.get("rag_topics", []),  # rag_topics → topics
                    # Content metadata
                    "published_at": article.get("published_at"),
                    "content_source": article.get("source"),  # source → content_source
                    "scrape_method": article.get("scrape_method"),
                }
                documents.append(doc)
            else:
                # Long article: chunk it
                chunks = self._chunk_text(full_content, chunk_size=1800, overlap=300)
                logger.debug(f"   Chunking article '{title[:50]}' into {len(chunks)} chunks")

                for i, chunk in enumerate(chunks):
                    doc = {
                        "id": f"{article_id}_chunk_{i}",
                        "parent_id": article_id,
                        "chunk_index": i,
                        "name": f"{title} (part {i+1}/{len(chunks)})",
                        "description": chunk,
                        "url": article["url"],
                        "doc_type": "blog_article",
                        "rag_category": None,
                        "topics": article.get("rag_topics", []),
                        # Content metadata
                        "published_at": article.get("published_at"),
                        "content_source": article.get("source"),
                        "scrape_method": article.get("scrape_method"),
                    }
                    documents.append(doc)

        new_count = len(documents) - updated_count
        logger.info(f"✅ Prepared {len(documents)} documents for embedding")
        logger.info(f"   - New: {new_count}")
        logger.info(f"   - Updated (metadata refresh): {updated_count}")
        logger.info(f"   - Skipped articles: {len(articles) - sum(1 for d in documents if d['doc_type'] == 'blog_article')}")

        return documents

    def _create_embedding_text(self, doc: Dict) -> str:
        """
        Create rich, semantic text for embedding based on document type.
        Uses natural language descriptions (no numbers, no labels).
        """
        doc_type = doc['doc_type']

        if doc_type == 'hf_model':
            parts = [doc['name']]

            # Add name with slashes replaced for better tokenization
            # "Supabase/gte-small" → "Supabase gte-small" (keep technical identifiers intact)
            if '/' in doc['name']:
                parts.append(doc['name'].replace('/', ' '))

            # Add semantic popularity signal
            if doc.get('downloads'):
                downloads = doc['downloads']
                if downloads > 100_000_000:
                    parts.append("Extremely popular and widely used model")
                    parts.append("Most downloaded in its category")
                elif downloads > 10_000_000:
                    parts.append("Very popular model")
                    parts.append("Used in many production systems")
                elif downloads > 1_000_000:
                    parts.append("Popular model with active usage")

            # Add semantic category description
            if doc.get('rag_category') == 'embedding':
                parts.append("Embedding model for semantic search")
                parts.append("Converts text to dense vector representations")
            elif doc.get('rag_category') == 'reranking':
                parts.append("Reranking model for improving search results")
                parts.append("Used for cross-encoder reranking")

            # Add semantic task description
            if doc.get('task'):
                task = doc['task']
                if 'feature-extraction' in task or 'sentence-similarity' in task:
                    parts.append("Sentence embedding and similarity matching")
                elif 'text-generation' in task:
                    parts.append("Text generation and language modeling")

            # Add description (already semantic)
            if doc.get('description'):
                parts.append(doc['description'])

            return "\n".join(parts)

        elif doc_type == 'github_repo':
            parts = [doc['name']]

            # Add name with slashes replaced for better tokenization
            # "langflow-ai/langflow" → "langflow-ai langflow" (keep org names intact)
            if '/' in doc['name']:
                parts.append(doc['name'].replace('/', ' '))

            # Add semantic popularity signal
            if doc.get('stars'):
                stars = doc['stars']
                if stars > 100_000:
                    parts.append("Extremely popular and widely adopted repository")
                    parts.append("Top open source project")
                elif stars > 50_000:
                    parts.append("Highly popular repository")
                    parts.append("Widely used in production")
                elif stars > 10_000:
                    parts.append("Popular repository with active community")
                elif stars > 1_000:
                    parts.append("Established repository with good adoption")

            # Add semantic category description
            if doc.get('rag_category'):
                category = doc['rag_category']
                if category == 'rag_tool' or category == 'rag_framework':
                    parts.append("RAG framework for building AI applications")
                    parts.append("Provides tools for retrieval-augmented generation")
                elif category == 'vector_db':
                    parts.append("Vector database for similarity search")
                    parts.append("Stores and queries embeddings")
                elif category == 'agent_framework':
                    parts.append("Agent framework for autonomous AI systems")
                    parts.append("Builds AI agents with tools and memory")

            # Add language context (if relevant)
            if doc.get('language'):
                lang = doc['language']
                if lang in ['Python', 'TypeScript', 'JavaScript']:
                    parts.append(f"{lang} implementation")

            # Add description (already semantic)
            if doc.get('description'):
                parts.append(doc['description'])

            return "\n".join(parts)

        else:
            # For blog articles and other types, use natural format
            parts = [doc['name']]
            if doc.get('description'):
                parts.append(doc['description'])
            return "\n".join(parts)

    def generate_embeddings(self, documents: List[Dict]) -> List[Dict]:
        """Generate embeddings for all documents."""
        if not documents:
            logger.info("⏭️  No new documents to embed")
            return []

        logger.info(f"\n🧮 Generating embeddings for {len(documents)} documents...")

        # Create rich text for embedding based on doc type
        texts = []
        for doc in documents:
            text = self._create_embedding_text(doc)
            texts.append(text)

        # Generate embeddings in batches
        batch_size = 32
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings = self.embedder.encode(
                batch, show_progress_bar=False, convert_to_numpy=True
            )
            all_embeddings.extend(embeddings)

            if (i // batch_size + 1) % 10 == 0:
                logger.info(f"  Processed {i + len(batch)}/{len(texts)} documents")

        # Attach embeddings to documents
        for doc, embedding in zip(documents, all_embeddings):
            doc["embedding"] = embedding.tolist()

        logger.info(f"✅ Generated {len(all_embeddings)} embeddings")
        return documents

    def upsert_documents(self, documents: List[Dict]):
        """Upsert documents to unified table."""
        if not documents:
            logger.info("⏭️  No documents to upsert")
            return

        logger.info(f"\n⬆️  Upserting {len(documents)} documents to {self.documents_table}...")

        rows = []
        for doc in documents:
            # Create rich text with metadata for search
            rich_text = self._create_embedding_text(doc)

            row = {
                "id": doc["id"],
                "name": doc["name"],
                "description": doc.get("description", ""),
                "url": doc["url"],
                "doc_type": doc["doc_type"],
                "rag_category": doc.get("rag_category"),
                "topics": doc.get("topics", []),
                "text": rich_text,
                "embedding": doc["embedding"],
                "snapshot_date": doc.get("snapshot_date"),
                # Metrics
                "downloads": doc.get("downloads"),
                "stars": doc.get("stars"),
                "likes": doc.get("likes"),
                "forks": doc.get("forks"),
                "ranking_position": doc.get("ranking_position"),
                # Creators
                "author": doc.get("author"),
                "owner": doc.get("owner"),
                # Technical
                "language": doc.get("language"),
                "task": doc.get("task"),
                # Content metadata
                "published_at": doc.get("published_at"),
                "content_source": doc.get("content_source"),
                "scrape_method": doc.get("scrape_method"),
                # Chunking
                "parent_id": doc.get("parent_id"),
                "chunk_index": doc.get("chunk_index", 0),
            }
            rows.append(row)

        # Upload in batches
        batch_size = 100
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]

            try:
                self.client.table(self.documents_table).upsert(batch).execute()

                if (i // batch_size + 1) % 5 == 0:
                    logger.info(f"  Uploaded {i + len(batch)}/{len(rows)} documents")

            except Exception as e:
                logger.error(f"❌ Failed to upload batch {i // batch_size + 1}: {e}")
                # Continue with next batch

        logger.info(f"✅ Successfully upserted {len(rows)} documents")

    def run_pipeline(self, snapshot_date: str = None):
        """
        Run the complete unified embedding pipeline.

        Workflow:
        1. Fetch RAG-related models/repos from time-series tables (latest snapshot)
        2. Check existing IDs in documents table
        3. Only fetch blog articles if they don't have embeddings yet
        4. Generate embeddings for NEW documents only
        5. Upsert to unified documents table

        Args:
            snapshot_date: Date to fetch data for (default: today - ensures we only run if data was collected today)
        """
        logger.info("\n" + "=" * 60)
        logger.info("🚀 STARTING UNIFIED VECTOR EMBEDDING PIPELINE")
        logger.info("=" * 60 + "\n")

        if snapshot_date is None:
            snapshot_date = date.today().isoformat()
            logger.info(f"📅 Using today's snapshot date: {snapshot_date} (no update if data not collected)")

        try:
            # Step 1: Get existing IDs from documents table
            existing_ids = self.get_existing_ids()

            # Step 2: Fetch data from source tables
            logger.info(f"\n📂 STEP 1: Fetching data from source tables (date: {snapshot_date})...")
            models = self.fetch_models_from_sql(snapshot_date)
            repos = self.fetch_repos_from_sql(snapshot_date)

            # Check if we need to fetch articles (only if none exist in documents table)
            articles_exist = any(
                doc_id.startswith('blog_') or 'chunk' in doc_id
                for doc_id in existing_ids
            )

            if articles_exist:
                logger.info("⏭️  Skipping blog articles (already embedded)")
                articles = []
            else:
                logger.info("📰 Fetching blog articles (first time embedding)")
                articles = self.fetch_articles_from_sql()

            # Step 3: Prepare documents (filter out existing)
            logger.info("\n🔄 STEP 2: Preparing documents...")
            documents = self.prepare_documents(models, repos, articles, existing_ids)

            if not documents:
                logger.info("\n✅ No new documents to embed (all entries already exist)")
                logger.info("=" * 60 + "\n")
                return

            # Step 4: Generate embeddings
            logger.info("\n🧮 STEP 3: Generating embeddings...")
            documents_with_embeddings = self.generate_embeddings(documents)

            # Step 5: Upsert to documents table
            logger.info("\n⬆️  STEP 4: Upserting to documents table...")
            self.upsert_documents(documents_with_embeddings)

            # Success summary
            logger.info("\n" + "=" * 60)
            logger.info("✅ UNIFIED VECTOR EMBEDDING PIPELINE COMPLETED")
            logger.info("=" * 60)
            logger.info(f"📊 Summary:")
            logger.info(
                f"   - Processed {len(models)} models + {len(repos)} repos + {len(articles)} articles"
            )
            logger.info(f"   - Created {len(documents_with_embeddings)} new embeddings")
            logger.info(
                f"   - Skipped {len(models) + len(repos) + len(articles) - len(documents_with_embeddings)} existing entries"
            )
            logger.info(f"   - Total in documents table: {len(existing_ids) + len(documents_with_embeddings)}")
            logger.info("=" * 60 + "\n")

        except Exception as e:
            logger.error(f"\n❌ Pipeline failed: {e}")
            raise


def main():
    """Main entry point for unified vector embedding pipeline."""
    # Load environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    documents_table = os.getenv("SUPABASE_TABLE", "documents")

    if not supabase_url or not supabase_key:
        logger.error("❌ Missing Supabase credentials in .env file")
        logger.error("   Please set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        return

    # Initialize and run pipeline
    embedder = UnifiedVectorEmbedder(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        documents_table=documents_table,
    )

    # Run for today's snapshot (or specify a date)
    embedder.run_pipeline()


if __name__ == "__main__":
    main()
