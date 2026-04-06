.PHONY: help setup chat web scrape-docs scrape-trends embed pipeline env-prod env-local env-status eval-quick eval-full eval eval-range

help: ## Show available commands
	@echo "RAGnosis - Simple Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Setup local development (Supabase + Ollama + Models)
	@echo "🚀 Setting up local development environment..."
	@echo ""
	@echo "1️⃣  Starting Supabase..."
	supabase start
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
	@echo "💡 Next step: Run 'make pipeline' to populate data, then 'make chat'"

chat: ## Run edge function only (RAG chat endpoint)
	@echo "💬 Starting edge function..."
	@echo "✅ Edge function will be available at http://localhost:54321/functions/v1/rag-chat"
	@echo ""
	@supabase functions serve --env-file .env 2>&1 | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z //g'

web: ## Run Next.js web app (auto-starts local edge function only if env=local)
	@if grep -q "localhost" web/.env.local 2>/dev/null; then \
		supabase functions serve --env-file .env > /dev/null 2>&1 & echo $$! > .edge-function.pid; \
		sleep 2; \
	fi
	@if [ -f .edge-function.pid ]; then \
		cd web && npm run dev; kill `cat ../.edge-function.pid` 2>/dev/null || true; rm -f ../.edge-function.pid; \
	else \
		cd web && npm run dev; \
	fi

scrape-docs: ## Scrape documentation pages
	@echo "📚 Scraping documentation pages..."
	@echo ""
	python -m src.data_collection.content.doc_pipeline
	@echo ""
	@echo "✅ Documentation scraping complete!"
	@echo "💡 Next: Run 'make embed' to create embeddings"

scrape-trends: ## Scrape Google Trends data
	@echo "📈 Scraping Google Trends data..."
	@echo ""
	python -m src.data_collection.trends_pipeline
	@echo ""
	@echo "✅ Google Trends scraping complete!"

embed: ## Create vector embeddings
	@echo "🧮 Creating vector embeddings..."
	@echo "📦 Loading sentence-transformer model (takes ~30 seconds)..."
	@echo ""
	python -m src.data_collection.embeddings.pipeline
	@echo ""
	@echo "✅ Embeddings complete!"

pipeline: ## Fetch market data (HuggingFace + GitHub)
	@echo "🚀 Fetching market data (HuggingFace + GitHub)..."
	@echo ""
	python -m src.data_collection.pipeline
	@echo ""
	@echo "✅ Market data collected!"
	@echo "💡 Next: Run 'make embed' to create embeddings"
	@echo "💡 Tip: Run 'make scrape-trends' to also update Google Trends (monthly)"

env-prod: ## Switch to production environment (.env.prod → .env + web/.env.production → web/.env.local)
	@if [ ! -f .env.prod ]; then echo "❌ .env.prod not found!"; exit 1; fi
	@if [ ! -f web/.env.production ]; then echo "❌ web/.env.production not found!"; exit 1; fi
	@cp .env.prod .env
	@cp web/.env.production web/.env.local
	@echo "✅ Switched to PRODUCTION environment"
	@echo "   📦 Root: .env.prod → .env"
	@echo "   🌐 Web: web/.env.production → web/.env.local"
	@echo "⚠️  WARNING: All commands now use PRODUCTION database!"

env-local: ## Switch to local environment (.env.local → .env + web/.env.development → web/.env.local)
	@if [ ! -f .env.local ]; then echo "❌ .env.local not found!"; exit 1; fi
	@if [ ! -f web/.env.development ]; then echo "❌ web/.env.development not found!"; exit 1; fi
	@cp .env.local .env
	@cp web/.env.development web/.env.local
	@echo "✅ Switched to LOCAL environment"
	@echo "   📦 Root: .env.local → .env"
	@echo "   🌐 Web: web/.env.development → web/.env.local"

env-status: ## Show current environment
	@echo "Current environment (.env):"
	@grep "SUPABASE_URL" .env 2>/dev/null || echo "❌ No .env file found"

eval-quick: ## Run quick evaluation (10 samples)
	@echo "🧪 Running quick evaluation (10 samples)..."
	@echo "⚠️  Make sure edge function is running (make chat)"
	@echo ""
	cd evaluation && . ../venv/bin/activate && python3 evaluate_ragnosis.py \
		--golden_data golden_data/golden_dataset.jsonl \
		--max_samples 10 \
		--save_predictions
	@echo ""
	@echo "✅ Evaluation complete! Check evaluation/results/ for output"

eval-full: ## Run full evaluation (all 40 golden test cases)
	@echo "🧪 Running full evaluation (40 test cases)..."
	@echo "⚠️  Make sure edge function is running (make chat)"
	@echo "⏱️  This may take 5-10 minutes..."
	@echo ""
	cd evaluation && . ../venv/bin/activate && python3 evaluate_ragnosis.py \
		--golden_data golden_data/golden_dataset.jsonl \
		--save_predictions
	@echo ""
	@echo "✅ Evaluation complete! Check evaluation/results/ for output"

eval: ## Run evaluation (N=samples, SECTION=sql_/docs_/etc, ALL=1 for all)
	@echo "🧪 Running evaluation..."
	@echo "⚠️  Make sure edge function is running (make chat)"
	@echo ""
	@if [ "$(ALL)" = "1" ]; then \
		cd evaluation && . ../venv/bin/activate && python3 evaluate_ragnosis.py \
			--golden_data golden_data/golden_dataset.jsonl \
			$(if $(SECTION),--question_prefix $(SECTION)) \
			--save_predictions; \
	else \
		cd evaluation && . ../venv/bin/activate && python3 evaluate_ragnosis.py \
			--golden_data golden_data/golden_dataset.jsonl \
			--max_samples $(if $(N),$(N),5) \
			$(if $(SECTION),--question_prefix $(SECTION)) \
			--save_predictions; \
	fi
	@echo ""
	@echo "✅ Evaluation complete! Check evaluation/results/ for output"

eval-range: ## Run evaluation with offset and count (RANGE=offset:count, e.g., RANGE=10:5)
	@echo "🧪 Running evaluation with range..."
	@echo "⚠️  Make sure edge function is running (make chat)"
	@echo ""
	@if [ -z "$(RANGE)" ]; then \
		echo "❌ Error: RANGE parameter required (e.g., make eval-range RANGE=10:5)"; \
		exit 1; \
	fi
	@OFFSET=$$(echo "$(RANGE)" | cut -d':' -f1); \
	COUNT=$$(echo "$(RANGE)" | cut -d':' -f2); \
	if [ -z "$$OFFSET" ] || [ -z "$$COUNT" ]; then \
		echo "❌ Error: Invalid RANGE format. Use offset:count (e.g., 10:5)"; \
		exit 1; \
	fi; \
	echo "📊 Testing questions $$OFFSET to $$((OFFSET + COUNT - 1)) ($$COUNT questions)"; \
	echo ""; \
	cd evaluation && . ../venv/bin/activate && python3 evaluate_ragnosis.py \
		--golden_data golden_data/golden_dataset.jsonl \
		--offset $$OFFSET \
		--max_samples $$COUNT \
		--save_predictions
	@echo ""
	@echo "✅ Evaluation complete! Check evaluation/results/ for output"
