"""
RAGnosis Streamlit Dashboard - RAG Chatbot for AI Job Market Intelligence.

Ask questions about RAG/AI job market trends and get answers grounded in real data.
This UI calls a Supabase Edge Function which handles RAG logic and Ollama integration.
"""

import os
import requests
from typing import Dict
from dotenv import load_dotenv

import streamlit as st

# Load environment variables
load_dotenv()

# Configure page
st.set_page_config(
    page_title="RAGnosis - AI Job Market Intelligence",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded"
)


class EdgeFunctionClient:
    """Client for calling the RAG edge function."""

    def __init__(self, edge_function_url: str, supabase_key: str = None):
        """Initialize edge function client."""
        self.edge_function_url = edge_function_url
        self.headers = {"Content-Type": "application/json"}

        # Add authorization header if key is provided (for production)
        if supabase_key:
            self.headers["Authorization"] = f"Bearer {supabase_key}"

    def ask_question(self, query: str, top_k: int = 5) -> Dict:
        """
        Send question to edge function and get RAG response.

        Args:
            query: User question
            top_k: Number of documents to retrieve

        Returns:
            Dictionary with answer, sources, and metadata
        """
        try:
            response = requests.post(
                self.edge_function_url,
                json={"query": query, "top_k": top_k},
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "answer": f"Error: Edge function returned status {response.status_code}",
                    "sources": [],
                    "confidence": "error",
                    "error": response.text
                }

        except requests.exceptions.Timeout:
            return {
                "answer": "Request timed out. The model might be loading or the server is busy.",
                "sources": [],
                "confidence": "error"
            }
        except Exception as e:
            return {
                "answer": f"Error calling edge function: {str(e)}",
                "sources": [],
                "confidence": "error"
            }


@st.cache_resource
def initialize_client():
    """Initialize and cache the edge function client."""
    # Get edge function URL from environment
    edge_function_url = os.getenv("EDGE_FUNCTION_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    # Validate required config
    if not edge_function_url:
        st.error("Missing EDGE_FUNCTION_URL in .env file.")
        st.info("For local development, use: http://localhost:54321/functions/v1/rag-chat")
        st.stop()

    # For local development with --no-verify-jwt, key is optional
    if not supabase_key and "localhost" not in edge_function_url:
        st.error("Missing SUPABASE_KEY in .env file (required for production).")
        st.stop()

    try:
        client = EdgeFunctionClient(
            edge_function_url=edge_function_url,
            supabase_key=supabase_key
        )
        return client
    except Exception as e:
        st.error(f"Failed to initialize client: {e}")
        st.stop()


def main():
    """Main Streamlit app."""
    # Header
    st.title("🔬 RAGnosis")
    st.subheader("RAG Market Intelligence")
    st.markdown("Ask questions about RAG models, frameworks, and adoption trends")

    # Sidebar
    with st.sidebar:
        st.header("About")
        st.markdown("""
        RAGnosis provides market intelligence for RAG technology using:
        - **🤗 HuggingFace**: Popular models & download metrics
        - **💻 GitHub**: Framework stars & activity
        - **📈 Google Trends**: Search interest over time

        **Example Questions:**
        - What are the top RAG models?
        - Which RAG frameworks should I use?
        - What embedding models are most popular?
        - What are the RAG trends?
        - Which vector databases are trending?
        """)

        st.divider()

        st.header("Settings")
        show_sources = st.checkbox("Show sources", value=True)
        show_confidence = st.checkbox("Show confidence scores", value=False)
        top_k = st.slider("Number of sources to retrieve", 1, 10, 5)

        st.divider()

        # Show connection status
        edge_function_url = os.getenv("EDGE_FUNCTION_URL", "Not configured")
        if "localhost" in edge_function_url:
            st.success("🖥️ Local Edge Function")
        else:
            st.info("☁️ Cloud Edge Function")

        st.caption(f"Endpoint: {edge_function_url}")

        st.markdown("Built with Supabase Edge Functions, pgvector, and Ollama")
        st.markdown("[GitHub](https://github.com/yourusername/ragnosis)")

    # Initialize client
    client = initialize_client()

    # Initialize chat history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Display chat history
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            # Display markdown content
            st.markdown(message["content"], unsafe_allow_html=False)

            # Show detailed source metadata if available
            if message["role"] == "assistant" and "sources" in message and show_sources:
                if message["sources"]:
                    with st.expander("🔍 Source Details & Metadata", expanded=False):
                        for i, source in enumerate(message["sources"], 1):
                            col1, col2 = st.columns([3, 1])
                            with col1:
                                st.markdown(f"**{i}. {source['metadata']['title']}**")
                                st.caption(f"By {source['metadata']['company']}")
                            with col2:
                                if source['metadata'].get('downloads'):
                                    st.metric("Downloads", f"{source['metadata']['downloads']:,}")
                                elif source['metadata'].get('stars'):
                                    st.metric("Stars", f"{source['metadata']['stars']:,}")

                            if source['metadata']['url']:
                                st.link_button("View Original →", source['metadata']['url'], use_container_width=True)

                            if i < len(message["sources"]):
                                st.divider()

    # Chat input
    if prompt := st.chat_input("Ask about RAG models, frameworks, or trends..."):
        # Add user message to history
        st.session_state.messages.append({"role": "user", "content": prompt})

        # Display user message
        with st.chat_message("user"):
            st.markdown(prompt)

        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("Searching RAG market data..."):
                result = client.ask_question(prompt, top_k=top_k)

            # Display markdown answer (now includes formatted sources)
            st.markdown(result["answer"], unsafe_allow_html=False)

            # Show confidence if enabled
            if show_confidence and "confidence" in result:
                confidence = result.get("confidence", "unknown")
                confidence_emoji = "🟢" if confidence == "high" else "🟡" if confidence == "medium" else "🔴"
                st.caption(f"{confidence_emoji} Confidence: {confidence} | Sources: {result.get('count', 0)}")

            # Show detailed source metadata
            if show_sources and result.get("sources"):
                with st.expander("🔍 Source Details & Metadata", expanded=False):
                    for i, source in enumerate(result["sources"], 1):
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.markdown(f"**{i}. {source['metadata']['title']}**")
                            st.caption(f"By {source['metadata']['company']}")
                        with col2:
                            if source['metadata'].get('downloads'):
                                st.metric("Downloads", f"{source['metadata']['downloads']:,}")
                            elif source['metadata'].get('stars'):
                                st.metric("Stars", f"{source['metadata']['stars']:,}")

                        if source['metadata']['url']:
                            st.link_button("View Original →", source['metadata']['url'], use_container_width=True)

                        if i < len(result["sources"]):
                            st.divider()

        # Add assistant response to history
        st.session_state.messages.append({
            "role": "assistant",
            "content": result["answer"],
            "sources": result.get("sources", []),
            "confidence": result.get("confidence", "unknown")
        })


if __name__ == "__main__":
    main()
