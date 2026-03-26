.PHONY: help ingest setup chat

help: ## Show available commands
	@echo "RAGnosis - Simple Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

ingest: ## Run data ingestion to Supabase
	@echo "📥 Running data ingestion..."
	python src/data_collection/ingest.py
	@echo "✅ Ingestion complete!"

setup: ## Setup local development (Supabase + Ollama + Models)
	@echo "🚀 Setting up local development environment..."
	@echo ""
	@echo "1️⃣  Starting Supabase..."
	supabase start
	@echo ""
	@echo "2️⃣  Applying migrations..."
	supabase db reset
	@echo ""
	@echo "3️⃣  Deploying schema functions..."
	./scripts/deploy-schema.sh local
	@echo ""
	@echo "4️⃣  Starting Ollama..."
	docker compose up -d
	@sleep 3
	@echo ""
	@echo "5️⃣  Pulling required models..."
	docker compose exec ollama ollama pull qwen2.5:3b-instruct
	docker compose exec ollama ollama pull nomic-embed-text
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "💡 Next step: Run 'make ingest' to populate data, then 'make chat'"

chat: ## Run chat interface (starts edge functions + UI)
	@echo "💬 Starting RAGnosis..."
	@echo ""
	@echo "Starting edge functions in background..."
	@supabase functions serve --env-file .env --no-verify-jwt > /dev/null 2>&1 & echo $$! > .edge-function.pid
	@sleep 2
	@echo "✅ Edge function running at http://localhost:54321/functions/v1/rag-chat"
	@echo ""
	@echo "Starting Streamlit UI..."
	@streamlit run src/agent/research_agent.py; kill `cat .edge-function.pid` 2>/dev/null || true; rm -f .edge-function.pid
