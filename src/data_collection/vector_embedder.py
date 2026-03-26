"""
Vector embedding script for RAGnosis.

Fetches RAG-related models/repos from traditional DB and creates embeddings
for vector search. Only embeds NEW entries to avoid duplicates.
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


class VectorEmbedder:
    """Creates and manages vector embeddings for RAG-related models and repos."""

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        vector_table: str = "ragnosis_docs",
        embedding_model: str = None,
    ):
        """Initialize vector embedder."""
        logger.info("🚀 Initializing Vector Embedder...")

        # Use config value if not provided
        if embedding_model is None:
            embedding_model = CONFIG["embedding"]["model_python"]

        # Initialize Supabase client
        self.client: Client = create_client(supabase_url, supabase_key)
        self.vector_table = vector_table

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

        logger.info(f"✅ Vector embedder initialized")

    def get_existing_ids(self) -> Set[str]:
        """Get all existing IDs from vector database to avoid duplicates."""
        logger.info(f"🔍 Checking existing entries in {self.vector_table}...")

        try:
            # Query all IDs from vector table
            response = self.client.table(self.vector_table).select("id").execute()
            existing_ids = {row["id"] for row in response.data}

            logger.info(f"   Found {len(existing_ids)} existing entries in vector DB")
            return existing_ids

        except Exception as e:
            logger.warning(f"⚠️  Could not fetch existing IDs: {e}")
            logger.warning("   Proceeding without deduplication check")
            return set()

    def fetch_models_from_sql(self, snapshot_date: str = None) -> List[Dict]:
        """Fetch RAG-related models from traditional DB."""
        if snapshot_date is None:
            snapshot_date = date.today().isoformat()

        logger.info(f"📂 Fetching models from hf_models (snapshot_date: {snapshot_date})...")

        try:
            response = (
                self.client.table("hf_models")
                .select("*")
                .eq("snapshot_date", snapshot_date)
                .eq("is_rag_related", True)  # Only RAG-related
                .execute()
            )

            models = response.data
            logger.info(f"   Found {len(models)} RAG-related models")
            return models

        except Exception as e:
            logger.error(f"❌ Failed to fetch models: {e}")
            return []

    def fetch_repos_from_sql(self, snapshot_date: str = None) -> List[Dict]:
        """Fetch RAG-related repos from traditional DB."""
        if snapshot_date is None:
            snapshot_date = date.today().isoformat()

        logger.info(f"📂 Fetching repos from github_repos (snapshot_date: {snapshot_date})...")

        try:
            response = (
                self.client.table("github_repos")
                .select("*")
                .eq("snapshot_date", snapshot_date)
                .eq("is_rag_related", True)  # Only RAG-related
                .execute()
            )

            repos = response.data
            logger.info(f"   Found {len(repos)} RAG-related repos")
            return repos

        except Exception as e:
            logger.error(f"❌ Failed to fetch repos: {e}")
            return []

    def prepare_embedding_data(
        self, models: List[Dict], repos: List[Dict], existing_ids: Set[str]
    ) -> List[Dict]:
        """
        Prepare data for embedding, filtering out existing entries.

        Returns list of items with:
        - id, name, description, doc_type, url, is_rag_related, rag_category
        """
        logger.info("\n🔄 Preparing embedding data...")

        items = []

        # Process models
        for model in models:
            model_id = model["id"]

            # Skip if already exists in vector DB
            if model_id in existing_ids:
                logger.debug(f"   Skipping existing model: {model_id}")
                continue

            # Prepare item
            item = {
                "id": model_id,
                "name": model["model_name"],
                "description": model.get("description", ""),
                "doc_type": "hf_model",
                "url": model["url"],
                "is_rag_related": model.get("is_rag_related", True),
                "rag_category": model.get("rag_category"),
            }
            items.append(item)

        # Process repos
        for repo in repos:
            repo_id = repo["id"]

            # Skip if already exists in vector DB
            if repo_id in existing_ids:
                logger.debug(f"   Skipping existing repo: {repo_id}")
                continue

            # Prepare item
            item = {
                "id": repo_id,
                "name": repo["repo_name"],
                "description": repo.get("description", ""),
                "doc_type": "github_repo",
                "url": repo["url"],
                "is_rag_related": repo.get("is_rag_related", True),
                "rag_category": repo.get("rag_category"),
            }
            items.append(item)

        logger.info(f"✅ Prepared {len(items)} NEW items for embedding")
        logger.info(f"   (Skipped {len(models) + len(repos) - len(items)} existing entries)")

        return items

    def generate_embeddings(self, items: List[Dict]) -> List[Dict]:
        """Generate embeddings for items."""
        if not items:
            logger.info("⏭️  No new items to embed")
            return []

        logger.info(f"\n🧮 Generating embeddings for {len(items)} items...")

        # Combine name + description for embedding
        texts = []
        for item in items:
            # Format: "Name: <name>\nDescription: <description>"
            text = f"Name: {item['name']}\nDescription: {item['description']}"
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
                logger.info(f"  Processed {i + len(batch)}/{len(texts)} items")

        # Attach embeddings to items
        for item, embedding in zip(items, all_embeddings):
            item["embedding"] = embedding.tolist()

        logger.info(f"✅ Generated {len(all_embeddings)} embeddings")
        return items

    def upsert_to_vector_db(self, items: List[Dict]):
        """Upsert items to vector database."""
        if not items:
            logger.info("⏭️  No items to upsert")
            return

        logger.info(f"\n⬆️  Upserting {len(items)} items to {self.vector_table}...")

        # Prepare rows for vector DB (using dedicated columns)
        rows = []
        for item in items:
            # Create preview text (name + description snippet)
            description_preview = item["description"][:200] if item["description"] else ""
            preview_text = f"{item['name']}: {description_preview}" if description_preview else item['name']

            row = {
                "id": item["id"],
                "name": item["name"],
                "description": item.get("description", ""),
                "url": item["url"],
                "doc_type": item["doc_type"],
                "rag_category": item.get("rag_category"),
                "text": preview_text,
                "embedding": item["embedding"],
            }
            rows.append(row)

        # Upload in batches
        batch_size = 100
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]

            try:
                self.client.table(self.vector_table).upsert(batch).execute()

                if (i // batch_size + 1) % 5 == 0:
                    logger.info(f"  Uploaded {i + len(batch)}/{len(rows)} rows")

            except Exception as e:
                logger.error(f"❌ Failed to upload batch {i // batch_size + 1}: {e}")
                # Continue with next batch

        logger.info(f"✅ Successfully upserted {len(rows)} items to vector DB")

    def run_embedding_pipeline(self, snapshot_date: str = None):
        """
        Run the complete vector embedding pipeline.

        Workflow:
        1. Fetch RAG-related models/repos from SQL (today's snapshot)
        2. Check existing IDs in vector DB
        3. Filter out duplicates
        4. Generate embeddings for NEW items only
        5. Upsert to vector DB
        """
        logger.info("\n" + "=" * 60)
        logger.info("🚀 STARTING VECTOR EMBEDDING PIPELINE")
        logger.info("=" * 60 + "\n")

        if snapshot_date is None:
            snapshot_date = date.today().isoformat()

        try:
            # Step 1: Get existing IDs from vector DB (for deduplication)
            existing_ids = self.get_existing_ids()

            # Step 2: Fetch RAG-related data from SQL
            logger.info(f"\n📂 STEP 1: Fetching data from SQL (date: {snapshot_date})...")
            models = self.fetch_models_from_sql(snapshot_date)
            repos = self.fetch_repos_from_sql(snapshot_date)

            # Step 3: Prepare data (filter out existing)
            logger.info("\n🔄 STEP 2: Filtering new entries...")
            items = self.prepare_embedding_data(models, repos, existing_ids)

            if not items:
                logger.info("\n✅ No new items to embed (all entries already exist)")
                logger.info("=" * 60 + "\n")
                return

            # Step 4: Generate embeddings
            logger.info("\n🧮 STEP 3: Generating embeddings...")
            items_with_embeddings = self.generate_embeddings(items)

            # Step 5: Upsert to vector DB
            logger.info("\n⬆️  STEP 4: Upserting to vector database...")
            self.upsert_to_vector_db(items_with_embeddings)

            # Success summary
            logger.info("\n" + "=" * 60)
            logger.info("✅ VECTOR EMBEDDING PIPELINE COMPLETED SUCCESSFULLY")
            logger.info("=" * 60)
            logger.info(f"📊 Summary:")
            logger.info(f"   - Processed {len(models)} models + {len(repos)} repos")
            logger.info(f"   - Created {len(items_with_embeddings)} new embeddings")
            logger.info(f"   - Skipped {len(models) + len(repos) - len(items_with_embeddings)} existing entries")
            logger.info(f"   - Total in vector DB: {len(existing_ids) + len(items_with_embeddings)}")
            logger.info("=" * 60 + "\n")

        except Exception as e:
            logger.error(f"\n❌ Pipeline failed: {e}")
            raise


def main():
    """Main entry point for vector embedding pipeline."""
    # Load environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    vector_table = os.getenv("SUPABASE_TABLE", "ragnosis_docs")

    if not supabase_url or not supabase_key:
        logger.error("❌ Missing Supabase credentials in .env file")
        logger.error("   Please set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        return

    # Initialize and run pipeline
    embedder = VectorEmbedder(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        vector_table=vector_table,
    )

    # Run for today's snapshot (or specify a date)
    embedder.run_embedding_pipeline()


if __name__ == "__main__":
    main()
