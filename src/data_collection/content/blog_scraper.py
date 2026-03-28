"""Blog article scraper - fetches RAG-related articles from sitemaps."""

import hashlib
import logging
import re
import requests
import xml.etree.ElementTree as ET
import yaml
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class Article:
    """Represents a blog article."""

    url: str
    title: str
    content: str
    source: str  # e.g., "langchain", "llamaindex"
    scrape_method: str  # "sitemap"

    # Optional fields
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    excerpt: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    rag_topics: List[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        """Generate unique ID from URL hash."""
        return hashlib.sha256(self.url.encode()).hexdigest()[:16]

    def to_db_row(self) -> dict:
        """Convert to database row format."""
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "author": self.author,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "content": self.content,
            "excerpt": self.excerpt,
            "source": self.source,
            "tags": self.tags,
            "rag_topics": self.rag_topics,
            "scrape_method": self.scrape_method,
        }


class BlogScraper:
    """Scrapes blog articles from XML sitemaps."""

    def __init__(self, existing_urls=None):
        """Initialize scraper."""
        # Load configs from content directory
        content_dir = Path(__file__).parent

        with open(content_dir / "sites.yaml") as f:
            self.sites_config = yaml.safe_load(f)

        with open(content_dir / "filters.yaml") as f:
            filters = yaml.safe_load(f)

        self.rag_keywords = filters["rag_keywords"]
        self.skip_keywords = filters["skip_keywords"]
        self.rag_topics_map = filters["rag_topics"]

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "RAGnosis/1.0 (RAG Market Intelligence)"
        })
        self.existing_urls = existing_urls or set()

    def scrape_site(self, site_config: dict, max_articles: int = None) -> List[Article]:
        """Scrape articles from sitemap."""
        source = site_config["source_id"]
        sitemap_url = site_config.get("sitemap_url")

        if not sitemap_url:
            logger.warning(f"⚠️  No sitemap_url for {source}")
            return []

        logger.info(f"🗺️  Fetching: {site_config['name']}")

        try:
            article_entries = self._fetch_urls_from_sitemap(sitemap_url, site_config)

            if not article_entries:
                logger.warning(f"   ⚠️  No URLs found")
                return []

            logger.info(f"   Found {len(article_entries)} URLs")

            if max_articles:
                article_entries = article_entries[:max_articles]

            articles = []
            for i, (url, sitemap_date) in enumerate(article_entries, 1):
                try:
                    if url in self.existing_urls:
                        continue

                    article = self._fetch_article(url, source, sitemap_date)
                    if article:
                        articles.append(article)
                        logger.info(f"   [{i}/{len(article_entries)}] ✅ {article.title[:60]}")
                except Exception as e:
                    logger.warning(f"   [{i}/{len(article_entries)}] ⚠️  Failed: {url}")
                    continue

            logger.info(f"   ✅ Scraped {len(articles)} articles")
            return articles

        except Exception as e:
            logger.error(f"   ❌ Sitemap error: {e}")
            return []

    def _fetch_urls_from_sitemap(self, sitemap_url: str, site_config: dict) -> List[tuple]:
        """Fetch URLs with dates from sitemap XML."""
        try:
            response = self.session.get(sitemap_url, timeout=30)
            response.raise_for_status()

            root = ET.fromstring(response.content)
            namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

            # Check for sitemap index
            sitemap_nodes = root.findall('.//ns:sitemap/ns:loc', namespace)
            if sitemap_nodes:
                sub_sitemap_url = site_config.get("sitemap_posts_url")
                if sub_sitemap_url:
                    return self._fetch_urls_from_sitemap(sub_sitemap_url, site_config)
                return []

            # Extract URLs
            url_entries = root.findall('.//ns:url', namespace)
            all_entries = []

            for entry in url_entries:
                loc = entry.find('ns:loc', namespace)
                lastmod = entry.find('ns:lastmod', namespace)

                if loc is not None and loc.text:
                    url = loc.text
                    date = None
                    if lastmod is not None and lastmod.text:
                        try:
                            date = datetime.fromisoformat(lastmod.text.replace('Z', '+00:00'))
                        except:
                            pass
                    all_entries.append((url, date))

            # Filter by pattern
            url_pattern = site_config.get("url_pattern", "")
            if url_pattern:
                exclude = site_config.get("exclude_patterns", [])
                filtered = [
                    (url, date) for url, date in all_entries
                    if url_pattern in url and not any(ex in url for ex in exclude)
                ]
                return filtered

            return all_entries

        except Exception as e:
            logger.error(f"   ❌ Sitemap fetch failed: {e}")
            return []

    def _fetch_article(self, url: str, source: str, sitemap_date: datetime = None) -> Article:
        """Fetch and parse article."""
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")

            # Extract title
            title = self._extract_title(soup)
            if not title:
                return None

            # Early filter
            if any(skip in title.lower() for skip in self.skip_keywords):
                return None

            # Extract content
            content = self._extract_content(soup)
            if not content or len(content.strip()) < 100:
                return None

            # Check RAG relevance
            if not self._is_rag_related(title, content):
                return None

            # Extract metadata
            author = self._extract_author(soup)
            published_at = self._extract_date(soup) or sitemap_date
            excerpt = content[:300] if len(content) > 300 else content
            rag_topics = self._extract_rag_topics(title, content)

            return Article(
                url=url,
                title=self._clean_text(title),
                content=self._clean_text(content),
                source=source,
                scrape_method="sitemap",
                author=author,
                published_at=published_at,
                excerpt=self._clean_text(excerpt),
                tags=[],
                rag_topics=rag_topics,
            )

        except Exception:
            return None

    def _is_rag_related(self, title: str, content: str) -> bool:
        """Check if article is RAG-related."""
        text = f"{title} {content}".lower()

        if any(skip in text for skip in self.skip_keywords):
            return False

        return any(keyword in text for keyword in self.rag_keywords)

    def _extract_rag_topics(self, title: str, content: str) -> List[str]:
        """Extract RAG topics."""
        text = f"{title} {content}".lower()
        topics = []

        for topic, keywords in self.rag_topics_map.items():
            if any(keyword in text for keyword in keywords):
                topics.append(topic)

        return topics

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        if not text:
            return ""
        text = re.sub(r"\s+", " ", text)
        text = text.replace("&nbsp;", " ").replace("&amp;", "&")
        return text.strip()

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract title."""
        # Try og:title meta tag
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"]

        # Try h1
        h1 = soup.find("h1")
        if h1:
            return h1.get_text()

        # Try title tag
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text()

        return ""

    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract article content."""
        for unwanted in soup(["script", "style", "nav", "footer", "header", "aside"]):
            unwanted.decompose()

        article = (
            soup.find("article")
            or soup.find("main")
            or soup.find(class_=lambda x: x and "content" in str(x).lower())
        )

        if article:
            content = article.get_text(separator="\n", strip=True)
        else:
            content = soup.get_text(separator="\n", strip=True)

        lines = (line.strip() for line in content.splitlines())
        return "\n".join(line for line in lines if line)

    def _extract_author(self, soup: BeautifulSoup) -> str:
        """Extract author."""
        author_meta = soup.find("meta", {"name": "author"}) or soup.find("meta", property="article:author")
        if author_meta and author_meta.get("content"):
            return author_meta["content"]

        author_elem = soup.find(class_=lambda x: x and "author" in str(x).lower())
        if author_elem:
            return author_elem.get_text(strip=True)

        return None

    def _extract_date(self, soup: BeautifulSoup) -> datetime:
        """Extract published date."""
        date_meta = (
            soup.find("meta", property="article:published_time")
            or soup.find("meta", {"name": "publish-date"})
            or soup.find("time")
        )

        if date_meta:
            date_str = date_meta.get("content") or date_meta.get("datetime")
            if date_str:
                try:
                    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except:
                    pass

        return None
