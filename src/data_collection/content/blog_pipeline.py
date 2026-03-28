"""
Weekly blog scraping pipeline - scrapes RAG-related articles from sitemaps.
"""

import logging
import os
from dotenv import load_dotenv
from supabase import create_client

from blog_scraper import BlogScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


def main():
    """Scrape blog articles and store in database."""
    logger.info("=" * 60)
    logger.info("📰 WEEKLY BLOG SCRAPING")
    logger.info("=" * 60)

    # Get credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return

    supabase = create_client(supabase_url, supabase_key)

    # Get existing URLs to avoid duplicates
    logger.info("\n📥 Fetching existing article URLs...")
    try:
        response = supabase.table("blog_articles").select("url").execute()
        existing_urls = {row["url"] for row in response.data} if response.data else set()
        logger.info(f"   Found {len(existing_urls)} existing articles")
    except Exception as e:
        logger.warning(f"   ⚠️  Failed to fetch existing URLs: {e}")
        existing_urls = set()

    # Initialize scraper
    scraper = BlogScraper(existing_urls=existing_urls)

    # Scrape all enabled sites
    all_articles = []
    total_sites = len([s for s in scraper.sites_config.values() if s.get("enabled")])

    logger.info(f"\n📥 Scraping {total_sites} blog sites...")

    for site_id, site_config in scraper.sites_config.items():
        if not site_config.get("enabled"):
            continue

        try:
            articles = scraper.scrape_site(site_config)
            all_articles.extend(articles)
        except Exception as e:
            logger.error(f"   ❌ Failed to scrape {site_id}: {e}")
            continue

    # Insert articles
    if all_articles:
        logger.info(f"\n💾 Inserting {len(all_articles)} new articles...")
        try:
            rows = [article.to_db_row() for article in all_articles]
            supabase.table("blog_articles").upsert(rows).execute()
            logger.info(f"   ✅ Inserted {len(rows)} articles")
        except Exception as e:
            logger.error(f"   ❌ Failed to insert articles: {e}")
            raise
    else:
        logger.info("\n   No new articles found")

    logger.info("\n" + "=" * 60)
    logger.info("✅ BLOG SCRAPING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"   📊 New articles: {len(all_articles)}")
    logger.info("=" * 60)
    logger.info("💡 Next: Run 'make embed' to create vector embeddings")
    logger.info("=" * 60 + "\n")


if __name__ == "__main__":
    main()
